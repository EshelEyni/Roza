import express from "express";
import {
  getAudiobookConfig,
  createAudiobookChunk,
  getAudiobookAudio,
  cancelAudiobookRequest,
} from "../../controllers/reader/readerAudiobookController";

// Parent readerRouter applies authentication and the existing Reader allowlist.
const router = express.Router({ mergeParams: true });
router.get("/config", getAudiobookConfig);
router.post("/chunks", createAudiobookChunk);
router.get("/chunks/:chunkId", getAudiobookAudio);
router.delete("/requests/:requestId", cancelAudiobookRequest);
export default router;
