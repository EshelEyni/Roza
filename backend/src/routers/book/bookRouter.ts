import express from "express";
import { editChapterText } from "../../controllers/book/writingAiController";
import { addBook, getBookById, getBooks, updateBook } from "../../controllers/book/bookController";

const router = express.Router();

router.get("/", getBooks);
router.get("/:id([a-fA-F0-9]{24})", getBookById);
router.post("/:id([a-fA-F0-9]{24})/chapters/:chapterId([a-fA-F0-9]{24})/ai-edit", editChapterText);
router.post("/", addBook);
router.patch("/:id", updateBook);

export default router;
