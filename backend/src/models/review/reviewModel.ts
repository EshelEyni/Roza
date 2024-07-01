import { model } from "mongoose";
import { bookReviewSchema } from "./schemas/bookReviewSchema";
import { IBookReview } from "../../types/iTypes";

const BookReviewModel = model<IBookReview>("BookReview", bookReviewSchema, "reviews");

export { BookReviewModel };
