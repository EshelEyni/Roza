import type { ReaderMode, ReaderPreferences } from "../../../../shared/types/reader";

/** Backend-owned runtime list; shared/types modules are imported for types only. */
export const readerModes: readonly ReaderMode[] = ["page", "sentence", "audiobook"];

export const defaultReaderPreferences: ReaderPreferences = {
  fontSize: 20,
  fontFamily: "serif",
  lineHeight: 1.7,
  width: "comfortable",
  theme: "sepia",
  flow: "paginated",
  pageNumbering: "screen",
};
