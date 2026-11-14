import { Schema, model } from "mongoose";
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    cfi: { type: String, required: true, maxlength: 4096 },
    endCfi: { type: String, default: "", maxlength: 4096 },
    text: { type: String, required: true, maxlength: 100000 },
    chapter: { type: String, default: "", maxlength: 1000 },
    context: { type: String, default: "", maxlength: 100000 },
    reviewed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, result) => {
        delete result._id;
        delete result.__v;
        delete result.userId;
      },
    },
  },
);
schema.index({ userId: 1, bookId: 1, cfi: 1, endCfi: 1 }, { unique: true });
export const ReaderFlagModel = model("ReaderFlag", schema, "reader_flags");
