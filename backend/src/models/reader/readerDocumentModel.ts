import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // Slate rich text, validated by readerDocumentContent before every write.
    content: { type: Schema.Types.Mixed, required: true },
    preview: { type: String, default: "", maxlength: 200 },
  },
  {
    timestamps: true,
    minimize: false,
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
schema.index({ userId: 1, bookId: 1, updatedAt: -1 });
export const ReaderDocumentModel = model("ReaderDocument", schema, "reader_documents");
