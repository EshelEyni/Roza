export type ReaderSpeechWordTiming = {
    startChar: number;
    endChar: number;
    startSeconds: number;
    endSeconds: number;
};
/** Match timestamped recognized words to exact UTF-16 source ranges, never guesses. */
export declare function matchReaderSpeechWords(text: string, words: unknown, duration: number): ReaderSpeechWordTiming[] | null;
/** Timestamp-capable Whisper is temporary (retirement: 2027-02-26).
 * Failure is nonfatal: keep the generated narration with passage highlighting.
 */
export declare function alignReaderSpeech(text: string, wav: Buffer, duration: number, apiKey: string, signal: AbortSignal, request?: typeof fetch, timeoutMs?: number): Promise<ReaderSpeechWordTiming[] | null>;
