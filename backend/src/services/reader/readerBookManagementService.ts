import mongoose from "mongoose";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderAnnotationModel } from "../../models/reader/readerAnnotationModel";
import { ReaderFlagModel } from "../../models/reader/readerFlagModel";
import { ReaderConversationModel } from "../../models/reader/readerConversationModel";
import {
  ReaderLookupModel,
  ReaderVocabularyModel,
} from "../../models/reader/readerVocabularyModel";
import { AppError } from "../error/errorService";

export async function permanentlyDeleteReaderBook(id: string, userId: string) {
  const session = await mongoose.startSession();
  try {
    // GridFS cleanup participates in the same transaction, so failures leave
    // the archived book and its data intact and available for retry.
    await session.withTransaction(async () => {
      const book = await ReaderBookModel.findOneAndDelete(
        { _id: id, userId, archived: true },
        { session },
      ).select("+fileId +originalFileId");
      if (!book)
        throw new AppError(
          "Archived book not found. Only archived books can be permanently deleted.",
          404,
        );
      const scope = { userId, bookId: book._id };
      await ReaderAnnotationModel.deleteMany(scope, { session });
      await ReaderFlagModel.deleteMany(scope, { session });
      await ReaderConversationModel.deleteMany(scope, { session });
      await ReaderLookupModel.deleteMany(scope, { session });
      const words = await ReaderVocabularyModel.find({ userId, bookIds: book._id }).session(
        session,
      );
      for (const word of words) {
        const events = await ReaderLookupModel.find({ userId, headword: word.headword })
          .sort({ createdAt: 1 })
          .session(session);
        const remainingBooks = word.bookIds.filter(bookId => String(bookId) !== id);
        if (!remainingBooks.length && !events.length) {
          await ReaderVocabularyModel.deleteOne({ _id: word._id, userId }, { session });
        } else {
          await ReaderVocabularyModel.updateOne(
            { _id: word._id, userId },
            {
              $pull: {
                bookIds: book._id,
                reviewedBookIds: book._id,
                reviewHiddenBookIds: book._id,
              },
              $set: {
                lookupCount: events.length,
                observedForms: [...new Set(events.map(event => event.word))],
                ...(events.length
                  ? {
                      firstLookedUpAt: events[0].createdAt,
                      lastLookedUpAt: events[events.length - 1].createdAt,
                    }
                  : {}),
              },
            },
            { session },
          );
        }
      }
      const db = mongoose.connection.db;
      if (!db) throw new AppError("Database is unavailable.", 503);
      const fileIds = new Map(
        [book.fileId, book.originalFileId].filter(Boolean).map(fileId => [String(fileId), fileId]),
      );
      for (const fileId of fileIds.values()) {
        // Both file fields and all owners must be checked before removing bytes.
        const referenced = await ReaderBookModel.exists({
          $or: [{ fileId }, { originalFileId: fileId }],
        }).session(session);
        if (!referenced) {
          await db.collection("reader_files.chunks").deleteMany({ files_id: fileId }, { session });
          await db.collection("reader_files.files").deleteOne({ _id: fileId }, { session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
}
