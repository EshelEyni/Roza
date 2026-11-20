import { AppError } from "../error/errorService";

export const readerSpeechPreviewText = "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.";

export const readerSpeechVoices = [
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
] as const;
export type ReaderSpeechVoice = (typeof readerSpeechVoices)[number];
export const readerSpeechLimits = {
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
} as const;
export function readerSpeechConfig() {
  const enabled = process.env.READER_AUDIOBOOK_ENABLED === "true";
  const key = (
    process.env.READER_AUDIOBOOK_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();
  const model = process.env.READER_AUDIOBOOK_MODEL || "gpt-realtime-2.1-mini";
  if (!["gpt-realtime-2.1-mini", "gpt-realtime-2.1"].includes(model))
    throw new AppError("Configure a supported READER_AUDIOBOOK_MODEL.", 503);
  const wordTimings = process.env.READER_AUDIOBOOK_WORD_TIMINGS !== "false";
  return { enabled, key, model, wordTimings, available: enabled && !!key };
}
export function requireReaderSpeech() {
  const config = readerSpeechConfig();
  if (!config.enabled) throw new AppError("OpenAI audiobook narration is disabled.", 503);
  if (!config.key) throw new AppError("OpenAI audiobook narration is not configured.", 503);
  return config;
}
export function normalizeReaderSpeechText(text: string) {
  return text.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
/** Conservative comparison: punctuation/case differences are tolerated, changed words are not. */
export function readerSpeechTranscriptKey(text: string) {
  return normalizeReaderSpeechText(text)
    .toLowerCase()
    .replace(/['’]/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}
