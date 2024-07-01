import { Document, Schema } from "mongoose";
import { IReview } from "../../../types/iTypes";

const reviewSchema = new Schema<IReview>(
  {
    text: {
      type: String,
      required: [true, "Please provide a text"],
      trim: true,
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

export { reviewSchema };
