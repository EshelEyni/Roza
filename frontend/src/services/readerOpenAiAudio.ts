import { audiobookSpeechSlice, type AudiobookSentence } from "./readerTts";

export type AudiobookConfig = {
  available: boolean; unavailableReason: string | null; voices: string[];
  defaultVoice: string; maxChars: number;
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

/** Only source CFIs go to the server; narration text comes from the owned EPUB. */
export function openAiPassage(sentence: AudiobookSentence, offset: number, limit: number) {
  const part = audiobookSpeechSlice(sentence.text, offset, Math.min(600, limit));
  if (!part.text || !sentence.rangeCfi) throw new Error("This passage cannot be narrated by OpenAI. Choose System voices.");
  return { ...part, cfi: sentence.rangeCfi(offset, part.end) };
}

/** One audio buffer and one cancellable generation request, scoped to this mode. */
export class ReaderOpenAiAudio {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private pending?: { id: string; abort: AbortController };
  private cancellation: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private cached?: { key: string; buffer: AudioBuffer };
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
  dispose() { this.stop(); this.cached = undefined; void this.context?.close(); }

  async play(passage: { text: string; cfi: string }, voice: string, speed: number,
    onStart: () => void, onEnd: () => void) {
    this.pause();
    const revision = this.revision;
    const key = voice + "|" + passage.cfi;
    const context = this.context;
    if (!context) throw new Error("Press Play to allow audio playback.");
    await this.ready;
    await this.cancellation;
    if (revision !== this.revision) return;
    if (this.cached?.key !== key) {
      this.cursor = 0;
      const pending = { id: crypto.randomUUID(), abort: new AbortController() };
      this.pending = pending;
      try {
        const chunk = await json<{ text: string; audioUrl: string; chunkId: string }>(base(this.book) + "/chunks", {
          method: "POST", signal: pending.abort.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: pending.id, passageCfi: passage.cfi, voice }),
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
        this.cached = { key, buffer };
      } finally { if (this.pending === pending) this.pending = undefined; }
    }
    if (revision !== this.revision || !this.cached) return;
    if (context.state !== "running") throw new Error("Audio was interrupted. Press Play to continue.");
    const source = context.createBufferSource();
    source.buffer = this.cached.buffer; source.playbackRate.value = speed;
    source.connect(context.destination);
    source.onended = () => {
      if (revision !== this.revision) return;
      this.running = false; this.cursor = 0; this.source = undefined; source.disconnect(); onEnd();
    };
    this.source = source; this.rate = speed; this.started = context.currentTime; this.running = true;
    source.start(0, Math.min(this.cursor, source.buffer.duration)); onStart();
  }
}
