import { Schema } from "mongoose";
import { IChapter } from "../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

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
    description: {
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
    },
    text: {
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
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
