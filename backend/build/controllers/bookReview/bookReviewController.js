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
exports.updateBookReview = exports.addBookReview = exports.getBookReviewById = exports.getBookReviews = void 0;
const bookReviewModel_1 = require("../../models/bookReview/bookReviewModel");
const errorService_1 = require("../../services/error/errorService");
const ALSService_1 = require("../../services/ALSService");
// interface BookwReviewWithScore extends BookReview {
//   score: number;
// }
const getBookReviews = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    if (!loggedInUserId)
        return next(new errorService_1.AppError("User not logged in", 401));
    const { limit, sort, searchTerm } = req.query;
    const query = bookReviewModel_1.BookReviewModel.find({ userId: loggedInUserId, isArchived: false })
        .limit(limit ? parseInt(limit.toString()) : 10)
        .sort(sort ? sort.toString() : "sortOrder");
    if (searchTerm) {
        query.find({ $text: { $search: searchTerm.toString() } }, { score: { $meta: "textScore" } });
        query.sort({ score: { $meta: "textScore" } });
    }
    const reviews = (yield query.exec());
    // let sortedReviews = reviews;
    // if (searchTerm && typeof searchTerm === "string") {
    //   sortedReviews = (reviews as BookwReviewWithScore[]).sort((a, b) => {
    //     const aNameMatch = a.name.includes(searchTerm) ? 1 : 0;
    //     const bNameMatch = b.name.includes(searchTerm) ? 1 : 0;
    //     if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;
    //     const aReviewsMatch = a.reviews.some(r => r.text.includes(searchTerm)) ? 1 : 0;
    //     const bReviewsMatch = b.reviews.some(r => r.text.includes(searchTerm)) ? 1 : 0;
    //     if (aReviewsMatch !== bReviewsMatch) return bReviewsMatch - aReviewsMatch;
    //     return b.score - a.score;
    //   });
    // }
    res.json({
        status: "success",
        requestedAt: new Date().toISOString(),
        results: reviews.length,
        data: reviews,
    });
}));
exports.getBookReviews = getBookReviews;
const getBookReviewById = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    const review = yield bookReviewModel_1.BookReviewModel.findOne({
        _id: id,
        userId: loggedInUserId,
        isArchived: false,
    });
    if (!review)
        return next(new errorService_1.AppError("Review not found", 404));
    res.json({
        status: "success",
        data: review,
    });
}));
exports.getBookReviewById = getBookReviewById;
const addBookReview = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    const review = yield bookReviewModel_1.BookReviewModel.create(Object.assign(Object.assign({}, req.body), { userId: loggedInUserId }));
    res.status(201).json({
        status: "success",
        data: review,
    });
}));
exports.addBookReview = addBookReview;
const updateBookReview = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    const review = yield bookReviewModel_1.BookReviewModel.findOneAndUpdate({ _id: id, userId: loggedInUserId }, req.body, {
        new: true,
        runValidators: true,
    });
    if (!review)
        return next(new errorService_1.AppError("Review not found", 404));
    res.json({
        status: "success",
        data: review,
    });
}));
exports.updateBookReview = updateBookReview;
//# sourceMappingURL=bookReviewController.js.map