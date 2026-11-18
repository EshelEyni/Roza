"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const readerAudiobookController_1 = require("../../controllers/reader/readerAudiobookController");
// Parent readerRouter applies authentication and the existing Reader allowlist.
const router = express_1.default.Router({ mergeParams: true });
router.get("/config", readerAudiobookController_1.getAudiobookConfig);
router.patch("/narrator", readerAudiobookController_1.saveAudiobookNarrator);
router.post("/preview", readerAudiobookController_1.createAudiobookPreview);
router.post("/chunks", readerAudiobookController_1.createAudiobookChunk);
router.get("/chunks/:chunkId", readerAudiobookController_1.getAudiobookAudio);
router.delete("/requests/:requestId", readerAudiobookController_1.cancelAudiobookRequest);
exports.default = router;
//# sourceMappingURL=readerAudiobookRouter.js.map