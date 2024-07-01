import { Schema } from "mongoose";

const chapterSchema = new Schema(
  {
    bookId: {
      type: String,
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
  },
  { timestamps: true },
);

export { chapterSchema };
