export type ReaderPreferences = {
  fontSize: number;
  fontFamily: "serif" | "sans-serif";
  lineHeight: number;
  width: "comfortable" | "wide";
  theme: "light" | "sepia" | "dark";
  flow: "paginated" | "scrolled";
  backgroundColor?: string;
  selectionColor?: string;
  selectionTextColor?: string;
  passageColor?: string;
  passageTextColor?: string;
  translationColor?: string;
  translationTextColor?: string;
  pageNumbering?: "screen" | "publisher";
};

export type ReaderState = {
  location: string;
  progress: number;
  savedAt: number;
  preferences: ReaderPreferences;
};

export type ReaderAudiobookNarrator = {
  engine: "system" | "openai";
  voice: string;
  name: string;
  lang: string;
};

export type ReaderBook = {
  audiobookNarrator?: ReaderAudiobookNarrator;
  archived?: boolean;
  id: string;
  title: string;
  author: string;
  cover: string;
  filename: string;
  size: number;
  state: ReaderState;
  createdAt: string;
  updatedAt: string;
};

export type ReaderBookPage = { books: ReaderBook[]; nextCursor: string | null };
