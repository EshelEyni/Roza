import { randomUUID } from "crypto";
import { Request, Response } from "express";
import mongoose from "mongoose";
import type { BookPublishing, SlateCustomElement } from "../../../../shared/types/books";
import { BookModel } from "../../models/books/bookModel";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { parseEpub } from "../../services/reader/epubService";
import { removeReaderFile, saveReaderFile } from "../../services/reader/readerStorageService";
import { defaultReaderPreferences } from "../../services/reader/readerUtilService";
import {
  buildStudioEpub,
  epubFilename,
  parseCover,
  parsePublishingRequest,
  StudioEpubChapter,
} from "../../services/reader/studioEpubService";

async function loadManuscript(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Book not found", 404);
  const userId = getLoggedInUserIdFromReq();
  // The model's find hooks drop archived chapters, so they never reach the EPUB.
  const book = await BookModel.findOne({ _id: id, userId, isArchived: false });
  if (!book) throw new AppError("Book not found", 404);
  const chapters: StudioEpubChapter[] = (book.chapters || []).map(chapter => ({
    id: String(chapter._id),
    name: chapter.name || "",
    format: chapter.format,
    text: (chapter.toObject?.().text ?? chapter.text) as unknown as SlateCustomElement[],
  }));
  return { book, chapters, userId };
}

function build(
  body: unknown,
  chapters: StudioEpubChapter[],
  identifier: string,
) {
  const options = parsePublishingRequest(body, chapters);
  const buffer = buildStudioEpub({
    options,
    chapters,
    cover: parseCover(options.cover),
    identifier,
    modified: new Date(),
  });
  const filename = epubFilename(options.title);
  // The same check an upload goes through. It also yields the sanitized copy the reader serves.
  const parsed = parseEpub(buffer, filename);
  return { options, buffer, parsed, filename };
}

/** Builds the EPUB and returns it as a file. Nothing is stored. */
export const downloadStudioEpub = asyncErrorCatcher(async (req: Request, res: Response) => {
  const { book, chapters } = await loadManuscript(req.params.bookId);
  const identifier = book.publishing?.identifier || `urn:uuid:${randomUUID()}`;
  const { buffer, filename } = build(req.body, chapters, identifier);
  res.setHeader("Content-Type", "application/epub+zip");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="book.epub"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.send(buffer);
});

async function removeUnreferenced(fileIds: mongoose.Types.ObjectId[]) {
  for (const fileId of fileIds) {
    const referenced = await ReaderBookModel.exists({
      $or: [{ fileId }, { originalFileId: fileId }],
    });
    if (!referenced) await removeReaderFile(fileId).catch(() => undefined);
  }
}

/**
 * Builds the EPUB and puts it in the Reading Room. The first save creates a
 * library book. Later saves replace its file and keep its reading state and notes.
 */
export const publishStudioBook = asyncErrorCatcher(async (req: Request, res: Response) => {
  const { book, chapters, userId } = await loadManuscript(req.params.bookId);
  const identifier = book.publishing?.identifier || `urn:uuid:${randomUUID()}`;
  const { options, buffer, parsed, filename } = build(req.body, chapters, identifier);

  const created: mongoose.Types.ObjectId[] = [];
  let readerBookId: mongoose.Types.ObjectId;
  try {
    const originalFileId = await saveReaderFile(buffer, filename, userId);
    created.push(originalFileId);
    const fileId = await saveReaderFile(parsed.buffer, filename, userId);
    created.push(fileId);
    const fields = {
      title: options.title,
      author: options.author,
      cover: parsed.cover,
      filename,
      size: buffer.length,
      fileId,
      originalFileId,
    };
    const existing = book.publishing?.readerBookId
      ? await ReaderBookModel.findOne({ _id: book.publishing.readerBookId, userId }).select(
          "+fileId +originalFileId",
        )
      : null;
    if (existing) {
      const previous = [existing.fileId, existing.originalFileId].filter(Boolean);
      await ReaderBookModel.updateOne({ _id: existing._id, userId }, { $set: fields });
      readerBookId = existing._id as mongoose.Types.ObjectId;
      created.length = 0;
      await removeUnreferenced(previous);
    } else {
      const latest = await ReaderBookModel.findOne({ userId }).sort({ updatedAt: -1 });
      const readerBook = await ReaderBookModel.create({
        userId,
        ...fields,
        state: {
          location: "",
          progress: 0,
          savedAt: 0,
          preferences: latest?.state?.preferences || defaultReaderPreferences,
        },
      });
      readerBookId = readerBook._id as mongoose.Types.ObjectId;
      created.length = 0;
    }
  } catch (error) {
    await Promise.all(created.map(id => removeReaderFile(id).catch(() => undefined)));
    throw error;
  }

  const publishing = {
    ...options,
    identifier,
    readerBookId,
    publishedAt: new Date(),
    sourceUpdatedAt: book.updatedAt,
  };
  // Like narrator settings, this sits beside the manuscript's autosave version.
  await BookModel.updateOne(
    { _id: book._id, userId },
    { $set: { publishing } },
    { runValidators: true, timestamps: false },
  );
  const data: BookPublishing = {
    ...options,
    identifier,
    readerBookId: String(readerBookId),
    publishedAt: publishing.publishedAt.toISOString(),
    sourceUpdatedAt: new Date(book.updatedAt).toISOString(),
  };
  res.json({ status: "success", data });
});
