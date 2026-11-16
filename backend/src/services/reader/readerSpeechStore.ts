import { createHash } from "crypto";
import { AppError } from "../error/errorService";
import { readerSpeechLimits } from "./readerSpeechConfig";
import type { ReaderSpeechWordTiming } from "./readerSpeechAlignment";

export type SpeechAudio = { wav: Buffer; durationSeconds: number; transcript: string; wordTimings?: ReaderSpeechWordTiming[] | null };
export type SpeechEntry = SpeechAudio & {
  id: string;
  scope: string;
  model: string;
  voice: string;
  text: string;
  expiresAt: number;
};
type Job = { scope: string; requestId: string; controller: AbortController };
type Budget = { started: number; chars: number; requestStart: number; requests: number };

export class ReaderSpeechStore {
  private entries = new Map<string, SpeechEntry>();
  private jobs = new Map<string, Job>();
  private budgets = new Map<string, Budget>();
  private bytes = 0;
  constructor(
    private limits: {
      cacheBytes: number;
      cacheEntries: number;
      cacheTtlMs: number;
      concurrent: number;
      requestsPerTenMinutes: number;
      charsPerHour: number;
    } = readerSpeechLimits,
  ) {}
  key(scope: string, model: string, voice: string, text: string, aligned = false) {
    return createHash("sha256")
      .update(JSON.stringify(["reader-speech-v2", scope, model, voice, text, aligned]))
      .digest("hex");
  }
  private prune(now: number) {
    for (const [id, entry] of this.entries)
      if (entry.expiresAt <= now) {
        this.entries.delete(id);
        this.bytes -= entry.wav.length;
      }
    for (const [user, budget] of this.budgets)
      if (now - budget.started >= 3600000 && !this.jobs.has(user)) this.budgets.delete(user);
  }
  get(id: string, scope: string, now = Date.now()) {
    this.prune(now);
    const entry = this.entries.get(id);
    if (!entry || entry.scope !== scope) return undefined;
    this.entries.delete(id);
    this.entries.set(id, entry);
    return entry;
  }
  put(input: Omit<SpeechEntry, "expiresAt">, now = Date.now()) {
    this.prune(now);
    const entry = { ...input, expiresAt: now + this.limits.cacheTtlMs };
    if (entry.wav.length > this.limits.cacheBytes)
      throw new AppError("Narration audio exceeds the cache capacity.", 502);
    const previous = this.entries.get(entry.id);
    if (previous) {
      this.bytes -= previous.wav.length;
      this.entries.delete(entry.id);
    }
    while (
      this.entries.size &&
      (this.entries.size >= this.limits.cacheEntries ||
        this.bytes + entry.wav.length > this.limits.cacheBytes)
    ) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.wav.length;
      this.entries.delete(oldest);
    }
    this.entries.set(entry.id, entry);
    this.bytes += entry.wav.length;
    return entry;
  }
  reserve(user: string, scope: string, requestId: string, chars: number, now = Date.now()) {
    this.prune(now);
    if (this.jobs.has(user))
      throw new AppError(
        "Another audiobook passage is being prepared. Wait or cancel it first.",
        409,
      );
    if (this.jobs.size >= this.limits.concurrent)
      throw new AppError("Audiobook generation is busy. Try again shortly.", 429);
    let budget = this.budgets.get(user);
    if (!budget || now - budget.started >= 3600000) {
      if (!budget && this.budgets.size >= 128)
        throw new AppError("Audiobook generation is at capacity.", 429);
      budget = { started: now, chars: 0, requestStart: now, requests: 0 };
    }
    if (now - budget.requestStart >= 600000) {
      budget.requestStart = now;
      budget.requests = 0;
    }
    if (
      budget.chars + chars > this.limits.charsPerHour ||
      budget.requests >= this.limits.requestsPerTenMinutes
    )
      throw new AppError(
        "Audiobook generation usage limit reached. Wait before requesting more audio.",
        429,
      );
    budget.chars += chars;
    budget.requests++;
    this.budgets.set(user, budget);
    const job = { scope, requestId, controller: new AbortController() };
    this.jobs.set(user, job);
    return {
      signal: job.controller.signal,
      cancel: () => job.controller.abort(),
      release: () => {
        if (this.jobs.get(user) === job) this.jobs.delete(user);
      },
    };
  }
  cancel(user: string, scope: string, requestId: string) {
    const job = this.jobs.get(user);
    if (job?.scope === scope && job.requestId === requestId) job.controller.abort();
  }
}
export const readerSpeechStore = new ReaderSpeechStore();
