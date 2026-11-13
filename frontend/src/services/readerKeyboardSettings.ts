import type { ReaderKeyboardSettings } from "../../../shared/types/readerKeyboardSettings";
export type { ReaderKeyboardSettings } from "../../../shared/types/readerKeyboardSettings";
export const defaultReaderKeyboardSettings: ReaderKeyboardSettings = {
  unit: "words",
  count: 1,
};

export function isReaderKeyboardSettings(
  value: unknown,
): value is ReaderKeyboardSettings {
  const settings = value as ReaderKeyboardSettings | null;
  return (
    !!settings &&
    typeof settings === "object" &&
    (settings.unit === "words" || settings.unit === "sentences") &&
    Number.isSafeInteger(settings.count) &&
    settings.count >= 1
  );
}
