"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookModel = void 0;
const mongoose_1 = require("mongoose");
const bookSchema_1 = require("./schemas/bookSchema");
const BookModel = (0, mongoose_1.model)("Book", bookSchema_1.bookSchema, "books");
exports.BookModel = BookModel;
//# sourceMappingURL=bookModel.js.map