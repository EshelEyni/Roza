import type { RsvpWord } from "./readerRsvp";

/** Bound inference to one paragraph (or 400 characters), starting at the CFI word. */
export function ttsPassage(words: RsvpWord[], start: number, limit = 400) {
  let text = "";
  for (let i = Math.max(0, start); i < words.length; i++) {
    const next = text ? text + " " + words[i].text : words[i].text;
    if (next.length > limit) return text || words[i].text.slice(0, limit);
    text = next;
    if (words[i].paragraphEnd) break;
  }
  return text;
}

export const kokoroVoices = [
  { value: "af_heart", label: "Heart · American English" },
  { value: "af_bella", label: "Bella · American English" },
  { value: "am_michael", label: "Michael · American English" },
  { value: "bf_emma", label: "Emma · British English" },
  { value: "bm_george", label: "George · British English" },
];
