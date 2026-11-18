import type { ReaderAiModel } from "../../../../shared/types/readerAiSettings";
export type ReaderAiInput = {
    role: "user" | "assistant";
    content: string;
};
export type ReaderAiTools = {
    definitions: {
        type: "function";
        name: string;
        description: string;
        strict: boolean;
        parameters: Record<string, unknown>;
    }[];
    execute: (name: string, args: unknown) => unknown | Promise<unknown>;
};
declare function askReaderAi(instructions: string, input: ReaderAiInput[], selectedModel?: ReaderAiModel, purpose?: "answer" | "summary" | "edit", editOutputTokens?: number, bookTools?: ReaderAiTools): Promise<string>;
export { askReaderAi };
