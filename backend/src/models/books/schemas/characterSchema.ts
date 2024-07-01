import { Schema } from "mongoose";
import { ICharacter } from "../../../types/iTypes";

const characterSchema = new Schema<ICharacter>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    name: {
      type: String,
      default: "character",
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

export { characterSchema };
