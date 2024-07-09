import express from "express";
import {
  addBook,
  getBookById,
  getBooks,
  updateBook,
  removeBook,
} from "../controller/bookController";
import { checkUserAuthentication } from "@rozaeyni/common";

const router = express.Router();

router.use(checkUserAuthentication);
router.get("/", getBooks);
router.get("/:id([a-fA-F0-9]{24})", getBookById);
router.post("/", addBook);
router.patch("/:id", updateBook);
router.delete("/:id", removeBook);

export default router;
