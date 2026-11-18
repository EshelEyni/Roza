import { audiobookSpeechSlice, type AudiobookSentence } from "./readerTts";
import type { ReaderAudiobookNarrator } from "../../../shared/types/reader";

export type AudiobookConfig = {
  available: boolean; unavailableReason: string | null; voices: string[];
  defaultVoice: string; maxChars: number;
  narrator?: ReaderAudiobookNarrator | null; previewText?: string;
  wordTimings?: boolean;
};
export type AudiobookEngine = "system" | "openai" | "kokoro";
const base = (book: string) => `/api/reader/${encodeURIComponent(book)}/audiobook`;

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const body = await response.json();
  if (!response.ok || body.status !== "success") {
    const retry = response.headers.get("Retry-After");
    throw new Error((body.message || `Audiobook request failed (${response.status}).`) +
      (retry ? ` Try again after ${retry} seconds.` : "") + " You can also choose System voices.");
  }
  return body.data as T;
}
export const loadAudiobookConfig = (book: string, signal: AbortSignal) =>
  json<AudiobookConfig>(base(book) + "/config", { signal });
export const saveAudiobookNarrator = (book: string, narrator: ReaderAudiobookNarrator) =>
  json<ReaderAudiobookNarrator>(base(book) + "/narrator", {
    method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(narrator),
  });

/** Only source CFIs go to the server; narration text comes from the owned EPUB. */
export function openAiPassage(sentence: AudiobookSentence, offset: number, limit: number) {
  const part = audiobookSpeechSlice(sentence.text, offset, Math.min(600, limit));
  if (!part.text || !sentence.rangeCfi) throw new Error("This passage cannot be narrated by OpenAI. Choose System voices.");
  return { ...part, cfi: sentence.rangeCfi(offset, part.end) };
}

export type OpenAiPassage = { text: string; cfi: string; endCfi?: string; preview?: boolean };
export type AudiobookWordTiming = { startChar: number; endChar: number; startSeconds: number; endSeconds: number };

export function audiobookTimingAt(words: AudiobookWordTiming[], seconds: number) {
  let low = 0, high = words.length;
  while (low < high) { const mid = (low + high) >>> 1; if (words[mid].startSeconds <= seconds) low = mid + 1; else high = mid; }
  const word = words[low - 1];
  return word && seconds < word.endSeconds ? word : null;
}
export function validateAudiobookTimings(value: unknown, text: string, duration: number): AudiobookWordTiming[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 1200 || !Number.isFinite(duration) || duration <= 0) return null;
  const source = Array.from(text.matchAll(/\S+/gu)).filter(match => /[\p{L}\p{M}\p{N}]/u.test(match[0]));
  if (value.length !== source.length) return null;
  let endChar = 0, startTime = 0, endTime = 0;
  for (let index = 0; index < value.length; index++) {
    const word = value[index], expected = source[index];
    if (!word || !Number.isSafeInteger(word.startChar) || !Number.isSafeInteger(word.endChar)
      || word.startChar !== expected.index || word.endChar !== expected.index! + expected[0].length
      || word.startChar < endChar || !Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds)
      || word.startSeconds < startTime || word.startSeconds < endTime - 0.08
      || word.endSeconds <= word.startSeconds || word.endSeconds < endTime || word.endSeconds > duration + 0.05) return null;
    endChar = word.endChar; startTime = word.startSeconds; endTime = word.endSeconds;
  }
  return value;
}

