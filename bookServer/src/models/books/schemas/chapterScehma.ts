import { IChapter } from "@rozaeyni/common";
import { Document, Schema } from "mongoose";

const chapterSchema = new Schema<IChapter>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    name: {
      type: String,
      default: "פרק חדש",
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["chapters"],
      default: "chapters",
    },
  },
  {
    toObject: {
      virtuals: true,
      transform: (_: Document, ret: Record<string, unknown>) => {
        delete ret._id;
        return ret;
      },
    },
    toJSON: {
      virtuals: true,
      transform: (_: Document, ret: Record<string, unknown>) => {
        delete ret._id;
        return ret;
      },
    },
    timestamps: true,
  },
);

export { chapterSchema };
