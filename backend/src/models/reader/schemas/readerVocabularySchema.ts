import { Schema } from "mongoose";

const readerVocabularySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    headword: { type: String, required: true },
    entry: { type: Schema.Types.Mixed, required: true },
    lookupCount: { type: Number, required: true },
    observedForms: [String],
    bookIds: [Schema.Types.ObjectId],
    firstLookedUpAt: { type: Date, required: true },
    lastLookedUpAt: { type: Date, required: true },
  },
  { timestamps: true },
);
readerVocabularySchema.index({ userId: 1, headword: 1 }, { unique: true });

// A unique event makes retries idempotent without an ever-growing array on a word document.
const readerLookupSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    requestId: { type: String, required: true },
    provider: { type: String, enum: ["auto", "google"], default: "auto" },
    headword: { type: String, required: true },
    word: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    location: { type: String, default: "" },
  },
  { timestamps: true },
);
readerLookupSchema.index({ userId: 1, requestId: 1 }, { unique: true });
readerLookupSchema.index({ userId: 1, headword: 1, createdAt: 1 });

export { readerVocabularySchema, readerLookupSchema };
