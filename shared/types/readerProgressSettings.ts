export type ReaderProgressDisplay = "percentage" | "section" | "book";
export type ReaderProgressSettings = { defaultProgressDisplay: ReaderProgressDisplay };
export const defaultReaderProgressSettings: ReaderProgressSettings = { defaultProgressDisplay: "percentage" };
export function isReaderProgressSettings(value: unknown): value is ReaderProgressSettings {
  return !!value && typeof value === "object" &&
    ["percentage", "section", "book"].indexOf((value as ReaderProgressSettings).defaultProgressDisplay) !== -1;
}
