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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBook = exports.addBook = exports.getBookById = exports.getBooks = void 0;
const planningValidation_1 = require("./planningValidation");
const mongoose_1 = require("mongoose");
const bookModel_1 = require("../../models/books/bookModel");
const bookSchema_1 = require("../../models/books/schemas/bookSchema");
const errorService_1 = require("../../services/error/errorService");
const ALSService_1 = require("../../services/ALSService");
const getBooks = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    if (!loggedInUserId)
        return next(new errorService_1.AppError("User not logged in", 401));
    const { limit, sort, searchTerm } = req.query;
    const query = bookModel_1.BookModel.find({ userId: loggedInUserId, isArchived: false })
        .limit(limit ? parseInt(limit.toString()) : 10)
        .sort(sort ? sort.toString() : "sortOrder");
    if (searchTerm) {
        query.find({ $text: { $search: searchTerm.toString() } }, { score: { $meta: "textScore" } });
        query.sort({ score: { $meta: "textScore" } });
    }
    const books = (yield query.exec());
    res.json({
        status: "success",
        requestedAt: new Date().toISOString(),
        results: books.length,
        data: books,
    });
}));
exports.getBooks = getBooks;
const getBookById = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    const book = yield bookModel_1.BookModel.findOne({ _id: id, userId: loggedInUserId, isArchived: false });
    if (!book)
        throw new errorService_1.AppError(`No book was found with the id: ${id}`, 404);
    res.json({
        status: "success",
        data: book,
    });
}));
exports.getBookById = getBookById;
const addBook = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    validateWordGoal(req.body.wordGoal);
    try {
        (0, planningValidation_1.validatePlanning)(req.body, String(req.body.id || req.body._id || ""));
    }
    catch (error) {
        throw new errorService_1.AppError(error.message, 400);
    }
    const book = yield bookModel_1.BookModel.create(Object.assign(Object.assign({}, req.body), { userId: loggedInUserId }));
    res.status(201).json({
        status: "success",
        data: book,
    });
}));
exports.addBook = addBook;
const updateBook = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    if (!loggedInUserId)
        throw new errorService_1.AppError("User not logged in", 401);
    // Read raw storage because find middleware hides archived children.
    const current = yield bookModel_1.BookModel.collection.findOne({
        _id: new mongoose_1.Types.ObjectId(id),
        userId: new mongoose_1.Types.ObjectId(loggedInUserId),
        isArchived: { $ne: true },
    });
    if (!current)
        throw new errorService_1.AppError("Book not found", 404);
    const expected = req.body.updatedAt;
    if (expected && new Date(expected).getTime() !== new Date(current.updatedAt).getTime())
        throw new errorService_1.AppError("This manuscript changed in another session. Export your draft, then reload to review the latest version.", 409);
    if (!expected &&
        ["chapters", "characters", "themes", "plotlines", "notes", "taskBoard"].some(field => field === "taskBoard" ? req.body[field] !== undefined : Array.isArray(req.body[field])))
        throw new errorService_1.AppError("Reload the manuscript before saving its contents.", 409);
    const fields = [
        "taskBoard",
        "name",
        "chapters",
        "characters",
        "themes",
        "plotlines",
        "notes",
        "filterBy",
        "isArchived",
        "isReadMode",
        "wordGoal",
    ];
    validateWordGoal(req.body.wordGoal);
    const changes = {};
    for (const field of fields) {
        if (req.body[field] === undefined)
            continue;
        if (["chapters", "characters", "themes", "plotlines", "notes"].includes(field)) {
            if (!Array.isArray(req.body[field]))
                throw new errorService_1.AppError("Invalid manuscript items", 400);
            const incoming = req.body[field].map((item) => {
                const copy = Object.assign({}, item);
                if (typeof item.id === "string" && /^[a-f0-9]{24}$/i.test(item.id))
                    copy._id = item.id;
                delete copy.id;
                return copy;
            });
            const ids = new Set(incoming.map((item) => String(item._id)));
            const stored = current[field] ||
                [];
            changes[field] = [
                ...incoming,
                ...stored.filter(item => item.isArchived && !ids.has(String(item._id))),
            ];
        }
        else
            changes[field] = req.body[field];
    }
    try {
        (0, planningValidation_1.validatePlanning)(Object.assign(Object.assign({}, current), changes), id);
    }
    catch (error) {
        throw new errorService_1.AppError(error.message, 400);
    }
    // Atomic compare-and-swap protects simultaneous requests too.
    const book = yield bookModel_1.BookModel.findOneAndUpdate({ _id: id, userId: loggedInUserId, updatedAt: current.updatedAt }, {
        $set: Object.assign(Object.assign({}, changes), { updatedAt: new Date(Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1)) }),
    }, { new: true, runValidators: true, timestamps: false });
    if (!book)
        throw new errorService_1.AppError("This manuscript changed while saving. Export your draft and reload.", 409);
    res.json({ status: "success", data: book });
}));
exports.updateBook = updateBook;
function validateWordGoal(value) {
    if (value !== undefined && !(0, bookSchema_1.isWordGoal)(value))
        throw new errorService_1.AppError("Manuscript word goal must be a whole number from 1 to 10,000,000.", 400);
}
//# sourceMappingURL=bookController.js.map