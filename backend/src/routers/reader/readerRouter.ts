import express from "express";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { checkReaderAccess } from "../../services/reader/readerAccessService";
import { MAX_EPUB_SIZE } from "../../services/reader/epubService";
import { AppError } from "../../services/error/errorService";
import {
  getReaderAccess,
  getReaderBooks,
  addReaderBook,
  getReaderBook,
  getReaderFile,
  updateReaderState,
} from "../../controllers/reader/readerController";

import {
  chatLimiter,
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  sendMessage,
} from "../../controllers/reader/readerChatController";

import {
  getAiSettings,
  updateAiSettings,
} from "../../controllers/reader/readerAiSettingsController";
import { lookupReaderDictionary } from "../../controllers/reader/readerDictionaryController";

const router = express.Router();

router.use(checkUserAuthentication);
router.get("/access", getReaderAccess);
router.use(checkReaderAccess);
router.get("/ai-settings", getAiSettings);
router.patch("/ai-settings", updateAiSettings);
router.get("/", getReaderBooks);
const readUpload = express.raw({ type: "application/epub+zip", limit: MAX_EPUB_SIZE });
router.post(
  "/",
  (req, res, next) => {
    readUpload(req, res, (error: { status?: number } | undefined) => {
      if (error)
        return next(
          new AppError(
            error.status === 413
              ? "Upload an EPUB smaller than 25 MiB."
              : "Could not read the upload.",
            error.status === 413 ? 413 : 400,
          ),
        );
      next();
    });
  },
  addReaderBook,
);
router.get("/:id/conversations", listConversations);
router.post("/:id/conversations", createConversation);
router.get("/:id/conversations/:conversationId", getConversation);
router.delete("/:id/conversations/:conversationId", deleteConversation);
router.post("/:id/conversations/:conversationId/messages", chatLimiter, sendMessage);
router.post("/:id/dictionary", lookupReaderDictionary);
router.get("/:id/file", getReaderFile);
router.get("/:id", getReaderBook);
router.patch("/:id/state", updateReaderState);

export default router;
