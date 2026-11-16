import { audiobookSpeechSlice, type AudiobookSentence } from "./readerTts";
import type { ReaderAudiobookNarrator } from "../../../shared/types/reader";

export type AudiobookConfig = {
  available: boolean; unavailableReason: string | null; voices: string[];
  defaultVoice: string; maxChars: number;
  narrator?: ReaderAudiobookNarrator | null; previewText?: string;
};
export type AudiobookEngine = "system" | "openai";
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

/** Group adjacent sentences into a bounded passage, retaining exact endpoints. */
export function openAiBlock(sentences: AudiobookSentence[], index: number, offset: number, limit: number) {
  const first = openAiPassage(sentences[index], offset, limit);
  let text = first.text, end = first.end, endIndex = index;
  let endCfi: string | undefined;
  while (end === sentences[endIndex].text.length && endIndex + 1 < sentences.length) {
    const next = sentences[endIndex + 1];
    // Keep sentence boundaries when possible; split only an oversized sentence.
    if (text.length + 1 + next.text.length > Math.min(600, limit)) break;
    const part = openAiPassage(next, 0, limit);
    text += " " + part.text; end = part.end; endIndex++;
    endCfi = part.cfi;
  }
  return { text, cfi: first.cfi, ...(endCfi ? { endCfi } : {}), end, endIndex };
}

/** Current and next passage only; one cancellable generation request at a time. */
export class ReaderOpenAiAudio {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private pending?: { id: string; abort: AbortController };
  private cancellation: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private buffers = new Map<string, AudioBuffer>();
  private prepared?: { key: string; promise: Promise<AudioBuffer | undefined> };
  private activeKey = "";
  private cursor = 0;
  private started = 0;
  private rate = 1;
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
  private remember() {
    if (this.running && this.context) {
      this.cursor += (this.context.currentTime - this.started) * this.rate;
      this.started = this.context.currentTime;
    }
  }
  pause() {
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
  dispose() { this.stop(); this.buffers.clear(); void this.context?.close(); }

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
        const chunk = await json<{ text: string; audioUrl: string; chunkId: string }>(base(this.book) + (passage.preview ? "/preview" : "/chunks"), {
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
        while (this.buffers.size > 2) this.buffers.delete(this.buffers.keys().next().value!);
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
    onStart: () => void, onEnd: () => void) {
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
    source.connect(context.destination);
    source.onended = () => {
      if (revision !== this.revision || this.source !== source) return;
      this.running = false; this.cursor = 0; this.source = undefined; source.disconnect(); onEnd();
    };
    this.source = source; this.started = context.currentTime; this.running = true;
    source.start(0, Math.min(this.cursor, source.buffer.duration)); onStart();
  }
}
