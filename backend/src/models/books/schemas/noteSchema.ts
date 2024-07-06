import { Document, Schema } from "mongoose";
import { INote } from "../../../types/iTypes";

const noteSchema = new Schema<INote>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    text: {
      type: String,
      required: [true, "Please provide a note"],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
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

export { noteSchema };
