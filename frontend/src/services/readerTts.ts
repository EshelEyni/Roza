export type AudiobookWord = { text: string; start: number; end: number };
export type AudiobookSentence = { text: string; cfi: string; paragraph: number; words: AudiobookWord[]; startWord: number };
export type AudiobookSection = {
  section: number; title: string; sentences: AudiobookSentence[]; totalWords: number;
  start: number; offset: number; previous: number | null; next: number | null;
};

export function audiobookWords(text: string): AudiobookWord[] {
  return Array.from(text.matchAll(/\S+/gu), match => ({
    text: match[0], start: match.index!, end: match.index! + match[0].length,
  }));
}
export function audiobookWordAt(words: AudiobookWord[], offset: number) {
  const index = words.findIndex(word => word.end > offset);
  return index < 0 ? Math.max(0, words.length - 1) : index;
}
/** Utterances remain bounded without dropping text from long sentences. */
export function audiobookSpeechSlice(text: string, offset: number, limit = 260) {
  let end = Math.min(text.length, offset + limit);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > offset) end = space;
    else if (/[\uD800-\uDBFF]/u.test(text[end - 1])) end--;
  }
  return { text: text.slice(offset, end), end };
}
export function audiobookSeek(section: AudiobookSection, word: number) {
  const target = Math.max(0, Math.min(section.totalWords - 1, Math.floor(word)));
  const index = section.sentences.findIndex(sentence => sentence.startWord + sentence.words.length > target);
  const sentence = Math.max(0, index);
  const item = section.sentences[sentence];
  return { sentence, offset: item?.words[Math.max(0, target - item.startWord)]?.start || 0 };
}
export function audiobookTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  return Math.floor(rounded / 60) + ":" + String(rounded % 60).padStart(2, "0");
}
