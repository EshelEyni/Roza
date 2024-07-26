import { Schema } from "mongoose";
import { IImage, IReference } from "./../../../types/iTypes";

const imageSchema = new Schema<IImage>({
  data: Buffer,
  contentType: String,
});

const referenceSchema = new Schema<IReference>(
  {
    page: {
      type: String,
    },
    text: {
      type: String,
      trim: true,
    },
    imgs: {
      type: [imageSchema],
    },
    isArchived: {
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
