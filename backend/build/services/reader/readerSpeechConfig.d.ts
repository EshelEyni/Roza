export declare const readerSpeechPreviewText = "The morning arrived quietly, and the world seemed full of possibility.";
export declare const readerSpeechVoices: readonly ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];
export type ReaderSpeechVoice = (typeof readerSpeechVoices)[number];
export declare const readerSpeechLimits: {
    readonly maxChars: 600;
    readonly maxUtf8Bytes: 2400;
    readonly maxPcmBytes: number;
    readonly timeoutMs: 60000;
    readonly cacheBytes: number;
    readonly cacheEntries: 128;
    readonly cacheTtlMs: number;
    readonly concurrent: 2;
    readonly requestsPerTenMinutes: 120;
    readonly charsPerHour: 200000;
    readonly sampleRate: 24000;
};
export declare function readerSpeechConfig(): {
    enabled: boolean;
    key: string;
    model: string;
    wordTimings: boolean;
    available: boolean;
};
export declare function requireReaderSpeech(): {
    enabled: boolean;
    key: string;
    model: string;
    wordTimings: boolean;
    available: boolean;
};
export declare function normalizeReaderSpeechText(text: string): string;
/** Conservative comparison: punctuation/case differences are tolerated, changed words are not. */
export declare function readerSpeechTranscriptKey(text: string): string;
