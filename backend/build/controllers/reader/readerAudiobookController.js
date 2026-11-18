"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelAudiobookRequest = exports.getAudiobookAudio = exports.createAudiobookPreview = exports.createAudiobookChunk = exports.saveAudiobookNarrator = exports.getAudiobookConfig = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const readerBookModel_1 = require("../../models/reader/readerBookModel");
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const readerContextCache_1 = require("../../services/reader/readerContextCache");
const readerStorageService_1 = require("../../services/reader/readerStorageService");
const readerSpeechConfig_1 = require("../../services/reader/readerSpeechConfig");
const readerSpeechStore_1 = require("../../services/reader/readerSpeechStore");
const readerSpeechProvider_1 = require("../../services/reader/readerSpeechProvider");
const readerSpeechAlignment_1 = require("../../services/reader/readerSpeechAlignment");
const readerKokoroVoices_1 = require("../../services/reader/readerKokoroVoices");
function ownedBook(req) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            throw new errorService_1.AppError("Book not found.", 404);
        const userId = (0, ALSService_1.getLoggedInUserIdFromReq)();
        const book = yield readerBookModel_1.ReaderBookModel.findOne({ _id: req.params.id, userId }).select("+fileId");
        if (!book)
            throw new errorService_1.AppError("Book not found.", 404);
        return {
            userId,
            bookId: String(book._id),
            fileId: book.fileId,
            scope: JSON.stringify([userId, String(book._id), String(book.fileId)]),
            narrator: book.audiobookNarrator || null,
        };
    });
}
function requestId(value) {
    return typeof value === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}
