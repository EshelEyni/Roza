import type { RsvpWord } from "./readerRsvp";

export type TtsCursor = { section: number; word: number; offset: number };
export type TtsPassage = { text: string; next: TtsCursor | null };

/** One bounded paragraph chunk, with an exact continuation even for oversized tokens. */
export function ttsChunk(words: RsvpWord[], start: number, offset = 0, limit = 400) {
  let text = "";
  let word = Math.max(0, start);
  let remainingOffset = offset;
  for (; word < words.length; word++) {
    const part = words[word].text.slice(remainingOffset);
    const separator = text ? " " : "";
    if (text && text.length + separator.length + part.length > limit) break;
    const available = limit - text.length - separator.length;
    text += separator + part.slice(0, available);
    if (part.length > available) return { text, word, offset: remainingOffset + available };
    remainingOffset = 0;
    if (words[word].paragraphEnd) { word++; break; }
  }
  return { text, word, offset: 0 };
}

export function ttsPassage(words: RsvpWord[], start: number, limit = 400) {
  return ttsChunk(words, start, 0, limit).text;
}
