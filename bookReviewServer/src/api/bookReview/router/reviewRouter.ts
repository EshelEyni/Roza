import express from "express";
import {
  getBookReviews,
  getBookReviewById,
  addBookReview,
  updateBookReview,
  removeBookReview,
} from "../controller/reviewController";
import { checkUserAuthentication } from "@rozaeyni/common";

const router = express.Router();
router.use(checkUserAuthentication);
router.get("/", getBookReviews);
router.get("/:id([a-fA-F0-9]{24})", getBookReviewById);
router.post("/", addBookReview);
router.patch("/:id", updateBookReview);
router.delete("/:id", removeBookReview);

export default router;
