import { Schema } from "mongoose";
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
  },
  { timestamps: true },
);

export { noteSchema };
