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
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateReaderWord = translateReaderWord;
const crypto_1 = require("crypto");
const errorService_1 = require("../error/errorService");
const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const MAX_CACHE_ENTRIES = 500;
const MAX_PENDING_REQUESTS = 32;
const cache = new Map();
const pending = new Map();
function decodeTranslation(text) {
    const named = {
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
        nbsp: "\u00a0",
    };
    return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name) => {
        if (!name.startsWith("#"))
            return named[name.toLowerCase()] || entity;
        const value = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
            ? String.fromCodePoint(value)
            : entity;
    });
}
function requestTranslation(word, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const response = yield fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({ q: word, source: "en", target: "he", format: "text", model: "nmt" }),
                signal: AbortSignal.timeout(8000),
            });
            if (!response.ok) {
                throw new errorService_1.AppError(response.status === 429
                    ? "Google Translate quota reached. Try again later."
                    : "Google Translate is unavailable. Check the backend API key, enabled API and billing.", response.status === 429 ? 503 : 502);
            }
            const data = (yield response.json());
            const text = (_c = (_b = (_a = data.data) === null || _a === void 0 ? void 0 : _a.translations) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.translatedText;
            if (typeof text !== "string" || !text.trim() || text.length > Math.max(2048, word.length * 8))
                throw new errorService_1.AppError("Google Translate returned an invalid response. Try again.", 502);
            const translation = decodeTranslation(text).trim();
            // Unrecognized words are often echoed unchanged. Do not save these as Hebrew meanings.
            if (!/[\u05d0-\u05ea]/.test(translation))
                return null;
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
        }
        catch (error) {
            if (error instanceof errorService_1.AppError)
                throw error;
            // Never forward Google's error payload or the request headers (which contain the key).
            throw new errorService_1.AppError("Google Translate could not be reached. Try again.", 502);
        }
    });
}
/** Word lookups keep their validation; explicit passage requests retain original text. */
function translateReaderWord(word_1) {
    return __awaiter(this, arguments, void 0, function* (word, passage = false) {
        var _a;
        const apiKey = (_a = process.env.GOOGLE_TRANSLATE_API_KEY) === null || _a === void 0 ? void 0 : _a.trim();
        if (passage && !apiKey)
            throw new errorService_1.AppError("Google Translate is not configured.", 503);
        if (!apiKey || (passage ? !word.trim() || word.length > 20000 : !/^[a-z]+(?:['-][a-z]+)*$/.test(word) || word.length > 80))
            return null;
        const key = (0, crypto_1.createHash)("sha256").update(apiKey).digest("hex") + ":" + word;
        const cached = cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            cache.delete(key);
            cache.set(key, cached);
            return cached.entry;
        }
        cache.delete(key);
        const existing = pending.get(key);
        if (existing)
            return existing;
        if (pending.size >= MAX_PENDING_REQUESTS)
            throw new errorService_1.AppError("Translation is busy. Try again shortly.", 503);
        const task = requestTranslation(word, apiKey).then(entry => {
            cache.set(key, {
                entry,
                expiresAt: Date.now() + (entry ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000),
            });
            if (cache.size > MAX_CACHE_ENTRIES)
                cache.delete(cache.keys().next().value);
            return entry;
        });
        pending.set(key, task);
        try {
            return yield task;
        }
        finally {
            pending.delete(key);
        }
    });
}
//# sourceMappingURL=googleTranslateService.js.map