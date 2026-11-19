import type { ReaderMode } from "../../../shared/types/reader";

export const readerModes: readonly ReaderMode[] = ["page", "sentence", "audiobook"];

export function parseReaderMode(value: unknown): ReaderMode | null {
  return typeof value === "string" && (readerModes as readonly string[]).includes(value)
    ? (value as ReaderMode)
    : null;
}

/**
 * Mode to open a book in: an explicit valid `?mode=` wins, an invalid one falls
 * back to Page Mode, and without one the user's last mode for this book is used.
 */
export function resolveInitialReaderMode(urlMode: string | null, stored: unknown): ReaderMode {
  if (urlMode !== null) return parseReaderMode(urlMode) ?? "page";
  return parseReaderMode(stored) ?? "page";
}

/** Query string with `mode` set and every other parameter kept in place. */
export function readerSearchWithMode(search: string, mode: ReaderMode) {
  const params = new URLSearchParams(search);
  params.set("mode", mode);
  return "?" + params.toString();
}

/** Destination parameters (flag, location, action) without the mode, so mode changes never re-navigate. */
export function readerDestinationKey(search: string) {
  const params = new URLSearchParams(search);
  params.delete("mode");
  return params.toString();
}

/** In-app path to return to after login; rejects external and protocol-relative targets. */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\"))
    return null;
  return value;
}
