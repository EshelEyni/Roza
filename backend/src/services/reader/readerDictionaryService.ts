import fs from "fs";
import path from "path";
import {
  ReaderDictionaryEntry,
  ReaderDictionarySense,
} from "../../../../shared/types/readerDictionary";

interface DictionaryData {
  entries: Record<string, ReaderDictionarySense[]>;
  forms: Record<string, string[]>;
}
interface ReaderDictionaries {
  wiktionary: DictionaryData;
  wordnet: DictionaryData;
}
let dictionaries: ReaderDictionaries | undefined;

export function normalizeReaderWord(word: string) {
  return word.normalize("NFKC").replace(/[’‘]/g, "'").trim().toLowerCase();
}
const own = <T>(values: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;

function loadDictionaries(): ReaderDictionaries {
  const directory = path.resolve(__dirname, "../../../dictionary");
  return {
    wiktionary: JSON.parse(fs.readFileSync(path.join(directory, "wiktionary-en-he.json"), "utf8")),
    wordnet: JSON.parse(fs.readFileSync(path.join(directory, "english-hebrew.json"), "utf8")),
  };
}

export function lookupReaderWord(input: string): ReaderDictionaryEntry | null {
  const word = normalizeReaderWord(input);
  if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word) || word.length > 80) return null;
  dictionaries ||= loadDictionaries();
  const { wiktionary, wordnet } = dictionaries;
  const candidates = [
    word,
    ...(own(wiktionary.forms, word) || []),
    ...(own(wordnet.forms, word) || []),
    ...(word.endsWith("'s") ? [word.slice(0, -2)] : []),
  ];
  for (const headword of new Set(candidates)) {
    const wikiSenses = own(wiktionary.entries, headword);
    const senses = wikiSenses || own(wordnet.entries, headword);
    if (!senses?.length) continue;
    const source = wikiSenses ? "Wiktionary" : "Princeton WordNet 3.0 / Hebrew WordNet (OMW)";
    const attribution = wikiSenses
      ? {
          name: "Wiktionary contributors via Kaikki / Wiktextract",
          url:
            wikiSenses[0].sourceUrl ||
            "https://en.wiktionary.org/wiki/" + encodeURIComponent(headword) + "#English",
          license: "CC BY-SA 4.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        }
      : {
          name: source,
          url: "https://omwn.org/",
          license: "WordNet",
          licenseUrl: "https://wordnet.princeton.edu/license-and-commercial-use",
        };
    return { word, headword, source, senses, attribution };
  }
  return null;
}
