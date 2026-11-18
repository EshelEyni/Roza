import type { ReaderSpeechWordTiming } from "./readerSpeechAlignment";
export type SpeechAudio = {
    wav: Buffer;
    durationSeconds: number;
    transcript: string;
    wordTimings?: ReaderSpeechWordTiming[] | null;
};
export type SpeechEntry = SpeechAudio & {
    id: string;
    scope: string;
    model: string;
    voice: string;
    text: string;
    expiresAt: number;
};
export declare class ReaderSpeechStore {
    private limits;
    private entries;
    private jobs;
    private budgets;
    private bytes;
    constructor(limits?: {
        cacheBytes: number;
        cacheEntries: number;
        cacheTtlMs: number;
        concurrent: number;
        requestsPerTenMinutes: number;
        charsPerHour: number;
    });
    key(scope: string, model: string, voice: string, text: string, aligned?: boolean): string;
    private prune;
    get(id: string, scope: string, now?: number): SpeechEntry | undefined;
    put(input: Omit<SpeechEntry, "expiresAt">, now?: number): {
        expiresAt: number;
        id: string;
        model: string;
        text: string;
        scope: string;
        voice: string;
        wav: Buffer;
        durationSeconds: number;
        transcript: string;
        wordTimings?: ReaderSpeechWordTiming[] | null;
    };
    reserve(user: string, scope: string, requestId: string, chars: number, now?: number): {
        signal: AbortSignal;
        cancel: () => void;
        release: () => void;
    };
    cancel(user: string, scope: string, requestId: string): void;
}
export declare const readerSpeechStore: ReaderSpeechStore;