/** Group adjacent sentences into a bounded passage, retaining exact endpoints. */
export function openAiBlock(sentences: AudiobookSentence[], index: number, offset: number, limit: number) {
  const first = openAiPassage(sentences[index], offset, limit);
  let text = first.text, end = first.end, endIndex = index;
  const locations = [{ start: 0, end: first.text.length, sentence: index, offset }];
  let endCfi: string | undefined;
  while (end === sentences[endIndex].text.length && endIndex + 1 < sentences.length) {
    const next = sentences[endIndex + 1];
    // Keep sentence boundaries when possible; split only an oversized sentence.
    if (text.length + 1 + next.text.length > Math.min(600, limit)) break;
    const part = openAiPassage(next, 0, limit);
    locations.push({ start: text.length + 1, end: text.length + 1 + part.text.length, sentence: endIndex + 1, offset: 0 });
    text += " " + part.text; end = part.end; endIndex++;
    endCfi = part.cfi;
  }
  return { text, cfi: first.cfi, ...(endCfi ? { endCfi } : {}), end, endIndex, locations };
}

/** Current and next passage only; one cancellable generation request at a time. */
export class ReaderOpenAiAudio {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private pending?: { id: string; abort: AbortController };
  private cancellation: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private buffers = new Map<string, AudioBuffer>();
  private timings = new Map<string, AudiobookWordTiming[] | null>();
  private frame?: number;
  private prepared?: { key: string; promise: Promise<AudioBuffer | undefined> };
  private activeKey = "";
  private cursor = 0;
  private started = 0;
  private rate = 1;
  private volume = 1;
  private gain?: GainNode;
  private running = false;
  private ready: Promise<void> = Promise.resolve();
  constructor(private book: string, private interrupted: () => void = () => {}) {}

