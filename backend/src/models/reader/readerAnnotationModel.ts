import { Schema, model } from "mongoose";
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    cfi: { type: String, required: true, maxlength: 4096 },
    endCfi: { type: String, maxlength: 4096, default: "" },
    text: { type: String, required: true, maxlength: 100000 },
    chapter: { type: String, maxlength: 1000, default: "" },
    color: { type: String, enum: ["none", "yellow", "green", "blue", "pink"], required: true },
    note: { type: String, maxlength: 10000, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, result) => {
        delete result._id;
        delete result.__v;
        delete result.userId;
        delete result.bookId;
      },
    },
  },
);
// Identical passages share one annotation; partially overlapping passages are independent.
schema.index({ userId: 1, bookId: 1, cfi: 1, endCfi: 1 }, { unique: true });
export const ReaderAnnotationModel = model("ReaderAnnotation", schema, "reader_annotations");
