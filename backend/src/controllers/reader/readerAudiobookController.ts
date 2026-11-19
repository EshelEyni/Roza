import type { Request, Response } from "express";
import mongoose from "mongoose";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { cachedReaderContext } from "../../services/reader/readerContextCache";
import { getReaderBucket } from "../../services/reader/readerStorageService";
import {
  readerSpeechConfig,
  requireReaderSpeech,
  readerSpeechLimits,
  readerSpeechVoices,
  normalizeReaderSpeechText,
  readerSpeechTranscriptKey,
  readerSpeechPreviewText,
  type ReaderSpeechVoice,
} from "../../services/reader/readerSpeechConfig";
import { readerSpeechStore, type SpeechEntry } from "../../services/reader/readerSpeechStore";
import { generateReaderSpeech } from "../../services/reader/readerSpeechProvider";
import { alignReaderSpeech } from "../../services/reader/readerSpeechAlignment";
import { isReaderKokoroVoice } from "../../services/reader/readerKokoroVoices";

async function ownedBook(req: Request) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Book not found.", 404);
  const userId = getLoggedInUserIdFromReq();
  const book = await ReaderBookModel.findOne({ _id: req.params.id, userId }).select("+fileId");
  if (!book) throw new AppError("Book not found.", 404);
  return {
    userId,
    bookId: String(book._id),
    fileId: book.fileId,
    scope: JSON.stringify([userId, String(book._id), String(book.fileId)]),
    narrator: book.audiobookNarrator || null,
  };
}
function requestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}
function cfi(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 4096 &&
    value.startsWith("epubcfi(") &&
    value.endsWith(")")
  );
}
function metadata(
  entry: SpeechEntry,
  bookId: string,
  cacheHit: boolean,
  passageCfi?: string,
  passageEndCfi?: string,
) {
  return {
    chunkId: entry.id,
    audioUrl: "/api/reader/" + bookId + "/audiobook/chunks/" + entry.id,
    text: entry.text,
    transcript: entry.transcript,
    passageCfi,
    ...(passageEndCfi ? { passageEndCfi } : {}),
    provider: "openai",
    model: entry.model,
    voice: entry.voice,
    cacheHit,
    expiresAt: new Date(entry.expiresAt).toISOString(),
    mimeType: "audio/wav",
    sampleRate: 24000,
    channels: 1,
    durationSeconds: entry.durationSeconds,
    alignment: {
      type: entry.wordTimings?.length ? "word" : "passage",
      startSeconds: 0,
      endSeconds: entry.durationSeconds,
      wordTimings: entry.wordTimings || null,
      source: entry.wordTimings?.length ? "whisper-1" : null,
    },
    aiGenerated: true,
  };
}
export const getAudiobookConfig = asyncErrorCatcher(async (req: Request, res: Response) => {
  const owner = await ownedBook(req);
  const config = readerSpeechConfig();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: "success",
    data: {
      enabled: config.enabled,
      narrator: owner.narrator,
      previewText: readerSpeechPreviewText,
      available: config.available,
      provider: "openai",
      model: config.model,
      unavailableReason: !config.enabled ? "disabled" : !config.key ? "not_configured" : null,
      voices: readerSpeechVoices,
      defaultVoice: "marin",
      maxChars: readerSpeechLimits.maxChars,
      maxUtf8Bytes: readerSpeechLimits.maxUtf8Bytes,
      maxConcurrentPerUser: 1,
      audioFormat: "wav",
      sampleRate: 24000,
      channels: 1,
      alignment: config.wordTimings ? "word" : "passage",
      wordTimings: config.wordTimings,
      requiresAiVoiceDisclosure: true,
      cacheTtlSeconds: readerSpeechLimits.cacheTtlMs / 1000,
    },
  });
});
export const saveAudiobookNarrator = asyncErrorCatcher(async (req: Request, res: Response) => {
  const owner = await ownedBook(req);
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some(key => !["engine", "voice", "name", "lang"].includes(key))
    || !["system", "openai", "kokoro"].includes(body.engine)
    || typeof body.voice !== "string" || !body.voice.trim() || body.voice.length > 1024
    || typeof body.name !== "string" || !body.name.trim() || body.name.length > 256
    || typeof body.lang !== "string" || body.lang.length > 32
    || (body.engine === "openai" && !readerSpeechVoices.includes(body.voice))
    || (body.engine === "kokoro" && !isReaderKokoroVoice(body.voice)))
    throw new AppError("Choose an available narrator voice.", 400);
  const narrator = { engine: body.engine, voice: body.voice, name: body.name, lang: body.lang };
  const updated = await ReaderBookModel.findOneAndUpdate(
    { _id: owner.bookId, userId: owner.userId }, { $set: { audiobookNarrator: narrator } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError("Book not found.", 404);
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: narrator });
});

