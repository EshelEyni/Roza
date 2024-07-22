import { Document, Query, Schema } from "mongoose";
import { IBookReview, IReference, IReview } from "../../../types/iTypes";
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
    isArchived: {
      type: Boolean,
      default: false,
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

bookReviewSchema.pre("save", async function (next) {
  const userId = this.get("userId");
  const lastSortOrder = (await this.model("BookReview")
    .findOne(
      { userId },
      {
        sortOrder: 1,
      },
      { sort: { sortOrder: -1 }, lean: true },
    )
    .exec()) as IBookReview;
  if (this.isNew) this.sortOrder = lastSortOrder ? lastSortOrder.sortOrder + 1 : 0;

  next();
});

bookReviewSchema.pre(/^find/, async function (this: Query<Document, Document>, next) {
  this.find({ isArchived: { $ne: true } });

  next();
});

bookReviewSchema.post(/^find/, async function (data, next) {
  if (!data) return next();
  if (Array.isArray(data)) for (const doc of data) filterArchivedItems(doc);
  else filterArchivedItems(data);
});

function filterArchivedItems(doc: IBookReview) {
  doc.reviews = doc.reviews.filter((r: IReview) => !r.isArchived);
  doc.references = doc.references.filter((r: IReference) => !r.isArchived);
}

bookReviewSchema.index({ name: "text", "reviews.text": "text", "references.text": "text" });

export { bookReviewSchema };
