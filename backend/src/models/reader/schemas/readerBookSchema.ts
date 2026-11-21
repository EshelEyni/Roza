import { Schema } from "mongoose";
import { IReaderBook } from "../../../types/iTypes";

const readerBookSchema = new Schema<IReaderBook>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    archived: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    customRank: Number,
    audiobookNarrator: {
      type: new Schema({
        engine: { type: String, enum: ["system", "openai", "kokoro"], required: true },
        voice: { type: String, required: true, maxlength: 1024 },
        name: { type: String, required: true, maxlength: 256 },
        lang: { type: String, maxlength: 32 },
      }, { _id: false }),
      default: undefined,
    },
    title: { type: String, required: true },
    author: { type: String, default: "" },
    cover: { type: String, default: "" },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    fileId: { type: Schema.Types.ObjectId, required: true, select: false },
    originalFileId: { type: Schema.Types.ObjectId, required: true, select: false },
    state: {
      location: { type: String, default: "" },
      progress: { type: Number, default: 0, min: 0, max: 1 },
      savedAt: { type: Number, default: 0 },
      mode: { type: String, enum: ["page", "sentence", "audiobook"] },
      preferences: {
        fontSize: { type: Number, default: 20, min: 14, max: 56 },
        fontFamily: { type: String, enum: ["serif", "sans-serif"], default: "serif" },
        lineHeight: { type: Number, default: 1.7, min: 1.2, max: 2.4 },
        width: { type: String, enum: ["comfortable", "wide"], default: "comfortable" },
        theme: { type: String, enum: ["light", "sepia", "dark"], default: "sepia" },
        flow: { type: String, enum: ["paginated", "scrolled"], default: "paginated" },
        backgroundColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        selectionTextColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        selectionColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        passageTextColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        translationTextColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        passageColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        translationColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
        pageNumbering: { type: String, enum: ["screen", "publisher"], default: "screen" },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_document, result) => {
        delete result._id;
        delete result.__v;
        delete result.fileId;
        delete result.originalFileId;
        delete result.userId;
        delete result.customRank;
        return result;
      },
    },
  },
);

readerBookSchema.index({ userId: 1, updatedAt: -1 });

export { readerBookSchema };
