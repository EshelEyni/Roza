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
const bookModel_1 = require("../../models/books/bookModel");
const errorService_1 = require("../../services/error/errorService");
const ALSService_1 = require("../../services/ALSService");
// interface BookWithScore extends Book {
//   score: number;
// }
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
    // let sortedBooks = books;
    // if (searchTerm && typeof searchTerm === "string") {
    //   sortedBooks = (books as BookWithScore[]).sort((a, b) => {
    //     const aNameMatch = a.name.includes(searchTerm) ? 1 : 0;
    //     const bNameMatch = b.name.includes(searchTerm) ? 1 : 0;
    //     // Sort by name match first
    //     if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;
    //     const aChaptersMatch = a.chapters.some(c => c.text.includes(searchTerm)) ? 1 : 0;
    //     const bChaptersMatch = b.chapters.some(c => c.text.includes(searchTerm)) ? 1 : 0;
    //     if (aChaptersMatch !== bChaptersMatch) {
    //       return bChaptersMatch - aChaptersMatch; // Sort by chapters match next
    //     }
    //     const aCharactersMatch = a.characters.some(c => c.description.includes(searchTerm)) ? 1 : 0;
    //     const bCharactersMatch = b.characters.some(c => c.description.includes(searchTerm)) ? 1 : 0;
    //     if (aCharactersMatch !== bCharactersMatch) {
    //       return bCharactersMatch - aCharactersMatch; // Sort by characters match next
    //     }
    //     const aThemesMatch = a.themes.some(t => t.description.includes(searchTerm)) ? 1 : 0;
    //     const bThemesMatch = b.themes.some(t => t.description.includes(searchTerm)) ? 1 : 0;
    //     // Sort by themes match next
    //     if (aThemesMatch !== bThemesMatch) return bThemesMatch - aThemesMatch;
    //     const aPlotlinesMatch = a.plotlines.some(p => p.description.includes(searchTerm)) ? 1 : 0;
    //     const bPlotlinesMatch = b.plotlines.some(p => p.description.includes(searchTerm)) ? 1 : 0;
    //     // Sort by plotlines match next
    //     if (aPlotlinesMatch !== bPlotlinesMatch) return bPlotlinesMatch - aPlotlinesMatch;
    //     const aNotesMatch = a.notes.some(n => n.text.includes(searchTerm)) ? 1 : 0;
    //     const bNotesMatch = b.notes.some(n => n.text.includes(searchTerm)) ? 1 : 0;
    //     // Sort by notes match next
    //     if (aNotesMatch !== bNotesMatch) return bNotesMatch - aNotesMatch;
    //     // Use text score as the final tie-breaker
    //     return (b.score || 0) - (a.score || 0);
    //   });
    // }
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
    const book = yield bookModel_1.BookModel.findOneAndUpdate({ _id: id, userId: loggedInUserId }, req.body, {
        new: true,
        runValidators: true,
    });
    res.json({
        status: "success",
        data: book,
    });
}));
exports.updateBook = updateBook;
//# sourceMappingURL=bookController.js.map