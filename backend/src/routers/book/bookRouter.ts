import express from "express";
import {
  addBook,
  getBookById,
  getBooks,
  updateBook,
  removeBook,
} from "../../controllers/book/bookController";

const router = express.Router();

router.get("/", getBooks);
router.get("/:id([a-fA-F0-9]{24})", getBookById);
router.post("/", addBook);
router.patch("/:id", updateBook);
router.delete("/:id", removeBook);

export default router;
