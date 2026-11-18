import { type ReaderMemorySummary } from "./readerMemoryService";
import type { ReaderAiInput } from "./readerAiService";
type Turn = {
    id: string;
    question: string;
    answer: string;
    status: string;
    currentCfi?: string;
    spoilersAllowed?: boolean;
    passage?: {
        cfi: string;
        endCfi?: string;
        text: string;
    };
    excerpts?: {
        label: string;
        text: string;
    }[];
};
export declare function buildReaderHistory(turns: Turn[], requestId: string, question: string, currentCfi: string, allow: boolean, isAtOrBefore: (earlier: string, current: string) => boolean, savedSummary?: ReaderMemorySummary, model?: string): {
    input: ReaderAiInput[];
    omitted: number;
    retrievalQuery: string;
};
export {};
