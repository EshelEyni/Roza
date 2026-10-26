export type ReaderLookupProvider = "auto" | "google";

export interface ReaderDictionaryLookup {
  word: string;
  location: string;
  requestId: string;
  provider?: ReaderLookupProvider;
}

export interface ReaderDictionarySense {
  id: string;
  partOfSpeech: string;
  meanings: string[];
  explanations: string[];
  definition: string;
  examples: string[];
  labels?: string[];
  source?: string;
  sourceUrl?: string;
}

export interface ReaderDictionaryEntry {
  word: string;
  headword: string;
  source: string;
  kind?: "translation";
  senses: ReaderDictionarySense[];
  attribution?: {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
  };
}

export interface ReaderLookupResult {
  entry: ReaderDictionaryEntry | null;
  lookupCount?: number;
}
