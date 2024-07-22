import { Schema } from "mongoose";
import { IReference } from "./../../../types/iTypes";

const referenceSchema = new Schema<IReference>(
  {
    page: {
      type: String,
    },
    text: {
      type: String,
      trim: true,
    },
    imgUrls: {
      type: [String],
    },
    isArchived: {
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
