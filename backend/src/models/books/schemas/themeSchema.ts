import { Schema } from "mongoose";
import { ITheme } from "../../../types/iTypes";

const themeSchema = new Schema<ITheme>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export { themeSchema };
