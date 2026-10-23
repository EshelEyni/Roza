import fs from "fs";
import path from "path";
import {
  ReaderDictionaryEntry,
  ReaderDictionarySense,
} from "../../../../shared/types/readerDictionary";

interface DictionaryData {
  source: string;
  entries: Record<string, ReaderDictionarySense[]>;
  forms: Record<string, string[]>;
}
let dictionary: DictionaryData | undefined;

export function normalizeReaderWord(word: string) {
  return word
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");
}

export function lookupReaderWord(input: string): ReaderDictionaryEntry | null {
  const word = normalizeReaderWord(input);
  if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word) || word.length > 80) return null;
  dictionary ||= JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../dictionary/english-hebrew.json"), "utf8"),
  ) as DictionaryData;
  const hasEntry = (candidate: string) =>
    Object.prototype.hasOwnProperty.call(dictionary!.entries, candidate);
  let headword = word;
  if (!hasEntry(headword)) {
    // Prefer attested irregular forms. Regular candidates are accepted only when present.
    const candidates = [
      ...(Object.prototype.hasOwnProperty.call(dictionary.forms, word)
        ? dictionary.forms[word]
        : []),
      ...(word.endsWith("'s") ? [word.slice(0, -2)] : []),
      ...(word.endsWith("ies") ? [word.slice(0, -3) + "y"] : []),
      ...(word.endsWith("s") && !word.endsWith("ss") ? [word.slice(0, -1), word.slice(0, -2)] : []),
      ...(word.endsWith("ing")
        ? [
            word.slice(0, -3),
            word.slice(0, -3) + "e",
            word.slice(0, -3).replace(/([a-z])\1$/, "$1"),
          ]
        : []),
      ...(word.endsWith("ed")
        ? [word.slice(0, -1), word.slice(0, -2), word.slice(0, -2).replace(/([a-z])\1$/, "$1")]
        : []),
    ];
    headword = candidates.find(candidate => hasEntry(candidate)) || "";
  }
  const senses = hasEntry(headword) ? dictionary.entries[headword] : undefined;
  return senses ? { word, headword, source: dictionary.source, senses } : null;
}
