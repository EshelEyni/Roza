import { ReaderDictionaryEntry, ReaderLookupProvider } from "../../../../shared/types/readerDictionary";
export declare function normalizeReaderWord(word: string): string;
export declare function lookupReaderWord(input: string): ReaderDictionaryEntry | null;
export declare function lookupReaderWordWithTranslation(input: string, provider?: ReaderLookupProvider): Promise<ReaderDictionaryEntry | null>;
