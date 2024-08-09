import { Schema } from "mongoose";
import { IReference } from "./../../../types/iTypes";
import { SlateCustomElementSchema } from "../../schemas/slateElementSchema";
import { getDefaultSlateElement } from "../../../services/util/utilService";

const referenceSchema = new Schema<IReference>(
  {
    pages: {
      type: String,
      default: "",
    },
    text: {
      type: [SlateCustomElementSchema],
      default: getDefaultSlateElement(),
    },
    imgs: {
      type: [String],
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isMinimized: {
      type: Boolean,
      default: false,
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

export { referenceSchema };
