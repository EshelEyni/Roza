import express from "express";
import {
  getBookReviews,
  getBookReviewById,
  addBookReview,
  updateBookReview,
} from "../../controllers/bookReview/bookReviewController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";

const router = express.Router();
router.use(checkUserAuthentication);
router.get("/", getBookReviews);
router.get("/:id([a-fA-F0-9]{24})", getBookReviewById);
router.post("/", addBookReview);
router.patch("/:id", updateBookReview);

export default router;
