import type { ReaderContext } from "./readerContextService";
import type { ReaderAiTools } from "./readerAiService";
type Excerpt = {
    label: string;
    text: string;
};
export declare const readerBookToolDefinitions: {
    type: "function";
    name: string;
    description: string;
    strict: boolean;
    parameters: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
        additionalProperties: boolean;
    };
}[];
export declare function createReaderBookTools(context: ReaderContext, currentCfi: string, allow: boolean): {
    tools: ReaderAiTools;
    excerpts: Excerpt[];
};
export {};
