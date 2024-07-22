import { Schema } from "mongoose";
import { IReview } from "../../../types/iTypes";

const reviewSchema = new Schema<IReview>(
  {
    text: {
      type: String,
      required: [true, "Please provide a text"],
      trim: true,
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

export { reviewSchema };
