"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerLookupSchema = exports.readerVocabularySchema = void 0;
const mongoose_1 = require("mongoose");
const readerVocabularySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    reviewHiddenBookIds: [mongoose_1.Schema.Types.ObjectId],
    reviewedBookIds: [mongoose_1.Schema.Types.ObjectId],
    headword: { type: String, required: true },
    entry: { type: mongoose_1.Schema.Types.Mixed, required: true },
    lookupCount: { type: Number, required: true },
    observedForms: [String],
    bookIds: [mongoose_1.Schema.Types.ObjectId],
    firstLookedUpAt: { type: Date, required: true },
    lastLookedUpAt: { type: Date, required: true },
}, { timestamps: true });
exports.readerVocabularySchema = readerVocabularySchema;
readerVocabularySchema.index({ userId: 1, headword: 1 }, { unique: true });
// A unique event makes retries idempotent without an ever-growing array on a word document.
const readerLookupSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    requestId: { type: String, required: true },
    provider: { type: String, enum: ["auto", "google"], default: "auto" },
    headword: { type: String, required: true },
    word: { type: String, required: true },
    bookId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    location: { type: String, default: "" },
}, { timestamps: true });
exports.readerLookupSchema = readerLookupSchema;
readerLookupSchema.index({ userId: 1, requestId: 1 }, { unique: true });
readerLookupSchema.index({ userId: 1, headword: 1, createdAt: 1 });
//# sourceMappingURL=readerVocabularySchema.js.map