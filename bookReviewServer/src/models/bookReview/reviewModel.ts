import { model } from "mongoose";
import { bookReviewSchema } from "./schemas/bookReviewSchema";
import { IBookReview } from "@rozaeyni/common";

const BookReviewModel = model<IBookReview>("BookReview", bookReviewSchema, "reviews");

export { BookReviewModel };
