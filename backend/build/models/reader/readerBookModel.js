"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderBookModel = void 0;
const mongoose_1 = require("mongoose");
const readerBookSchema_1 = require("./schemas/readerBookSchema");
const ReaderBookModel = (0, mongoose_1.model)("ReaderBook", readerBookSchema_1.readerBookSchema, "reader_books");
exports.ReaderBookModel = ReaderBookModel;
//# sourceMappingURL=readerBookModel.js.map