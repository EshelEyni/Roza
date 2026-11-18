"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderLookupModel = exports.ReaderVocabularyModel = void 0;
const mongoose_1 = require("mongoose");
const readerVocabularySchema_1 = require("./schemas/readerVocabularySchema");
exports.ReaderVocabularyModel = (0, mongoose_1.model)("ReaderVocabulary", readerVocabularySchema_1.readerVocabularySchema, "reader_vocabulary");
exports.ReaderLookupModel = (0, mongoose_1.model)("ReaderLookup", readerVocabularySchema_1.readerLookupSchema, "reader_lookups");
//# sourceMappingURL=readerVocabularyModel.js.map