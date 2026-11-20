import type { ReaderChapter } from "./readerChapters";
import type { PublisherPage } from "./readerPublisherPages";

export type ReaderPageMap = {
  pages: string[];
  sections: [number, { offset: number; pages: number }][];
  chapters: ReaderChapter[];
  publisherPages: PublisherPage[];
};

const storageKey = "roza-reader-page-maps:v1";
const maxLayouts = 8;
const maxCharacters = 1_500_000;
const digests = new WeakMap<ArrayBuffer, Promise<string | null>>();

export function contentDigest(file: ArrayBuffer) {
  let digest = digests.get(file);
  if (!digest) {
    digest = (async () => {
      try {
        const bytes = await crypto.subtle.digest("SHA-256", file);
        return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
      } catch {
        return null;
      }
    })();
    digests.set(file, digest);
  }
  return digest;
}

function readEntries(): [string, ReaderPageMap][] {
  try {
    const entries = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function readPageMap(key: string) {
  const map = readEntries().find(entry => Array.isArray(entry) && entry[0] === key)?.[1];
  if (!map || !Array.isArray(map.pages) || !map.pages.length ||
    !map.pages.every(cfi => typeof cfi === "string" && cfi.startsWith("epubcfi(")) ||
    !Array.isArray(map.sections) || !Array.isArray(map.chapters) || !Array.isArray(map.publisherPages))
    return null;
  return map;
}

export function savePageMap(key: string, map: ReaderPageMap) {
  const entries = readEntries().filter(entry => Array.isArray(entry) && entry[0] !== key);
  entries.unshift([key, map]);
  while (entries.length > maxLayouts) entries.pop();
  while (entries.length) {
    const serialized = JSON.stringify(entries);
    if (serialized.length <= maxCharacters) {
      try {
        localStorage.setItem(storageKey, serialized);
        return;
      } catch {
        // Retry with fewer layouts if storage is near its quota.
      }
    }
    entries.pop();
  }
}
