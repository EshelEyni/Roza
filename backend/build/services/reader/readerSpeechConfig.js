"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerSpeechLimits = exports.readerSpeechVoices = exports.readerSpeechPreviewText = void 0;
exports.readerSpeechConfig = readerSpeechConfig;
exports.requireReaderSpeech = requireReaderSpeech;
exports.normalizeReaderSpeechText = normalizeReaderSpeechText;
exports.readerSpeechTranscriptKey = readerSpeechTranscriptKey;
const errorService_1 = require("../error/errorService");
exports.readerSpeechPreviewText = "The morning arrived quietly, and the world seemed full of possibility.";
exports.readerSpeechVoices = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar",
];
exports.readerSpeechLimits = {
    maxChars: 600,
    maxUtf8Bytes: 2400,
    maxPcmBytes: 4 * 1024 * 1024,
    timeoutMs: 60000,
    cacheBytes: 32 * 1024 * 1024,
    cacheEntries: 128,
    cacheTtlMs: 30 * 60 * 1000,
    concurrent: 2,
    requestsPerTenMinutes: 120,
    charsPerHour: 200000,
    sampleRate: 24000,
};
function readerSpeechConfig() {
    const enabled = process.env.READER_AUDIOBOOK_ENABLED === "true";
    const key = (process.env.READER_AUDIOBOOK_OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        "").trim();
    const model = process.env.READER_AUDIOBOOK_MODEL || "gpt-realtime-2.1-mini";
    if (!["gpt-realtime-2.1-mini", "gpt-realtime-2.1"].includes(model))
        throw new errorService_1.AppError("Configure a supported READER_AUDIOBOOK_MODEL.", 503);
    const wordTimings = process.env.READER_AUDIOBOOK_WORD_TIMINGS !== "false";
    return { enabled, key, model, wordTimings, available: enabled && !!key };
}
function requireReaderSpeech() {
    const config = readerSpeechConfig();
    if (!config.enabled)
        throw new errorService_1.AppError("OpenAI audiobook narration is disabled.", 503);
    if (!config.key)
        throw new errorService_1.AppError("OpenAI audiobook narration is not configured.", 503);
    return config;
}
function normalizeReaderSpeechText(text) {
    return text.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
/** Conservative comparison: punctuation/case differences are tolerated, changed words are not. */
function readerSpeechTranscriptKey(text) {
    return normalizeReaderSpeechText(text)
        .toLowerCase()
        .replace(/['’]/gu, "")
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
        .trim();
}
//# sourceMappingURL=readerSpeechConfig.js.map