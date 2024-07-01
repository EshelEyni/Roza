import express from "express";
import {
  getBookReviews,
  getBookReviewById,
  addBookReview,
  updateBookReview,
  removeBookReview,
} from "../../controllers/review/reviewController";

const router = express.Router();

router.get("/", getBookReviews);
router.get("/:id([a-fA-F0-9]{24})", getBookReviewById);
router.post("/", addBookReview);
router.patch("/:id", updateBookReview);
router.delete("/:id", removeBookReview);

export default router;