function createAudio(preview: boolean) { return asyncErrorCatcher(async (req: Request, res: Response) => {
  const owner = await ownedBook(req);
  const config = requireReaderSpeech();
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      key => !(preview ? ["requestId", "voice"] : ["requestId", "passageCfi", "passageEndCfi", "voice"]).includes(key),
    ) ||
    !requestId(body.requestId) ||
    (!preview && !cfi(body.passageCfi)) ||
    (body.passageEndCfi !== undefined && !cfi(body.passageEndCfi)) ||
    (body.voice !== undefined && !readerSpeechVoices.includes(body.voice))
  )
    throw new AppError(
      preview ? "Supply a requestId and a supported narrator voice. Preview text is fixed."
        : "Supply a requestId, a selected EPUB range, and a supported narrator voice.",
      400,
    );
  let text = readerSpeechPreviewText;
  if (!preview) {
    const context = await cachedReaderContext(String(owner.fileId), async () => {
      const pieces = await getReaderBucket().openDownloadStream(owner.fileId).toArray();
      return Buffer.concat(pieces);
    });
    text = normalizeReaderSpeechText(context.passage(body.passageCfi, body.passageEndCfi).text);
  }
  if (
    !readerSpeechTranscriptKey(text) ||
    text.length > readerSpeechLimits.maxChars ||
    Buffer.byteLength(text, "utf8") > readerSpeechLimits.maxUtf8Bytes
  )
    throw new AppError(
      "Select readable book text of up to " +
        readerSpeechLimits.maxChars +
        " characters for one narration chunk.",
      400,
    );
  const voice = (body.voice || "marin") as ReaderSpeechVoice;
  const key = readerSpeechStore.key(owner.scope, config.model, voice, text, !preview && config.wordTimings);
  res.setHeader("Cache-Control", "no-store");
  const cached = readerSpeechStore.get(key, owner.scope);
  if (cached) {
    res.json({
      status: "success",
      data: metadata(cached, owner.bookId, true, body.passageCfi, body.passageEndCfi),
    });
    return;
  }
  let job: ReturnType<typeof readerSpeechStore.reserve>;
  try {
    job = readerSpeechStore.reserve(owner.userId, owner.scope, body.requestId, text.length);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 409 || error.statusCode === 429))
      res.setHeader("Retry-After", error.statusCode === 409 ? "1" : "60");
    throw error;
  }
  const disconnected = () => {
    if (!res.writableEnded) job.cancel();
  };
  req.once("aborted", disconnected);
  res.once("close", disconnected);
  try {
    if (req.aborted || res.destroyed) job.cancel();
    const audio = await generateReaderSpeech(
      { text, voice, userId: owner.userId },
      {
        key: config.key,
        model: config.model,
        signal: job.signal,
      },
    );
    if (res.destroyed || req.aborted) return;
    if (job.signal.aborted) throw new AppError("Audiobook narration cancelled.", 499);
    const wordTimings = !preview && config.wordTimings
      ? await alignReaderSpeech(text, audio.wav, audio.durationSeconds, config.key, job.signal)
      : null;
    if (res.destroyed || req.aborted) return;
    if (job.signal.aborted) throw new AppError("Audiobook narration cancelled.", 499);
    const entry = readerSpeechStore.put({
      ...audio,
      wordTimings,
      id: key,
      scope: owner.scope,
      model: config.model,
      voice,
      text,
    });
    res.status(201).json({
      status: "success",
      data: metadata(entry, owner.bookId, false, body.passageCfi, body.passageEndCfi),
    });
  } catch (error) {
    if (res.destroyed || req.aborted) return;
    if (error instanceof AppError && error.statusCode === 429) res.setHeader("Retry-After", "60");
    throw error;
  } finally {
    req.removeListener("aborted", disconnected);
    res.removeListener("close", disconnected);
    job.release();
  }
}); }
export const createAudiobookChunk = createAudio(false);
export const createAudiobookPreview = createAudio(true);
export const getAudiobookAudio = asyncErrorCatcher(async (req: Request, res: Response) => {
  const owner = await ownedBook(req);
  requireReaderSpeech();
  if (!/^[a-f0-9]{64}$/.test(req.params.chunkId))
    throw new AppError("Narration audio not found.", 404);
  const entry = readerSpeechStore.get(req.params.chunkId, owner.scope);
  if (!entry)
    throw new AppError(
      "Narration audio expired or is unavailable. Request the passage again.",
      410,
    );
  const length = entry.wav.length;
  res.set({
    "Content-Type": "audio/wav",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "Content-Disposition": 'inline; filename="narration.wav"',
    "X-Content-Type-Options": "nosniff",
  });
  const range = req.get("Range");
  if (!range) {
    res.setHeader("Content-Length", length);
    res.send(entry.wav);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0,
    end = length - 1;
  if (match && (match[1] || match[2])) {
    if (!match[1]) start = Math.max(0, length - Number(match[2]));
    else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
  }
  if (
    !match ||
    (!match[1] && !match[2]) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= length ||
    end < start
  ) {
    res
      .status(416)
      .set("Content-Range", "bytes */" + length)
      .end();
    return;
  }
  res
    .status(206)
    .set({
      "Content-Range": "bytes " + start + "-" + end + "/" + length,
      "Content-Length": String(end - start + 1),
    })
    .send(entry.wav.subarray(start, end + 1));
});
export const cancelAudiobookRequest = asyncErrorCatcher(async (req: Request, res: Response) => {
  const owner = await ownedBook(req);
  if (!requestId(req.params.requestId)) throw new AppError("Invalid narration request ID.", 400);
  readerSpeechStore.cancel(owner.userId, owner.scope, req.params.requestId);
  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
});
