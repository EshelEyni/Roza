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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReaderBook = exports.renameReaderBook = exports.updateReaderBookArchive = exports.updateReaderState = exports.getReaderFile = exports.getReaderBook = exports.addReaderBook = exports.getReaderBooks = exports.getReaderAccess = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const readerBookModel_1 = require("../../models/reader/readerBookModel");
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const readerAccessService_1 = require("../../services/reader/readerAccessService");
const epubService_1 = require("../../services/reader/epubService");
const readerStorageService_1 = require("../../services/reader/readerStorageService");
const readerBookManagementService_1 = require("../../services/reader/readerBookManagementService");
const readerUtilService_1 = require("../../services/reader/readerUtilService");
const getReaderAccess = (0, errorService_1.asyncErrorCatcher)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({ status: "success", data: { enabled: (0, readerAccessService_1.isReaderEnabled)((0, ALSService_1.getLoggedInUserIdFromReq)()) } });
}));
exports.getReaderAccess = getReaderAccess;
const getReaderBooks = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let cursor;
    if (req.query.cursor !== undefined) {
        try {
            if (typeof req.query.cursor !== "string")
                throw new Error();
            cursor = JSON.parse(Buffer.from(req.query.cursor, "base64url").toString());
            if (!cursor || !Number.isSafeInteger(cursor.activity) || cursor.activity < 0 || !/^[a-f0-9]{24}$/.test(cursor.id))
                throw new Error();
        }
        catch (_a) {
            throw new errorService_1.AppError("Invalid library cursor.", 400);
        }
    }
    // Compute reading activity in Mongo, including legacy books without saved state.
    const books = yield readerBookModel_1.ReaderBookModel.aggregate([
        { $match: { userId: new mongoose_1.default.Types.ObjectId((0, ALSService_1.getLoggedInUserIdFromReq)()), archived: req.query.archived === "true" ? true : { $ne: true } } },
        { $addFields: { activity: { $cond: [{ $gt: ["$state.savedAt", 0] }, "$state.savedAt", { $toLong: "$createdAt" }] } } },
        ...(cursor ? [{ $match: { $or: [
                        { activity: { $lt: cursor.activity } },
                        { activity: cursor.activity, _id: { $lt: new mongoose_1.default.Types.ObjectId(cursor.id) } },
                    ] } }] : []),
        { $sort: { activity: -1, _id: -1 } },
        { $limit: 6 },
        { $project: { fileId: 0, originalFileId: 0, userId: 0 } },
    ]);
    const page = books.slice(0, 5);
    const last = page[page.length - 1];
    const nextCursor = books.length > 5 ? Buffer.from(JSON.stringify({ activity: Number(last.activity), id: String(last._id) })).toString("base64url") : null;
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: {
            books: page.map((_a) => {
                var { activity } = _a, book = __rest(_a, ["activity"]);
                return readerBookModel_1.ReaderBookModel.hydrate(book).toJSON();
            }), nextCursor,
        } });
}));
exports.getReaderBooks = getReaderBooks;
const addReaderBook = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!Buffer.isBuffer(req.body))
        throw new errorService_1.AppError("Upload an EPUB file.", 400);
    let filename = "book.epub";
    try {
        filename = decodeURIComponent(String(req.headers["x-filename"] || filename));
    }
    catch (_b) {
        throw new errorService_1.AppError("Invalid filename.", 400);
    }
    filename = filename
        .split(/[/\\]/)
        .pop()
        .replace(/[\x00-\x1f]/g, "")
        .slice(0, 250);
    if (!/\.epub$/i.test(filename))
        throw new errorService_1.AppError("Only EPUB files are supported.", 400);
    const epub = (0, epubService_1.parseEpub)(req.body, filename);
    const userId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    const previous = yield readerBookModel_1.ReaderBookModel.findOne({ userId }).sort({ updatedAt: -1 });
    const ids = [];
    try {
        const originalFileId = yield (0, readerStorageService_1.saveReaderFile)(req.body, filename, userId);
        ids.push(originalFileId);
        const fileId = yield (0, readerStorageService_1.saveReaderFile)(epub.buffer, filename, userId);
        ids.push(fileId);
        const book = yield readerBookModel_1.ReaderBookModel.create({
            userId,
            title: epub.title,
            author: epub.author,
            cover: epub.cover,
            filename,
            size: req.body.length,
            fileId,
            originalFileId,
            state: {
                location: "",
                progress: 0,
                savedAt: 0,
                preferences: ((_a = previous === null || previous === void 0 ? void 0 : previous.state) === null || _a === void 0 ? void 0 : _a.preferences) || readerUtilService_1.defaultReaderPreferences,
            },
        });
        res.status(201).json({ status: "success", data: book });
    }
    catch (error) {
        yield Promise.allSettled(ids.map(readerStorageService_1.removeReaderFile));
        throw error;
    }
}));
exports.addReaderBook = addReaderBook;
function findReaderBook(req) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            throw new errorService_1.AppError("Book not found.", 404);
        const book = yield readerBookModel_1.ReaderBookModel.findOne({
            _id: req.params.id,
            userId: (0, ALSService_1.getLoggedInUserIdFromReq)(),
        }).select("+fileId +originalFileId");
        if (!book)
            throw new errorService_1.AppError("Book not found.", 404);
        return book;
    });
}
const updateReaderBookArchive = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof req.body.archived !== "boolean")
        throw new errorService_1.AppError("Invalid archive status.", 400);
    const book = yield findReaderBook(req);
    const updated = yield readerBookModel_1.ReaderBookModel.findOneAndUpdate({ _id: book._id, userId: (0, ALSService_1.getLoggedInUserIdFromReq)() }, { $set: { archived: req.body.archived } }, { new: true, runValidators: true });
    if (!updated)
        throw new errorService_1.AppError("Book not found.", 404);
    res.json({ status: "success", data: updated });
}));
exports.updateReaderBookArchive = updateReaderBookArchive;
const renameReaderBook = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 500)
        throw new errorService_1.AppError("Enter a title between 1 and 500 characters.", 400);
    const book = yield findReaderBook(req);
    const updated = yield readerBookModel_1.ReaderBookModel.findOneAndUpdate({ _id: book._id, userId: (0, ALSService_1.getLoggedInUserIdFromReq)() }, { $set: { title } }, { new: true, runValidators: true });
    if (!updated)
        throw new errorService_1.AppError("Book not found.", 404);
    res.json({ status: "success", data: updated });
}));
exports.renameReaderBook = renameReaderBook;
const deleteReaderBook = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        throw new errorService_1.AppError("Book not found.", 404);
    yield (0, readerBookManagementService_1.permanentlyDeleteReaderBook)(req.params.id, (0, ALSService_1.getLoggedInUserIdFromReq)());
    res.json({ status: "success", data: null });
}));
exports.deleteReaderBook = deleteReaderBook;
const getReaderBook = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: yield findReaderBook(req) });
}));
exports.getReaderBook = getReaderBook;
const getReaderFile = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const book = yield findReaderBook(req);
    const bucket = (0, readerStorageService_1.getReaderBucket)();
    const file = yield bucket.find({ _id: book.fileId }).next();
    if (!file)
        throw new errorService_1.AppError("Book file not found.", 404);
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", "attachment; filename=book.epub");
    const stream = bucket.openDownloadStream(book.fileId);
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
}));
exports.getReaderFile = getReaderFile;
const updateReaderState = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const book = yield findReaderBook(req);
    const { location, progress, preferences, savedAt } = req.body;
    if (typeof location !== "string" ||
        location.length > 4096 ||
        (location !== "" && !/^epubcfi\([^<>]*\)$/.test(location)) ||
        typeof progress !== "number" ||
        !Number.isFinite(progress) ||
        progress < 0 ||
        progress > 1 ||
        !Number.isSafeInteger(savedAt) ||
        savedAt <= 0)
        throw new errorService_1.AppError("Invalid reading position.", 400);
    if (!preferences ||
        typeof preferences !== "object" ||
        !Number.isFinite(preferences.fontSize) ||
        preferences.fontSize < 14 ||
        preferences.fontSize > 56 ||
        !Number.isFinite(preferences.lineHeight) ||
        preferences.lineHeight < 1.2 ||
        preferences.lineHeight > 2.4 ||
        !["serif", "sans-serif"].includes(preferences.fontFamily) ||
        !["comfortable", "wide"].includes(preferences.width) ||
        !["light", "sepia", "dark"].includes(preferences.theme) ||
        !["paginated", "scrolled"].includes(preferences.flow) ||
        ["backgroundColor", "selectionColor", "selectionTextColor", "passageColor", "passageTextColor", "translationColor", "translationTextColor"].some(key => preferences[key] !== undefined && (typeof preferences[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(preferences[key]))) ||
        (preferences.pageNumbering !== undefined && !["screen", "publisher"].includes(preferences.pageNumbering)))
        throw new errorService_1.AppError("Invalid reader preferences.", 400);
    const safePreferences = {
        fontSize: preferences.fontSize,
        lineHeight: preferences.lineHeight,
        fontFamily: preferences.fontFamily,
        width: preferences.width,
        theme: preferences.theme,
        flow: preferences.flow,
        backgroundColor: preferences.backgroundColor,
        selectionColor: preferences.selectionColor,
        selectionTextColor: preferences.selectionTextColor,
        passageColor: preferences.passageColor,
        passageTextColor: preferences.passageTextColor,
        translationColor: preferences.translationColor,
        translationTextColor: preferences.translationTextColor,
        pageNumbering: (_a = preferences.pageNumbering) !== null && _a !== void 0 ? _a : "screen",
    };
    // A delayed page-leave request must not overwrite a more recent position.
    const updated = yield readerBookModel_1.ReaderBookModel.findOneAndUpdate({
        _id: book._id,
        userId: (0, ALSService_1.getLoggedInUserIdFromReq)(),
        $or: [{ "state.savedAt": { $lte: savedAt } }, { "state.savedAt": { $exists: false } }],
    }, { $set: { state: { location, progress, savedAt, preferences: safePreferences } } }, { new: true, runValidators: true });
    res.json({ status: "success", data: (updated === null || updated === void 0 ? void 0 : updated.state) || book.state });
}));
exports.updateReaderState = updateReaderState;
//# sourceMappingURL=readerController.js.map