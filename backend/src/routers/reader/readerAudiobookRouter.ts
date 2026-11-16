import express from "express";
import {
  getAudiobookConfig,
  createAudiobookChunk,
  getAudiobookAudio,
  cancelAudiobookRequest,
  createAudiobookPreview,
  saveAudiobookNarrator,
} from "../../controllers/reader/readerAudiobookController";

// Parent readerRouter applies authentication and the existing Reader allowlist.
const router = express.Router({ mergeParams: true });
router.get("/config", getAudiobookConfig);
router.patch("/narrator", saveAudiobookNarrator);
router.post("/preview", createAudiobookPreview);
router.post("/chunks", createAudiobookChunk);
router.get("/chunks/:chunkId", getAudiobookAudio);
router.delete("/requests/:requestId", cancelAudiobookRequest);
export default router;
