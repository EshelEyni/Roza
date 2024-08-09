import { Schema } from "mongoose";

import { IPlotline } from "../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

const plotlineSchema = new Schema<IPlotline>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide a book id"],
    },
    name: {
      type: String,
      default: "plotline",
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
      enum: ["plotlines"],
      default: "plotlines",
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

export { plotlineSchema };
