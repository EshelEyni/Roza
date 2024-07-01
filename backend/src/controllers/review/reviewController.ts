import {
  getOne,
  createOne,
  updateOne,
  deleteOne,
  getAll,
} from "../../services/factory/factoryService";
import { BookReviewModel } from "../../models/review/reviewModel";

const getBookReviews = getAll(BookReviewModel);
const getBookReviewById = getOne(BookReviewModel);
const addBookReview = createOne(BookReviewModel);
const updateBookReview = updateOne(BookReviewModel);
const removeBookReview = deleteOne(BookReviewModel);

export { getBookReviews, getBookReviewById, addBookReview, updateBookReview, removeBookReview };
