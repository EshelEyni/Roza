import { EpubCFI, type Book, type NavItem } from "epubjs";
import type Section from "epubjs/types/section";
import { protectReaderDocument } from "./readerContentSecurity";

export type ReaderChapter = { title: string; href: string; cfi: string; section: number };
const indices = new WeakMap<Book, ReaderChapter[]>();
const pending = new WeakMap<Book, Promise<ReaderChapter[]>>();
export const readerChapters = (book: Book) => indices.get(book) || [];
export function readerChapterAt(chapters: ReaderChapter[], cfi: string) {
  if (!cfi) return null;
  const compare = new EpubCFI().compare;
  let low = 0, high = chapters.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (compare(chapters[mid].cfi, cfi) <= 0) low = mid + 1; else high = mid;
  }
  return low ? chapters[low - 1] : null;
}
export function readerChapterTitle(book: Book | undefined, cfi: string) {
  try { return book ? readerChapterAt(readerChapters(book), cfi)?.title || "" : ""; } catch { return ""; }
}
/** Only navigation entries are chapters. Spine resources are never chapter names. */
export function loadReaderChapters(book: Book): Promise<ReaderChapter[]> {
  const previous = pending.get(book);
  if (previous) return previous;
  const task = (async () => {
    await book.loaded.navigation;
    const entries: ReaderChapter[] = [];
    const documents = new Map<number, Promise<Document>>();
    const sections: Section[] = [];
    book.spine.each((section: Section) => sections.push(section));
    async function visit(items: NavItem[]) {
      for (const item of items) {
        try {
          const title = item.label.trim();
          const [path, hash = ""] = item.href.split("#");
          const section = book.spine.get(path) || sections.find(section =>
            new URL(section.url, "https://epub.invalid").pathname === new URL(book.resolve(path), "https://epub.invalid").pathname);
          if (section && title) {
            let document = documents.get(section.index);
            if (!document) {
              document = book.load(section.url).then(value => { const doc = value as Document; protectReaderDocument(doc); return doc; });
              documents.set(section.index, document);
            }
            const doc = await document;
            const fragment = decodeURIComponent(hash);
            const element = fragment ? doc.getElementById(fragment) || Array.from(doc.getElementsByTagName("a")).find(a => a.getAttribute("name") === fragment) : doc.querySelector("body") || doc.documentElement;
            if (element) entries.push({ title, href: item.href, cfi: section.cfiFromElement(element), section: section.index });
          }
        } catch { /* Ignore broken links rather than inventing chapters. */ }
        await visit(item.subitems || []);
      }
    }
    await visit(book.navigation.toc);
    const compare = new EpubCFI().compare;
    entries.sort((a, b) => compare(a.cfi, b.cfi));
    const chapters = entries.filter((entry, index) => !entries[index + 1] || compare(entry.cfi, entries[index + 1].cfi) !== 0);
    indices.set(book, chapters);
    return chapters;
  })();
  pending.set(book, task);
  return task;
}

/** Load a logical chapter even when it spans files or starts at a fragment. */
export async function loadReaderChapterItems<T extends { cfi: string }>(book: Book, target: string | number, extract: (section: Section) => T[]) {
  const chapters = await loadReaderChapters(book);
  const section = book.spine.get(target);
  if (!section) return null;
  const position = typeof target === "string" && target.startsWith("epubcfi(") ? target : (() => {
    const entry = chapters.find(chapter => chapter.href === target);
    return entry?.cfi || `epubcfi(${section.cfiBase}!/4)`;
  })();
  const chapter = readerChapterAt(chapters, position);
  const chapterIndex = chapter ? chapters.indexOf(chapter) : -1;
  const end = chapter ? chapters[chapterIndex + 1] : chapters[0];
  const first = chapter?.section ?? book.spine.first().index;
  const last = end?.section ?? book.spine.last().index;
  const compare = new EpubCFI().compare;
  const items: T[] = [];
  for (let index = first; index <= last; index++) {
    const part = book.spine.get(index);
    if (!part || part.linear === false) continue;
    await part.load(book.load.bind(book));
    for (const item of extract(part)) {
      const start = new EpubCFI(item.cfi); start.collapse(true);
      const finish = new EpubCFI(item.cfi); finish.collapse(false);
      if ((!chapter || compare(finish.toString(), chapter.cfi) > 0) && (!end || compare(start.toString(), end.cfi) < 0)) items.push(item);
    }
  }
  return { items, chapter, chapterIndex, section: first, chapters };
}
