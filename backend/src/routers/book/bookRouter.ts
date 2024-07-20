import express from "express";
import { addBook, getBookById, getBooks, updateBook } from "../../controllers/book/bookController";

const router = express.Router();

router.get("/", getBooks);
router.get("/:id([a-fA-F0-9]{24})", getBookById);
router.post("/", addBook);
router.patch("/:id", updateBook);

export default router;
