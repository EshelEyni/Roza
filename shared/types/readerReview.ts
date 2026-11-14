import type { ReaderDictionaryEntry } from "./readerDictionary";
export interface ReaderFlag {
  id: string;
  bookId: string;
  cfi: string;
  endCfi: string;
  text: string;
  chapter: string;
  context: string;
  createdAt: string;
  reviewed: boolean;
}
export interface ReaderReviewData {
  flags: ReaderFlag[];
  vocabulary: {
    id: string;
    reviewed?: boolean;
    headword: string;
    entry: ReaderDictionaryEntry;
    books: { bookId: string; title: string; location: string }[];
  }[];
  books: { id: string; title: string }[];
}
