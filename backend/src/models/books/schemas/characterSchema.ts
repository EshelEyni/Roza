import { Schema } from "mongoose";
import { ICharacter } from "../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

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
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["characters"],
      default: "characters",
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

export { characterSchema };
