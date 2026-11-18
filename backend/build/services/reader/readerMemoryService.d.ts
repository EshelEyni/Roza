import type { ReaderAiInput } from "./readerAiService";
export type ReaderMemoryTurn = {
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
export type ReaderMemorySummary = {
    text: string;
    turnIds: string[];
    sourceHashes: string[];
    spoilersAllowed: boolean;
    model: string;
    createdAt: Date;
};
export declare function eligibleReaderTurns(turns: ReaderMemoryTurn[], requestId: string, currentCfi: string, allow: boolean, isAtOrBefore: (earlier: string, current: string) => boolean): {
    completed: ReaderMemoryTurn[];
    eligible: ReaderMemoryTurn[];
};
export declare function compatibleReaderSummary(summary: ReaderMemorySummary | undefined, eligible: ReaderMemoryTurn[], allow: boolean, model: string): ReaderMemorySummary | undefined;
type Summarize = (instructions: string, input: ReaderAiInput[]) => Promise<string>;
export declare function updateReaderSummary(eligible: ReaderMemoryTurn[], saved: ReaderMemorySummary | undefined, allow: boolean, model: string, summarize: Summarize): Promise<{
    summary: ReaderMemorySummary | undefined;
    updated: boolean;
    failed: boolean;
}>;
export {};
