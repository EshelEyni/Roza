import { Schema } from "mongoose";
import { readerAiConfig } from "../../../services/reader/readerAiConfig";
import { IReaderConversation } from "../../../types/iTypes";

const readerConversationSchema = new Schema<IReaderConversation>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    bookId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 100 },
    passage: {
      type: new Schema(
        {
          cfi: { type: String, required: true },
          text: { type: String, required: true },
          endCfi: String,
        },
        { _id: false },
      ),
      default: undefined,
    },
    contextOmittedTurns: { type: Number, default: 0 },
    spoilersAllowed: { type: Boolean, default: false },
    lockedUntil: { type: Date, default: new Date(0), select: false },
    lockToken: { type: String, select: false },
    turns: [
      {
        _id: false,
        id: { type: String, required: true },
        question: { type: String, required: true, maxlength: readerAiConfig.maxQuestionChars },
        currentCfi: { type: String, required: true },
        spoilersAllowed: { type: Boolean, default: false },
        answer: { type: String, default: "", maxlength: readerAiConfig.maxAnswerChars },
        status: { type: String, enum: ["pending", "completed", "failed"], required: true },
        passage: {
          type: new Schema({ cfi: String, endCfi: String, text: String }, { _id: false }),
          default: undefined,
        },
        excerpts: { type: [new Schema({ label: String, text: String }, { _id: false })], default: undefined },
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
