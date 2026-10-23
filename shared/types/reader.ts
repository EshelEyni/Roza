export type ReaderPreferences = {
  fontSize: number;
  fontFamily: "serif" | "sans-serif";
  lineHeight: number;
  width: "comfortable" | "wide";
  theme: "light" | "sepia" | "dark";
  flow: "paginated" | "scrolled";
};

export type ReaderState = {
  location: string;
  progress: number;
  savedAt: number;
  preferences: ReaderPreferences;
};

export type ReaderBook = {
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