function cfi(value) {
    return (typeof value === "string" &&
        value.length <= 4096 &&
        value.startsWith("epubcfi(") &&
        value.endsWith(")"));
}
function metadata(entry, bookId, cacheHit, passageCfi, passageEndCfi) {
    var _a, _b;
    return Object.assign(Object.assign({ chunkId: entry.id, audioUrl: "/api/reader/" + bookId + "/audiobook/chunks/" + entry.id, text: entry.text, transcript: entry.transcript, passageCfi }, (passageEndCfi ? { passageEndCfi } : {})), { provider: "openai", model: entry.model, voice: entry.voice, cacheHit, expiresAt: new Date(entry.expiresAt).toISOString(), mimeType: "audio/wav", sampleRate: 24000, channels: 1, durationSeconds: entry.durationSeconds, alignment: {
            type: ((_a = entry.wordTimings) === null || _a === void 0 ? void 0 : _a.length) ? "word" : "passage",
            startSeconds: 0,
            endSeconds: entry.durationSeconds,
            wordTimings: entry.wordTimings || null,
            source: ((_b = entry.wordTimings) === null || _b === void 0 ? void 0 : _b.length) ? "whisper-1" : null,
        }, aiGenerated: true });
}
exports.getAudiobookConfig = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const owner = yield ownedBook(req);
    const config = (0, readerSpeechConfig_1.readerSpeechConfig)();
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "success",
        data: {
            enabled: config.enabled,
            narrator: owner.narrator,
            previewText: readerSpeechConfig_1.readerSpeechPreviewText,
            available: config.available,
            provider: "openai",
            model: config.model,
            unavailableReason: !config.enabled ? "disabled" : !config.key ? "not_configured" : null,
            voices: readerSpeechConfig_1.readerSpeechVoices,
            defaultVoice: "marin",
            maxChars: readerSpeechConfig_1.readerSpeechLimits.maxChars,
            maxUtf8Bytes: readerSpeechConfig_1.readerSpeechLimits.maxUtf8Bytes,
            maxConcurrentPerUser: 1,
            audioFormat: "wav",
            sampleRate: 24000,
            channels: 1,
            alignment: config.wordTimings ? "word" : "passage",
            wordTimings: config.wordTimings,
            requiresAiVoiceDisclosure: true,
            cacheTtlSeconds: readerSpeechConfig_1.readerSpeechLimits.cacheTtlMs / 1000,
        },
    });
}));
exports.saveAudiobookNarrator = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const owner = yield ownedBook(req);
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some(key => !["engine", "voice", "name", "lang"].includes(key))
        || !["system", "openai", "kokoro"].includes(body.engine)
        || typeof body.voice !== "string" || !body.voice.trim() || body.voice.length > 1024
        || typeof body.name !== "string" || !body.name.trim() || body.name.length > 256
        || typeof body.lang !== "string" || body.lang.length > 32
        || (body.engine === "openai" && !readerSpeechConfig_1.readerSpeechVoices.includes(body.voice))
        || (body.engine === "kokoro" && !(0, readerKokoroVoices_1.isReaderKokoroVoice)(body.voice)))
        throw new errorService_1.AppError("Choose an available narrator voice.", 400);
    const narrator = { engine: body.engine, voice: body.voice, name: body.name, lang: body.lang };
    const updated = yield readerBookModel_1.ReaderBookModel.findOneAndUpdate({ _id: owner.bookId, userId: owner.userId }, { $set: { audiobookNarrator: narrator } }, { new: true, runValidators: true });
    if (!updated)
        throw new errorService_1.AppError("Book not found.", 404);
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: narrator });
}));
function createAudio(preview) {
    return (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(this, void 0, void 0, function* () {
        const owner = yield ownedBook(req);
        const config = (0, readerSpeechConfig_1.requireReaderSpeech)();
        const body = req.body;
        if (!body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).some(key => !(preview ? ["requestId", "voice"] : ["requestId", "passageCfi", "passageEndCfi", "voice"]).includes(key)) ||
            !requestId(body.requestId) ||
            (!preview && !cfi(body.passageCfi)) ||
            (body.passageEndCfi !== undefined && !cfi(body.passageEndCfi)) ||
            (body.voice !== undefined && !readerSpeechConfig_1.readerSpeechVoices.includes(body.voice)))
            throw new errorService_1.AppError(preview ? "Supply a requestId and a supported narrator voice. Preview text is fixed."
                : "Supply a requestId, a selected EPUB range, and a supported narrator voice.", 400);
        let text = readerSpeechConfig_1.readerSpeechPreviewText;
        if (!preview) {
            const context = yield (0, readerContextCache_1.cachedReaderContext)(String(owner.fileId), () => __awaiter(this, void 0, void 0, function* () {
                const pieces = yield (0, readerStorageService_1.getReaderBucket)().openDownloadStream(owner.fileId).toArray();
                return Buffer.concat(pieces);
            }));
            text = (0, readerSpeechConfig_1.normalizeReaderSpeechText)(context.passage(body.passageCfi, body.passageEndCfi).text);
        }
        if (!(0, readerSpeechConfig_1.readerSpeechTranscriptKey)(text) ||
            text.length > readerSpeechConfig_1.readerSpeechLimits.maxChars ||
            Buffer.byteLength(text, "utf8") > readerSpeechConfig_1.readerSpeechLimits.maxUtf8Bytes)
            throw new errorService_1.AppError("Select readable book text of up to " +
                readerSpeechConfig_1.readerSpeechLimits.maxChars +
                " characters for one narration chunk.", 400);
        const voice = (body.voice || "marin");
        const key = readerSpeechStore_1.readerSpeechStore.key(owner.scope, config.model, voice, text, !preview && config.wordTimings);
        res.setHeader("Cache-Control", "no-store");
        const cached = readerSpeechStore_1.readerSpeechStore.get(key, owner.scope);
        if (cached) {
            res.json({
                status: "success",
                data: metadata(cached, owner.bookId, true, body.passageCfi, body.passageEndCfi),
            });
            return;
        }
        let job;
        try {
            job = readerSpeechStore_1.readerSpeechStore.reserve(owner.userId, owner.scope, body.requestId, text.length);
        }
        catch (error) {
            if (error instanceof errorService_1.AppError && (error.statusCode === 409 || error.statusCode === 429))
                res.setHeader("Retry-After", error.statusCode === 409 ? "1" : "60");
            throw error;
        }
        const disconnected = () => {
            if (!res.writableEnded)
                job.cancel();
        };
        req.once("aborted", disconnected);
        res.once("close", disconnected);
        try {
            if (req.aborted || res.destroyed)
                job.cancel();
            const audio = yield (0, readerSpeechProvider_1.generateReaderSpeech)({ text, voice, userId: owner.userId }, {
                key: config.key,
                model: config.model,
                signal: job.signal,
            });
            if (res.destroyed || req.aborted)
                return;
            if (job.signal.aborted)
                throw new errorService_1.AppError("Audiobook narration cancelled.", 499);
            const wordTimings = !preview && config.wordTimings
                ? yield (0, readerSpeechAlignment_1.alignReaderSpeech)(text, audio.wav, audio.durationSeconds, config.key, job.signal)
                : null;
            if (res.destroyed || req.aborted)
                return;
            if (job.signal.aborted)
                throw new errorService_1.AppError("Audiobook narration cancelled.", 499);
            const entry = readerSpeechStore_1.readerSpeechStore.put(Object.assign(Object.assign({}, audio), { wordTimings, id: key, scope: owner.scope, model: config.model, voice,
                text }));
            res.status(201).json({
                status: "success",
                data: metadata(entry, owner.bookId, false, body.passageCfi, body.passageEndCfi),
            });
        }
        catch (error) {
            if (res.destroyed || req.aborted)
                return;
            if (error instanceof errorService_1.AppError && error.statusCode === 429)
                res.setHeader("Retry-After", "60");
            throw error;
        }
        finally {
            req.removeListener("aborted", disconnected);
            res.removeListener("close", disconnected);
            job.release();
        }
    }));
}
exports.createAudiobookChunk = createAudio(false);
exports.createAudiobookPreview = createAudio(true);
exports.getAudiobookAudio = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const owner = yield ownedBook(req);
    (0, readerSpeechConfig_1.requireReaderSpeech)();
    if (!/^[a-f0-9]{64}$/.test(req.params.chunkId))
        throw new errorService_1.AppError("Narration audio not found.", 404);
    const entry = readerSpeechStore_1.readerSpeechStore.get(req.params.chunkId, owner.scope);
    if (!entry)
        throw new errorService_1.AppError("Narration audio expired or is unavailable. Request the passage again.", 410);
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
    let start = 0, end = length - 1;
    if (match && (match[1] || match[2])) {
        if (!match[1])
            start = Math.max(0, length - Number(match[2]));
        else {
            start = Number(match[1]);
            if (match[2])
                end = Math.min(end, Number(match[2]));
        }
    }
    if (!match ||
        (!match[1] && !match[2]) ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start >= length ||
        end < start) {
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
}));
exports.cancelAudiobookRequest = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const owner = yield ownedBook(req);
    if (!requestId(req.params.requestId))
        throw new errorService_1.AppError("Invalid narration request ID.", 400);
    readerSpeechStore_1.readerSpeechStore.cancel(owner.userId, owner.scope, req.params.requestId);
    res.setHeader("Cache-Control", "no-store");
    res.status(204).end();
}));
//# sourceMappingURL=readerAudiobookController.js.map