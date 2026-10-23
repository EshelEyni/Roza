import { Schema } from "mongoose";
import { IReaderBook } from "../../../types/iTypes";

const readerBookSchema = new Schema<IReaderBook>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
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
      preferences: {
        fontSize: { type: Number, default: 20, min: 14, max: 36 },
        fontFamily: { type: String, enum: ["serif", "sans-serif"], default: "serif" },
        lineHeight: { type: Number, default: 1.7, min: 1.2, max: 2.4 },
        width: { type: String, enum: ["comfortable", "wide"], default: "comfortable" },
        theme: { type: String, enum: ["light", "sepia", "dark"], default: "sepia" },
        flow: { type: String, enum: ["paginated", "scrolled"], default: "paginated" },
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
        return result;
      },
    },
  },
);

readerBookSchema.index({ userId: 1, updatedAt: -1 });

export { readerBookSchema };
