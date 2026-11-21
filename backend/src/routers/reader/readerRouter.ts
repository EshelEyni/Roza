import readerAudiobookRouter from "./readerAudiobookRouter";
import express from "express";
import { listAnnotations, saveAnnotation, deleteAnnotation } from "../../controllers/reader/readerAnnotationController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { checkReaderAccess } from "../../services/reader/readerAccessService";
import { MAX_EPUB_SIZE } from "../../services/reader/epubService";
import { AppError } from "../../services/error/errorService";
import {
  getReaderAccess,
  getReaderBooks,
  updateReaderBookPin,
  updateReaderBookOrder,
  addReaderBook,
  getReaderBook,
  getReaderFile,
  updateReaderState,
  updateReaderBookArchive,
  renameReaderBook,
  deleteReaderBook,
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

import { getKeyboardSettings, updateKeyboardSettings } from "../../controllers/reader/readerKeyboardSettingsController";

import { getProgressSettings, updateProgressSettings } from "../../controllers/reader/readerProgressSettingsController";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../../controllers/reader/readerDocumentController";
import { getReview, listFlags, saveFlag, updateFlag, translateFlag, updateVocabularyReview } from "../../controllers/reader/readerReviewController";

const router = express.Router();

router.use(checkUserAuthentication);
router.get("/access", getReaderAccess);
router.use(checkReaderAccess);
router.use("/:id/audiobook", readerAudiobookRouter);
router.get("/progress-settings", getProgressSettings);
router.patch("/progress-settings", updateProgressSettings);
router.get("/:id/review", getReview);
router.patch("/:id/review/vocabulary/:vocabularyId", updateVocabularyReview);
router.delete("/:id/review/vocabulary/:vocabularyId", updateVocabularyReview);
router.get("/:id/flags", listFlags);
router.put("/:id/flags", saveFlag);
router.patch("/:id/flags/:flagId", updateFlag);
router.delete("/:id/flags/:flagId", updateFlag);
router.post("/:id/flags/:flagId/translation", translateFlag);
router.get("/keyboard-settings", getKeyboardSettings);
router.patch("/keyboard-settings", updateKeyboardSettings);
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
router.get("/:id/annotations", listAnnotations);
router.put("/:id/annotations", saveAnnotation);
router.delete("/:id/annotations/:annotationId", deleteAnnotation);
router.get("/:id/documents", listDocuments);
router.post("/:id/documents", createDocument);
router.get("/:id/documents/:documentId", getDocument);
router.patch("/:id/documents/:documentId", updateDocument);
router.delete("/:id/documents/:documentId", deleteDocument);
router.get("/:id/conversations", listConversations);
router.post("/:id/conversations", createConversation);
router.get("/:id/conversations/:conversationId", getConversation);
router.delete("/:id/conversations/:conversationId", deleteConversation);
router.post("/:id/conversations/:conversationId/messages", chatLimiter, sendMessage);
router.post("/:id/dictionary", lookupReaderDictionary);
router.get("/:id/file", getReaderFile);
router.get("/:id", getReaderBook);
router.patch("/:id/state", updateReaderState);
router.patch("/:id/archive", updateReaderBookArchive);
router.patch("/:id/pin", updateReaderBookPin);
router.patch("/:id/order", updateReaderBookOrder);
router.patch("/:id/title", renameReaderBook);
router.delete("/:id", deleteReaderBook);

export default router;
