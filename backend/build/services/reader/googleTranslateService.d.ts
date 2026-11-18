import type { ReaderDictionaryEntry } from "../../../../shared/types/readerDictionary";
/** Word lookups keep their validation; explicit passage requests retain original text. */
export declare function translateReaderWord(word: string, passage?: boolean): Promise<ReaderDictionaryEntry | null>;
