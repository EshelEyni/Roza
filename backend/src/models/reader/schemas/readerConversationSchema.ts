import { Schema } from "mongoose";
import { IReaderConversation } from "../../../types/iTypes";

const readerConversationSchema = new Schema<IReaderConversation>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 100 },
    passage: {
      type: new Schema(
        { cfi: { type: String, required: true }, text: { type: String, required: true } },
        { _id: false },
      ),
      default: undefined,
    },
    spoilersAllowed: { type: Boolean, default: false },
    lockedUntil: { type: Date, default: new Date(0), select: false },
    lockToken: { type: String, select: false },
    turns: [
      {
        _id: false,
        id: { type: String, required: true },
        question: { type: String, required: true, maxlength: 2000 },
        currentCfi: { type: String, required: true },
        spoilersAllowed: { type: Boolean, default: false },
        answer: { type: String, default: "", maxlength: 16000 },
        status: { type: String, enum: ["pending", "completed", "failed"], required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_document, result) => {
        delete result._id;
        delete result.__v;
        delete result.userId;
        delete result.lockedUntil;
        delete result.lockToken;
        return result;
      },
    },
  },
);
readerConversationSchema.index({ userId: 1, bookId: 1, updatedAt: -1, _id: -1 });
export { readerConversationSchema };
