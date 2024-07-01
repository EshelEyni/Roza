import { Document, Schema } from "mongoose";
import { chapterSchema } from "./chapterScehma";
import { IBook } from "../../../types/iTypes";
import { characterSchema } from "./characterSchema";
import { themeSchema } from "./themeSchema";
import { plotlineSchema } from "./plotlineScheme";
import { noteSchema } from "./noteSchema";

const bookSchema = new Schema<IBook>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a user Id"],
    },
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },
    chapters: [chapterSchema],
    characters: [characterSchema],
    themes: [themeSchema],
    plotlines: [plotlineSchema],
    notes: [noteSchema],
    filterBy: {
      type: String,
      enum: ["chapters", "characters", "themes", "plotlines", "notes"],
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

export { bookSchema };
