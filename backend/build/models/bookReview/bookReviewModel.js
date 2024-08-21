"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookReviewModel = void 0;
const mongoose_1 = require("mongoose");
const bookReviewSchema_1 = require("./schemas/bookReviewSchema");
const BookReviewModel = (0, mongoose_1.model)("BookReview", bookReviewSchema_1.bookReviewSchema, "book_reviews");
exports.BookReviewModel = BookReviewModel;
//# sourceMappingURL=bookReviewModel.js.map