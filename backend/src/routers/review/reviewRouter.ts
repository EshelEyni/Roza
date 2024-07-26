import express from "express";
import {
  getBookReviews,
  getBookReviewById,
  addBookReview,
  updateBookReview,
} from "../../controllers/review/reviewController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();
router.use(checkUserAuthentication);
router.get("/", getBookReviews);
router.get("/:id([a-fA-F0-9]{24})", getBookReviewById);
router.post("/", addBookReview);
router.patch("/:id", upload.array("imgs"), updateBookReview);

export default router;