  // Called synchronously inside the Play/voice-apply gesture, before any fetch.
  unlock() {
    this.context ??= new AudioContext();
    this.context.onstatechange = () => {
      if (this.running && this.context?.state !== "running") this.interrupted();
    };
    this.ready = this.context.resume();
    return this.ready;
  }
  setRate(value: number) {
    this.remember(); this.rate = value;
    if (this.source && this.context) {
      this.source.playbackRate.setValueAtTime(value, this.context.currentTime);
      this.started = this.context.currentTime;
    }
  }
  setVolume(value: number) {
    this.volume = value;
    if (this.gain) this.gain.gain.value = value;
  }
  /** Narration goes through one gain node, so volume changes apply to the playing passage. */
  private output(context: AudioContext): AudioNode {
    if (typeof context.createGain !== "function") return context.destination;
    if (!this.gain) { this.gain = context.createGain(); this.gain.connect(context.destination); }
    this.gain.gain.value = this.volume;
    return this.gain;
  }
  private remember() {
    if (this.running && this.context) {
      this.cursor += (this.context.currentTime - this.started) * this.rate;
      this.started = this.context.currentTime;
    }
  }
  pause() {
    this.stopWordClock();
    ++this.revision; this.remember(); this.running = false;
    this.prepared = undefined;
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = undefined; }
    const pending = this.pending;
    if (pending) {
      this.pending = undefined; pending.abort.abort();
      // Serialize cancellation before a replacement job (backend allows one per user).
      this.cancellation = this.cancellation.then(() => fetch(base(this.book) + "/requests/" + pending.id,
        { method: "DELETE", credentials: "same-origin", keepalive: true })).catch(() => undefined);
    }
  }
  stop() { this.pause(); this.cursor = 0; }
  waitForCancellation() { return this.cancellation; }
  dispose() { this.stop(); this.buffers.clear(); this.timings.clear(); void this.context?.close(); }

  private stopWordClock() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
  private startWordClock(key: string, onWord?: (word: AudiobookWordTiming | null) => void) {
    this.stopWordClock();
    const words = this.timings.get(key);
    if (!words?.length || !onWord) return;
    const revision = this.revision, source = this.source;
    let previous: AudiobookWordTiming | null | undefined;
    const tick = () => {
      if (!this.running || !this.context || revision !== this.revision || source !== this.source) return;
      const seconds = this.cursor + (this.context.currentTime - this.started) * this.rate;
      const word = audiobookTimingAt(words, seconds);
      if (word !== previous) { previous = word; onWord(word); }
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  private key(passage: OpenAiPassage, voice: string) {
    return JSON.stringify([voice, passage.cfi, passage.endCfi, !!passage.preview]);
  }
  prefetch(passage: OpenAiPassage, voice: string) {
    return this.prepare(passage, voice);
  }
  private prepare(passage: OpenAiPassage, voice: string): Promise<AudioBuffer | undefined> {
    const key = this.key(passage, voice);
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    if (this.prepared?.key === key) return this.prepared.promise;
    const revision = this.revision;
    const context = this.context;
    const previous = this.prepared?.promise;
    const promise = (async () => {
      if (!context) throw new Error("Press Play to allow audio playback.");
      await this.ready;
      await this.cancellation;
      // A replacement passage must never overlap an active provider request.
      await previous?.catch(() => undefined);
      if (revision !== this.revision) return;
      const pending = { id: crypto.randomUUID(), abort: new AbortController() };
      this.pending = pending;
      try {
        const chunk = await json<{ text: string; audioUrl: string; chunkId: string; alignment?: { wordTimings?: unknown } }>(base(this.book) + (passage.preview ? "/preview" : "/chunks"), {
          method: "POST", signal: pending.abort.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: pending.id,
            ...(!passage.preview ? { passageCfi: passage.cfi, ...(passage.endCfi ? { passageEndCfi: passage.endCfi } : {}) } : {}), voice }),
        });
        if (revision !== this.revision) return;
        if (chunk.text.replace(/\s+/gu, " ").trim() !== passage.text.trim())
          throw new Error("The server passage differs from the displayed text. Choose System voices for this passage.");
        if (!/^[a-f0-9]{64}$/.test(chunk.chunkId) || chunk.audioUrl !== base(this.book) + "/chunks/" + chunk.chunkId)
          throw new Error("Invalid audiobook audio response.");
        const response = await fetch(chunk.audioUrl, { credentials: "same-origin", signal: pending.abort.signal });
        if (!response.ok) throw new Error(`Audio could not be loaded (${response.status}). Press Play to retry or choose System voices.`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (revision !== this.revision) return;
        this.buffers.set(key, buffer);
        this.timings.set(key, validateAudiobookTimings(chunk.alignment?.wordTimings, passage.text, buffer.duration));
        while (this.buffers.size > 2) { const oldest = this.buffers.keys().next().value!; this.buffers.delete(oldest); this.timings.delete(oldest); }
        return buffer;
      } finally { if (this.pending === pending) this.pending = undefined; }
    })();
    this.prepared = { key, promise };
    // Prefetch failures surface only when playback reaches that passage, without
    // interrupting current audio or silently making another paid request.
    void promise.catch(() => undefined);
    return promise;
  }
  async play(passage: OpenAiPassage, voice: string, speed: number,
    onStart: (wordTimings: boolean) => void, onEnd: () => void, onWord?: (word: AudiobookWordTiming | null) => void) {
    this.stopWordClock();
    const revision = this.revision;
    const key = this.key(passage, voice);
    if (this.source) {
      this.remember(); this.running = false;
      this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = undefined;
    }
    if (key !== this.activeKey) this.cursor = 0;
    this.activeKey = key;
    this.rate = speed;
    const buffer = await this.prepare(passage, voice);
    if (revision !== this.revision || !buffer) return;
    const context = this.context!;
    if (context.state !== "running") throw new Error("Audio was interrupted. Press Play to continue.");
    const source = context.createBufferSource();
    source.buffer = buffer; source.playbackRate.value = this.rate;
    source.connect(this.output(context));
    source.onended = () => {
      if (revision !== this.revision || this.source !== source) return;
      this.stopWordClock();
      this.running = false; this.cursor = 0; this.source = undefined; source.disconnect(); onEnd();
    };
    this.source = source; this.started = context.currentTime; this.running = true;
    source.start(0, Math.min(this.cursor, source.buffer.duration)); onStart(!!this.timings.get(key)?.length);
    this.startWordClock(key, onWord);
  }
}
