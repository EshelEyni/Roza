import type Section from "epubjs/types/section";

export type ReaderSearchResult = {
  cfi: string;
  sectionTitle: string;
  before: string;
  match: string;
  after: string;
};

export type ReaderSearchSection = {
  section: Section;
  title: string;
  count: number;
  nextMatch: number;
  nextOffset: number;
};

export type ReaderSearchSession = {
  query: string;
  total: number;
  sections: ReaderSearchSection[];
};

export type ReaderPanel = "contents" | "settings" | "search" | "chat";
export type ReaderDirection = "next" | "prev";
export interface ReaderTextSelection {
  text: string;
  word?: string;
  cfi: string;
  x: number;
  y: number;
  endCfi?: string;
}
