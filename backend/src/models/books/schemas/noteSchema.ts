import { Schema } from "mongoose";
import { INote } from "../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

const noteSchema = new Schema<INote>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
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
      enum: ["notes"],
      default: "notes",
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

export { noteSchema };
