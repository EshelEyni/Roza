import { Document, Schema } from "mongoose";
import { IBookReview } from "../../../types/iTypes";
import { referenceSchema } from "./referenceSchema";
import { reviewSchema } from "./reviewSchema";

const bookReviewSchema = new Schema<IBookReview>(
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
    reviews: [reviewSchema],
    references: [referenceSchema],
    sortOrder: {
      type: Number,
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

bookReviewSchema.index({ name: "text", "reviews.text": "text", "references.text": "text" });

export { bookReviewSchema };
