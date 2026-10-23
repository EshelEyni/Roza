import type { Book, NavItem } from "epubjs";
import type Section from "epubjs/types/section";
import type {
  ReaderSearchResult,
  ReaderSearchSection,
  ReaderSearchSession,
} from "../types/reader";

export const READER_SEARCH_PAGE_SIZE = 25;

type TextSpan = { node: Text; start: number; end: number };
type SectionText = { document: Document; text: string; spans: TextSpan[] };

function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Search cancelled", "AbortError");
}

async function yieldToReader(signal: AbortSignal) {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  checkCancelled(signal);
}

function makePattern(query: string) {
  const escaped = query
    .trim()
    .split(/\s+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join("\\s+"), "giu");
}

function getSectionText(document: Document): SectionText {
  const root = document.querySelector("body") || document.documentElement;
  const walker = document.createTreeWalker(root, 4);
  const spans: TextSpan[] = [];
  const chunks: string[] = [];
  let length = 0;
  let previousBlock: Element | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest("script, style, [hidden], [aria-hidden=true]")
    )
      continue;
    const value = node.textContent || "";
    if (!value) continue;
    const block = parent.closest(
      "p, div, section, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, br",
    );
    if (spans.length && previousBlock !== block) {
      chunks.push(" ");
      length += 1;
    }
    spans.push({
      node: node as Text,
      start: length,
      end: length + value.length,
    });
    chunks.push(value);
    length += value.length;
    previousBlock = block;
  }
  return { document, text: chunks.join(""), spans };
}

function findPoint(spans: TextSpan[], offset: number, isEnd: boolean) {
  let low = 0;
  let high = spans.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (spans[middle].end < offset || (!isEnd && spans[middle].end === offset))
      low = middle + 1;
    else high = middle;
  }
  const span = spans[low];
  return {
    node: span.node,
    offset: Math.max(0, Math.min(span.node.length, offset - span.start)),
  };
}

function getSectionTitle(items: NavItem[], href: string): string {
  for (const item of items) {
    if (item.href.split("#")[0] === href.split("#")[0])
      return item.label.trim();
    const nested = getSectionTitle(item.subitems || [], href);
    if (nested) return nested;
  }
  return "";
}

async function loadSection(book: Book, section: Section, signal: AbortSignal) {
  checkCancelled(signal);
  // Independent documents avoid section.load/unload races with rendering and location generation.
  const document = (await book.load(section.url)) as Document;
  checkCancelled(signal);
  return getSectionText(document);
}

async function createSession(
  book: Book,
  query: string,
  signal: AbortSignal,
  onCount: (count: number) => void,
): Promise<ReaderSearchSession> {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 200)
    throw new Error("Invalid search query");
  const sections: ReaderSearchSection[] = [];
  book.spine.each((section: Section) => {
    sections.push({
      section,
      title: getSectionTitle(book.navigation.toc, section.href),
      count: 0,
      nextMatch: 0,
      nextOffset: 0,
    });
  });
  let total = 0;
  for (const entry of sections) {
    const { text } = await loadSection(book, entry.section, signal);
    const pattern = makePattern(normalized);
    let count = 0;
    while (pattern.exec(text)) {
      count += 1;
      if (count % 1024 === 0) await yieldToReader(signal);
    }
    entry.count = count;
    total += count;
    onCount(total);
    await yieldToReader(signal);
  }
  return { query: normalized, total, sections };
}

async function getResults(
  book: Book,
  session: ReaderSearchSession,
  offset: number,
  signal: AbortSignal,
): Promise<ReaderSearchResult[]> {
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("Invalid search offset");
  checkCancelled(signal);
  const results: ReaderSearchResult[] = [];
  let sectionStart = 0;
  for (const entry of session.sections) {
    if (sectionStart + entry.count <= offset) {
      sectionStart += entry.count;
      continue;
    }
    const content = await loadSection(book, entry.section, signal);
    const pattern = makePattern(session.query);
    const skip = Math.max(0, offset - sectionStart);
    let index = 0;
    // Sequential pages resume scanning at the last cursor, without retaining every match.
    if (skip >= entry.nextMatch) {
      index = entry.nextMatch;
      pattern.lastIndex = entry.nextOffset;
    }
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content.text))) {
      checkCancelled(signal);
      if (index >= skip) {
        const start = findPoint(content.spans, match.index, false);
        const end = findPoint(
          content.spans,
          match.index + match[0].length,
          true,
        );
        const range = content.document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        const excerptStart = Math.max(0, match.index - 65);
        const excerptEnd = Math.min(
          content.text.length,
          match.index + match[0].length + 100,
        );
        results.push({
          cfi: entry.section.cfiFromRange(range),
          sectionTitle: entry.title,
          before:
            (excerptStart ? "…" : "") +
            content.text.slice(excerptStart, match.index).replace(/\s+/g, " "),
          match: match[0].replace(/\s+/g, " "),
          after:
            content.text
              .slice(match.index + match[0].length, excerptEnd)
              .replace(/\s+/g, " ") +
            (excerptEnd < content.text.length ? "…" : ""),
        });
      }
      index += 1;
      entry.nextMatch = index;
      entry.nextOffset = pattern.lastIndex;
      if (results.length === READER_SEARCH_PAGE_SIZE) return results;
      if (index % 1024 === 0) await yieldToReader(signal);
    }
    sectionStart += entry.count;
    await yieldToReader(signal);
  }
  return results;
}

export default { createSession, getResults };
