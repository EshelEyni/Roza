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
exports.updateVocabularyReview = exports.translateFlag = exports.getReview = exports.updateFlag = exports.saveFlag = exports.listFlags = void 0;
const readerDictionaryService_1 = require("../../services/reader/readerDictionaryService");
const mongoose_1 = __importDefault(require("mongoose"));
const readerFlagModel_1 = require("../../models/reader/readerFlagModel");
const readerBookModel_1 = require("../../models/reader/readerBookModel");
const readerVocabularyModel_1 = require("../../models/reader/readerVocabularyModel");
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const validCfi = (v) => typeof v === "string" &&
    v.length <= 4096 &&
    /^epubcfi\(\/6\/\d+(?:\[[^<>]*?\])?!\/[^<>]+\)$/.test(v);
function scope(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = (0, ALSService_1.getLoggedInUserIdFromReq)();
        if (!mongoose_1.default.isValidObjectId(req.params.id) ||
            !(yield readerBookModel_1.ReaderBookModel.exists({ _id: req.params.id, userId })))
            throw new errorService_1.AppError("Book not found.", 404);
        return { userId, bookId: req.params.id };
    });
}
exports.listFlags = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "success",
        data: yield readerFlagModel_1.ReaderFlagModel.find(filter).sort({ createdAt: -1 }),
    });
}));
exports.saveFlag = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    const { cfi, endCfi = "", text, chapter = "", context = "" } = req.body;
    if (!validCfi(cfi) ||
        (endCfi !== "" && !validCfi(endCfi)) ||
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 100000 ||
        typeof chapter !== "string" ||
        chapter.length > 1000 ||
        typeof context !== "string" ||
        context.length > 100000)
        throw new errorService_1.AppError("Invalid flag.", 400);
    const identity = Object.assign(Object.assign({}, filter), { cfi, endCfi });
    let flag;
    try {
        flag = yield readerFlagModel_1.ReaderFlagModel.findOneAndUpdate(identity, { $setOnInsert: Object.assign(Object.assign({}, identity), { text, chapter, context }) }, { new: true, upsert: true, runValidators: true });
    }
    catch (error) {
        if (error.code !== 11000)
            throw error;
        flag = yield readerFlagModel_1.ReaderFlagModel.findOne(identity);
    }
    res.json({ status: "success", data: flag });
}));
exports.updateFlag = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    if (!mongoose_1.default.isValidObjectId(req.params.flagId))
        throw new errorService_1.AppError("Flag not found.", 404);
    const identity = Object.assign(Object.assign({}, filter), { _id: req.params.flagId });
    const flag = req.method === "DELETE"
        ? yield readerFlagModel_1.ReaderFlagModel.findOneAndDelete(identity)
        : typeof req.body.reviewed === "boolean"
            ? yield readerFlagModel_1.ReaderFlagModel.findOneAndUpdate(identity, { $set: { reviewed: req.body.reviewed } }, { new: true })
            : null;
    if (!flag)
        throw new errorService_1.AppError("Flag not found or invalid update.", 404);
    res.json({ status: "success", data: flag });
}));
exports.getReview = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, bookId } = yield scope(req);
    const books = yield readerBookModel_1.ReaderBookModel.find({ userId, _id: bookId })
        .select("title")
        .lean();
    const bookIds = books.map((book) => book._id);
    const [flags, vocabulary, lookups] = yield Promise.all([
        readerFlagModel_1.ReaderFlagModel.find({ userId, bookId: { $in: bookIds } }).sort({
            createdAt: -1,
        }),
        readerVocabularyModel_1.ReaderVocabularyModel.find({
            userId,
            bookIds: bookId,
            reviewHiddenBookIds: { $ne: bookId },
        })
            .sort({ lastLookedUpAt: -1 })
            .lean(),
        readerVocabularyModel_1.ReaderLookupModel.find({ userId, bookId: { $in: bookIds } })
            .sort({ createdAt: -1 })
            .lean(),
    ]);
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "success",
        data: {
            flags,
            books: books.map((b) => ({ id: String(b._id), title: b.title })),
            vocabulary: vocabulary.map((v) => {
                var _a;
                return ({
                    id: String(v._id),
                    reviewed: ((_a = v.reviewedBookIds) === null || _a === void 0 ? void 0 : _a.some((id) => String(id) === bookId)) || false,
                    headword: v.headword,
                    entry: v.entry,
                    books: books
                        .filter((b) => v.bookIds.some((id) => String(id) === String(b._id)))
                        .map((b) => {
                        var _a;
                        return ({
                            bookId: String(b._id),
                            title: b.title,
                            location: ((_a = lookups.find((l) => l.headword === v.headword &&
                                String(l.bookId) === String(b._id))) === null || _a === void 0 ? void 0 : _a.location) || "",
                        });
                    }),
                });
            }),
        },
    });
}));
// Explicit review translation never records a lookup event or changes vocabulary statistics.
exports.translateFlag = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    if (!mongoose_1.default.isValidObjectId(req.params.flagId))
        throw new errorService_1.AppError("Flag not found.", 404);
    const flag = yield readerFlagModel_1.ReaderFlagModel.findOne(Object.assign(Object.assign({}, filter), { _id: req.params.flagId }));
    const word = typeof (flag === null || flag === void 0 ? void 0 : flag.text) === "string"
        ? flag.text.replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, "")
        : undefined;
    if (!word ||
        !/^[a-zA-Z]+(?:['’-][a-zA-Z]+)*$/.test(word) ||
        word.length > 80)
        throw new errorService_1.AppError("Select a single English word.", 400);
    const normalized = word
        .normalize("NFKC")
        .replace(/[’‘]/g, "'")
        .toLowerCase();
    const saved = yield readerVocabularyModel_1.ReaderVocabularyModel.findOne({
        userId: filter.userId,
        $or: [{ headword: normalized }, { observedForms: normalized }],
    });
    const entry = (saved === null || saved === void 0 ? void 0 : saved.entry) || (yield (0, readerDictionaryService_1.lookupReaderWordWithTranslation)(word, "auto"));
    res.json({ status: "success", data: entry });
}));
exports.updateVocabularyReview = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, bookId } = yield scope(req);
    if (!mongoose_1.default.isValidObjectId(req.params.vocabularyId))
        throw new errorService_1.AppError("Vocabulary not found.", 404);
    const update = req.method === "DELETE"
        ? { $addToSet: { reviewHiddenBookIds: bookId } }
        : typeof req.body.reviewed === "boolean"
            ? req.body.reviewed
                ? { $addToSet: { reviewedBookIds: bookId } }
                : { $pull: { reviewedBookIds: bookId } }
            : null;
    if (!update)
        throw new errorService_1.AppError("Invalid review status.", 400);
    const item = yield readerVocabularyModel_1.ReaderVocabularyModel.findOneAndUpdate({ _id: req.params.vocabularyId, userId, bookIds: bookId }, update, { new: true });
    if (!item)
        throw new errorService_1.AppError("Vocabulary not found.", 404);
    res.json({ status: "success", data: null });
}));
//# sourceMappingURL=readerReviewController.js.map