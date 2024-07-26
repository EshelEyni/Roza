import { Schema } from "mongoose";
import { IChapter } from "../../../types/iTypes";

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
    isArchived: {
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
    },
    toJSON: {
      virtuals: true,
    },
    timestamps: true,
  },
);

export { chapterSchema };
