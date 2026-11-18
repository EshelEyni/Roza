"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.permanentlyDeleteReaderBook = permanentlyDeleteReaderBook;
const mongoose_1 = __importDefault(require("mongoose"));
const readerBookModel_1 = require("../../models/reader/readerBookModel");
const readerAnnotationModel_1 = require("../../models/reader/readerAnnotationModel");
const readerFlagModel_1 = require("../../models/reader/readerFlagModel");
const readerConversationModel_1 = require("../../models/reader/readerConversationModel");
const readerVocabularyModel_1 = require("../../models/reader/readerVocabularyModel");
const errorService_1 = require("../error/errorService");
function permanentlyDeleteReaderBook(id, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const session = yield mongoose_1.default.startSession();
        try {
            // GridFS cleanup participates in the same transaction, so failures leave
            // the archived book and its data intact and available for retry.
            yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                const book = yield readerBookModel_1.ReaderBookModel.findOneAndDelete({ _id: id, userId, archived: true }, { session }).select("+fileId +originalFileId");
                if (!book)
                    throw new errorService_1.AppError("Archived book not found. Only archived books can be permanently deleted.", 404);
                const scope = { userId, bookId: book._id };
                yield readerAnnotationModel_1.ReaderAnnotationModel.deleteMany(scope, { session });
                yield readerFlagModel_1.ReaderFlagModel.deleteMany(scope, { session });
                yield readerConversationModel_1.ReaderConversationModel.deleteMany(scope, { session });
                yield readerVocabularyModel_1.ReaderLookupModel.deleteMany(scope, { session });
                const words = yield readerVocabularyModel_1.ReaderVocabularyModel.find({ userId, bookIds: book._id }).session(session);
                for (const word of words) {
                    const events = yield readerVocabularyModel_1.ReaderLookupModel.find({ userId, headword: word.headword })
                        .sort({ createdAt: 1 })
                        .session(session);
                    const remainingBooks = word.bookIds.filter(bookId => String(bookId) !== id);
                    if (!remainingBooks.length && !events.length) {
                        yield readerVocabularyModel_1.ReaderVocabularyModel.deleteOne({ _id: word._id, userId }, { session });
                    }
                    else {
                        yield readerVocabularyModel_1.ReaderVocabularyModel.updateOne({ _id: word._id, userId }, {
                            $pull: {
                                bookIds: book._id,
                                reviewedBookIds: book._id,
                                reviewHiddenBookIds: book._id,
                            },
                            $set: Object.assign({ lookupCount: events.length, observedForms: [...new Set(events.map(event => event.word))] }, (events.length
                                ? {
                                    firstLookedUpAt: events[0].createdAt,
                                    lastLookedUpAt: events[events.length - 1].createdAt,
                                }
                                : {})),
                        }, { session });
                    }
                }
                const db = mongoose_1.default.connection.db;
                if (!db)
                    throw new errorService_1.AppError("Database is unavailable.", 503);
                const fileIds = new Map([book.fileId, book.originalFileId].filter(Boolean).map(fileId => [String(fileId), fileId]));
                for (const fileId of fileIds.values()) {
                    // Both file fields and all owners must be checked before removing bytes.
                    const referenced = yield readerBookModel_1.ReaderBookModel.exists({
                        $or: [{ fileId }, { originalFileId: fileId }],
                    }).session(session);
                    if (!referenced) {
                        yield db.collection("reader_files.chunks").deleteMany({ files_id: fileId }, { session });
                        yield db.collection("reader_files.files").deleteOne({ _id: fileId }, { session });
                    }
                }
            }));
        }
        finally {
            yield session.endSession();
        }
    });
}
//# sourceMappingURL=readerBookManagementService.js.map