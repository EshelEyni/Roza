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

/** Reading mode shown in the reader; also the `?mode=` URL value. */
export type ReaderMode = "page" | "sentence" | "audiobook";

export type ReaderState = {
  location: string;
  progress: number;
  savedAt: number;
  preferences: ReaderPreferences;
  /** Last-used reading mode for this user and book. Older saves omit it. */
  mode?: ReaderMode;
};

export type ReaderAudiobookNarrator = {
  engine: "system" | "openai" | "kokoro";
  voice: string;
  name: string;
  lang: string;
};

export type ReaderLibrarySort = "recent" | "title" | "author" | "added" | "custom";

export type ReaderBook = {
  pinned?: boolean;
  audiobookNarrator?: ReaderAudiobookNarrator;
  archived?: boolean;
  id: string;
  title: string;
  author: string;
  cover: string;
  filename: string;
  fileRevision?: string;
  size: number;
  state: ReaderState;
  createdAt: string;
  updatedAt: string;
};

export type ReaderLibraryView = "all" | "reading" | "unread" | "finished" | "archived";
export type ReaderLibraryCounts = Record<Exclude<ReaderLibraryView, "archived">, number>;
export type ReaderBookPage = { books: ReaderBook[]; nextCursor: string | null; counts?: ReaderLibraryCounts; resume?: ReaderBook };
