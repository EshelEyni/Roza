import express from "express";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { requireFeature } from "../../middlewares/authGuards/featureAccessMiddleware";
import { editChapterText } from "../../controllers/book/writingAiController";
import { addBook, getBookById, getBooks, updateBook } from "../../controllers/book/bookController";

import { loadStudioNarrator, saveStudioNarrator } from "../../controllers/book/studioNarratorController";

const router = express.Router();
router.use(checkUserAuthentication, requireFeature("writingStudio"));

router.get("/", getBooks);
router.get("/:id([a-fA-F0-9]{24})", getBookById);
router.post("/:id([a-fA-F0-9]{24})/chapters/:chapterId([a-fA-F0-9]{24})/ai-edit", editChapterText);
router.get("/:id([a-fA-F0-9]{24})/audiobook/narrator", loadStudioNarrator);
router.patch("/:id([a-fA-F0-9]{24})/audiobook/narrator", saveStudioNarrator);
router.post("/", addBook);
router.patch("/:id", updateBook);

export default router;
