"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readerAudiobookRouter_1 = __importDefault(require("./readerAudiobookRouter"));
const express_1 = __importDefault(require("express"));
const readerAnnotationController_1 = require("../../controllers/reader/readerAnnotationController");
const authGuardsMiddleware_1 = require("../../middlewares/authGuards/authGuardsMiddleware");
const readerAccessService_1 = require("../../services/reader/readerAccessService");
const epubService_1 = require("../../services/reader/epubService");
const errorService_1 = require("../../services/error/errorService");
const readerController_1 = require("../../controllers/reader/readerController");
const readerChatController_1 = require("../../controllers/reader/readerChatController");
const readerAiSettingsController_1 = require("../../controllers/reader/readerAiSettingsController");
const readerDictionaryController_1 = require("../../controllers/reader/readerDictionaryController");
const readerKeyboardSettingsController_1 = require("../../controllers/reader/readerKeyboardSettingsController");
const readerProgressSettingsController_1 = require("../../controllers/reader/readerProgressSettingsController");
const readerReviewController_1 = require("../../controllers/reader/readerReviewController");
const router = express_1.default.Router();
router.use(authGuardsMiddleware_1.checkUserAuthentication);
router.get("/access", readerController_1.getReaderAccess);
router.use(readerAccessService_1.checkReaderAccess);
router.use("/:id/audiobook", readerAudiobookRouter_1.default);
router.get("/progress-settings", readerProgressSettingsController_1.getProgressSettings);
router.patch("/progress-settings", readerProgressSettingsController_1.updateProgressSettings);
router.get("/:id/review", readerReviewController_1.getReview);
router.patch("/:id/review/vocabulary/:vocabularyId", readerReviewController_1.updateVocabularyReview);
router.delete("/:id/review/vocabulary/:vocabularyId", readerReviewController_1.updateVocabularyReview);
router.get("/:id/flags", readerReviewController_1.listFlags);
router.put("/:id/flags", readerReviewController_1.saveFlag);
router.patch("/:id/flags/:flagId", readerReviewController_1.updateFlag);
router.delete("/:id/flags/:flagId", readerReviewController_1.updateFlag);
router.post("/:id/flags/:flagId/translation", readerReviewController_1.translateFlag);
router.get("/keyboard-settings", readerKeyboardSettingsController_1.getKeyboardSettings);
router.patch("/keyboard-settings", readerKeyboardSettingsController_1.updateKeyboardSettings);
router.get("/ai-settings", readerAiSettingsController_1.getAiSettings);
router.patch("/ai-settings", readerAiSettingsController_1.updateAiSettings);
router.get("/", readerController_1.getReaderBooks);
const readUpload = express_1.default.raw({ type: "application/epub+zip", limit: epubService_1.MAX_EPUB_SIZE });
router.post("/", (req, res, next) => {
    readUpload(req, res, (error) => {
        if (error)
            return next(new errorService_1.AppError(error.status === 413
                ? "Upload an EPUB smaller than 25 MiB."
                : "Could not read the upload.", error.status === 413 ? 413 : 400));
        next();
    });
}, readerController_1.addReaderBook);
router.get("/:id/annotations", readerAnnotationController_1.listAnnotations);
router.put("/:id/annotations", readerAnnotationController_1.saveAnnotation);
router.delete("/:id/annotations/:annotationId", readerAnnotationController_1.deleteAnnotation);
router.get("/:id/conversations", readerChatController_1.listConversations);
router.post("/:id/conversations", readerChatController_1.createConversation);
router.get("/:id/conversations/:conversationId", readerChatController_1.getConversation);
router.delete("/:id/conversations/:conversationId", readerChatController_1.deleteConversation);
router.post("/:id/conversations/:conversationId/messages", readerChatController_1.chatLimiter, readerChatController_1.sendMessage);
router.post("/:id/dictionary", readerDictionaryController_1.lookupReaderDictionary);
router.get("/:id/file", readerController_1.getReaderFile);
router.get("/:id", readerController_1.getReaderBook);
router.patch("/:id/state", readerController_1.updateReaderState);
router.patch("/:id/archive", readerController_1.updateReaderBookArchive);
router.patch("/:id/title", readerController_1.renameReaderBook);
router.delete("/:id", readerController_1.deleteReaderBook);
exports.default = router;
//# sourceMappingURL=readerRouter.js.map