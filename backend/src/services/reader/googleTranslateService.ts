import { createHash } from "crypto";
import { ReaderDictionaryEntry } from "../../../../shared/types/readerDictionary";
import { AppError } from "../error/errorService";

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const MAX_CACHE_ENTRIES = 500;
const MAX_PENDING_REQUESTS = 32;
const cache = new Map<string, { entry: ReaderDictionaryEntry | null; expiresAt: number }>();
const pending = new Map<string, Promise<ReaderDictionaryEntry | null>>();

function decodeTranslation(text: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: "\u00a0",
  };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name: string) => {
    if (!name.startsWith("#")) return named[name.toLowerCase()] || entity;
    const value =
      name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
      ? String.fromCodePoint(value)
      : entity;
  });
}

async function requestTranslation(
  word: string,
  apiKey: string,
): Promise<ReaderDictionaryEntry | null> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ q: word, source: "en", target: "he", format: "text", model: "nmt" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new AppError(
        response.status === 429
          ? "Google Translate quota reached. Try again later."
          : "Google Translate is unavailable. Check the backend API key, enabled API and billing.",
        response.status === 429 ? 503 : 502,
      );
    }
    const data = (await response.json()) as {
      data?: { translations?: { translatedText?: unknown }[] };
    };
    const text = data.data?.translations?.[0]?.translatedText;
    if (typeof text !== "string" || !text.trim() || text.length > 2048)
      throw new AppError("Google Translate returned an invalid response. Try again.", 502);
    const translation = decodeTranslation(text).trim();
    // Unrecognized words are often echoed unchanged. Do not save these as Hebrew meanings.
    if (!/[\u05d0-\u05ea]/.test(translation)) return null;
    return {
      word,
      headword: word,
      source: "Google Translate",
      kind: "translation",
      senses: [
        {
          id: "google-en-he-" + word,
          partOfSpeech: "other",
          meanings: [translation],
          explanations: [],
          definition: "",
          examples: [],
          source: "Google Translate",
        },
      ],
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Never forward Google's error payload or the request headers (which contain the key).
    throw new AppError("Google Translate could not be reached. Try again.", 502);
  }
}

/** Accepts a normalized single English word; called only after local dictionary lookup misses. */
export async function translateReaderWord(word: string): Promise<ReaderDictionaryEntry | null> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (!apiKey || !/^[a-z]+(?:['-][a-z]+)*$/.test(word) || word.length > 80) return null;
  const key = createHash("sha256").update(apiKey).digest("hex") + ":" + word;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.entry;
  }
  cache.delete(key);
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= MAX_PENDING_REQUESTS)
    throw new AppError("Translation is busy. Try again shortly.", 503);

  const task = requestTranslation(word, apiKey).then(entry => {
    cache.set(key, {
      entry,
      expiresAt: Date.now() + (entry ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000),
    });
    if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    return entry;
  });
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
