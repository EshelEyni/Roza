import { Schema } from "mongoose";
import { ITheme } from "../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

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
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["themes"],
      default: "themes",
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

export { themeSchema };
