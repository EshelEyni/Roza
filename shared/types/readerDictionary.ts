export interface ReaderDictionarySense {
  id: string;
  partOfSpeech: string;
  meanings: string[];
  explanations: string[];
  definition: string;
  examples: string[];
}

export interface ReaderDictionaryEntry {
  word: string;
  headword: string;
  source: string;
  senses: ReaderDictionarySense[];
}

export interface ReaderLookupResult {
  entry: ReaderDictionaryEntry | null;
  lookupCount?: number;
}
