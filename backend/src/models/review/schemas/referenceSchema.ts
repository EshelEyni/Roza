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
    sortOrder: {
      type: Number,
      default: 0,
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
