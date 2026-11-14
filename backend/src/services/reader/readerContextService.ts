import { readerAiConfig } from "./readerAiConfig";
import AdmZip from "adm-zip";
import {
  DOMParser,
  Node as XmlNode,
  Document as XmlDocument,
  Element as XmlElement,
} from "@xmldom/xmldom";
import path from "path";
import { AppError } from "../error/errorService";
import type { ReaderPassage } from "../../../../shared/types/readerChat";

const MAX_CONTEXT_CHARS = readerAiConfig.maxBookContextChars;
const MAX_PASSAGE_CHARS = readerAiConfig.maxPassageChars;
type Section = { href: string; source: string; linear: boolean; name: string };
type Chapter = { section: number; start: number; title: string };
const stopWords = new Set("the and this that what does with from about why how explain book was were has have who when where which their there would could should".split(" "));
function termsFor(text: string) {
  return (text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).filter(term => !stopWords.has(term));
}
type Position = { index: number; start: string; end: string };

function parseXml(source: string) {
  return new DOMParser().parseFromString(source, "application/xhtml+xml");
}
function elements(document: XmlDocument, name: string) {
  return Array.from(document.getElementsByTagNameNS("*", name));
}
function resolve(base: string, href: string) {
  const target = path.posix.normalize(
    path.posix.join(path.posix.dirname(base), decodeURIComponent(href.split("#")[0])),
  );
  if (target.startsWith("../") || target.startsWith("/") || target.includes("\\"))
    throw new AppError("Invalid book resource.", 400);
  return target;
}
function parsePosition(cfi: string): Position {
  if (typeof cfi !== "string" || cfi.length > 4096 || !/^epubcfi\(.+\)$/.test(cfi))
    throw new AppError("A valid current reading position is required.", 400);
  const clean = cfi.slice(8, -1).replace(/\[(?:\^.|[^\]])*\]/g, "");
  const [base, local] = clean.split("!");
  const steps = base.split("/").filter(Boolean);
  const spineStep = Number(steps[steps.length - 1]);
  if (!local || !Number.isInteger(spineStep) || spineStep < 2 || spineStep % 2)
    throw new AppError("Unsupported reading position.", 400);
  const parts = local.split(",");
  if (parts.length !== 1 && parts.length !== 3)
    throw new AppError("Unsupported passage position.", 400);
  return {
    index: spineStep / 2 - 1,
    start: parts.length === 3 ? parts[0] + parts[1] : local,
    end: parts.length === 3 ? parts[0] + parts[2] : local,
  };
}
function documentText(document: XmlDocument) {
  let text = "";
  const offsets = new Map<XmlNode, number>();
  function visit(node: XmlNode) {
    offsets.set(node, text.length);
    if (node.nodeType === 3 || node.nodeType === 4) {
      text += node.nodeValue || "";
      return;
    }
    if (node.nodeType === 1 && /^(head|script|style)$/i.test((node as XmlElement).localName || ""))
      return;
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
    if (
      node.nodeType === 1 &&
      /^(p|div|section|li|h[1-6]|blockquote|br)$/i.test((node as XmlElement).localName || "")
    )
      text += "\n";
  }
  visit(document.documentElement!);
  return { text, offsets };
}
function offsetAt(document: XmlDocument, offsets: Map<XmlNode, number>, point: string) {
  const match = point.match(/^(\/(?:\d+\/)*\d+)(?::(\d+))?(?:;s=[ab])?$/);
  if (!match)
    throw new AppError("Unsupported reading position. Navigate to the passage again.", 400);
  let node: XmlNode = document.documentElement!;
  for (const step of match[1].split("/").filter(Boolean).map(Number)) {
    const children = Array.from(node.childNodes).filter(
      child => child.nodeType === (step % 2 ? 3 : 1),
    );
    node = children[step % 2 ? (step - 1) / 2 : step / 2 - 1];
    if (!node)
      throw new AppError("This position is no longer in the book. Navigate to it again.", 400);
  }
  const start = offsets.get(node);
  const offset = Number(match[2] || 0);
  if (start === undefined || (node.nodeType === 3 && offset > (node.nodeValue || "").length))
    throw new AppError("Invalid reading position.", 400);
  return start + offset;
}

class ReaderContext {
  private sections: Section[];
  private navigation: { name: string; fragment: string; title: string }[] = [];
  private chapters?: Chapter[];
  private index?: { texts: string[]; chunks: { section: number; start: number; end: number }[]; postings: Map<string, Set<number>> };
  get cacheBytes() { return this.sections.reduce((sum, section) => sum + section.source.length * 16, 0); }
  private searchIndex() {
    if (this.index) return this.index;
    const chunks: { section: number; start: number; end: number }[] = [];
    const postings = new Map<string, Set<number>>();
    const texts = this.sections.map((_, index) => this.section(index).text);
    texts.forEach((text, section) => {
      for (let start = 0; start < text.length; start += 1800) {
        const end = Math.min(text.length, start + 2200);
        const id = chunks.length;
        chunks.push({ section, start, end });
        for (const word of new Set(termsFor(text.slice(start, end)))) {
          let posting = postings.get(word);
          if (!posting) postings.set(word, posting = new Set());
          posting.add(id);
        }
      }
    });
    return this.index = { chunks, postings, texts };
  }
  constructor(buffer: Buffer) {
    const zip = new AdmZip(buffer);
    const container = parseXml(zip.readAsText("META-INF/container.xml"));
    const root = elements(container, "rootfile")[0]?.getAttribute("full-path");
    if (!root) throw new AppError("Book context is unavailable.", 400);
    const pkg = parseXml(zip.readAsText(root));
    const manifest = new Map(
      elements(pkg, "item").map(item => [item.getAttribute("id"), item.getAttribute("href") || ""]),
    );
    this.sections = elements(pkg, "itemref").map(item => {
      const href = manifest.get(item.getAttribute("idref"));
      if (!href) throw new AppError("Book context is unavailable.", 400);
      const name = resolve(root, href);
      return { href, name, source: zip.readAsText(name), linear: item.getAttribute("linear") !== "no" };
    });
    // Use EPUB 3 TOC links, or EPUB 2 NCX navigation, rather than assuming file = chapter.
    const navItem = elements(pkg, "item").find(item => (item.getAttribute("properties") || "").split(/\s+/).includes("nav"));
    const ncxId = elements(pkg, "spine")[0]?.getAttribute("toc");
    const ncxItem = elements(pkg, "item").find(item => item.getAttribute("id") === ncxId);
    const navigationItem = navItem || ncxItem;
    if (navigationItem) {
      try {
        const navPath = resolve(root, navigationItem.getAttribute("href") || "");
        const nav = parseXml(zip.readAsText(navPath));
        const toc = elements(nav, "nav").find(node => /(?:^|\s)toc(?:\s|$)/.test(node.getAttribute("epub:type") || node.getAttribute("type") || ""));
        const links = navItem ? (toc ? Array.from(toc.getElementsByTagNameNS("*", "a")) : []) : elements(nav, "navPoint");
        for (const link of links) {
          const href = navItem ? link.getAttribute("href") : link.getElementsByTagNameNS("*", "content")[0]?.getAttribute("src");
          const title = navItem ? link.textContent : link.getElementsByTagNameNS("*", "text")[0]?.textContent;
          if (!href) continue;
          this.navigation.push({ name: resolve(navPath, href), fragment: decodeURIComponent(href.split("#")[1] || ""), title: (title || "").trim().slice(0, 200) });
        }
      } catch {
        // Optional navigation failure must not disable readable spine content.
        this.navigation = [];
      }
    }
  }
  private section(index: number) {
    const section = this.sections[index];
    if (!section) throw new AppError("Reading position is outside this book.", 400);
    const document = parseXml(section.source);
    // Match protectReaderDocument, which inserts a head before EPUB.js creates CFIs.
    if (!elements(document, "head").length) {
      const head = document.createElementNS("http://www.w3.org/1999/xhtml", "head");
      document.documentElement!.insertBefore(head, document.documentElement!.firstChild);
    }
    return { ...section, document, ...documentText(document) };
  }

  private chapterIndex() {
    if (this.chapters) return this.chapters;
    const chapters: Chapter[] = [];
    this.sections.forEach((section, sectionIndex) => {
      const document = this.section(sectionIndex);
      const links = this.navigation.filter(link => link.name === section.name);
      for (const link of links) {
        const target = link.fragment ? Array.from(document.document.getElementsByTagName("*")).find(node => node.getAttribute("id") === link.fragment || node.getAttribute("name") === link.fragment) : document.document.documentElement;
        const start = target ? document.offsets.get(target) : undefined;
        if (start === undefined || chapters.some(chapter => chapter.section === sectionIndex && chapter.start === start)) continue;
        chapters.push({ section: sectionIndex, start, title: link.title || "Section " + (sectionIndex + 1) });
      }
    });
    if (!chapters.length) {
      this.sections.forEach((section, index) => {
        if (section.linear) chapters.push({ section: index, start: 0, title: "Section " + (index + 1) });
      });
    } else {
      // Chapters may span multiple spine resources. Do not split those at file boundaries.
      const first = [...chapters].sort((a, b) => a.section - b.section || a.start - b.start)[0];
      for (let section = 0; section <= first.section; section++) {
        const text = this.section(section).text.slice(0, section === first.section ? first.start : undefined);
        if (this.sections[section].linear && text.trim()) chapters.push({ section, start: 0, title: "Section " + (section + 1) });
      }
    }
    return this.chapters = chapters.sort((a, b) => a.section - b.section || a.start - b.start);
  }
  private accessiblePosition(currentCfi: string) {
    const position = parsePosition(currentCfi);
    const section = this.section(position.index);
    return { section: position.index, offset: offsetAt(section.document, section.offsets, position.end) };
  }
  private chapterAt(section: number, offset: number) {
    const chapters = this.chapterIndex();
    let result = 0;
    chapters.forEach((chapter, index) => {
      if (chapter.section < section || (chapter.section === section && chapter.start <= offset)) result = index;
    });
    return result;
  }
  bookContents(currentCfi: string, allow: boolean, start = 0) {
    const boundary = this.accessiblePosition(currentCfi);
    const chapters = this.chapterIndex();
    const current = this.chapterAt(boundary.section, boundary.offset);
    const visible = chapters.filter(chapter => allow || chapter.section < boundary.section ||
      (chapter.section === boundary.section && chapter.start < boundary.offset));
    return {
      currentChapter: "chapter-" + (current + 1),
      spoilerRestricted: !allow,
      note: "Chapter IDs follow EPUB navigation with spine-section fallbacks; they are not printed chapter numbers. Only accessible entries are listed.",
      chapters: visible.slice(start, start + 60).map(chapter => ({
        id: "chapter-" + (chapters.indexOf(chapter) + 1), title: chapter.title,
      })),
      nextStart: start + 60 < visible.length ? start + 60 : null,
    };
  }
  readChapter(currentCfi: string, allow: boolean, chapterId: string, start = 0, maxChars = 24000) {
    const boundary = this.accessiblePosition(currentCfi);
    const chapters = this.chapterIndex();
    const current = this.chapterAt(boundary.section, boundary.offset);
    const chapterIndex = chapterId === "current" ? current : chapterId === "next" ? current + 1 :
      chapterId === "previous" ? current - 1 : /^chapter-[1-9][0-9]*$/.test(chapterId) ? Number(chapterId.slice(8)) - 1 : -1;
    const chapter = chapters[chapterIndex];
    if (!chapter) return { error: "That chapter is unavailable in this edition." };
    // Check before exposing future titles, resource names, lengths, or text.
    if (!allow && (chapter.section > boundary.section || (chapter.section === boundary.section && chapter.start >= boundary.offset)))
      return { error: "This chapter is beyond the reading boundary. Enable spoilers to read it." };
    const end = chapters[chapterIndex + 1];
    const texts = this.searchIndex().texts;
    const excerpts: { label: string; text: string }[] = [];
    let skip = start;
    let remaining = maxChars;
    let accessibleLength = 0;
    let restricted = false;
    for (let section = chapter.section; section < texts.length; section++) {
      if (end && (section > end.section || (section === end.section && end.start === 0))) break;
      const from = section === chapter.section ? chapter.start : 0;
      const chapterEnd = end && section === end.section ? end.start : texts[section].length;
      let to = chapterEnd;
      if (!allow && section >= boundary.section) {
        to = section === boundary.section ? Math.min(to, boundary.offset) : 0;
        if (to < chapterEnd) restricted = true;
      }
      const length = Math.max(0, to - from);
      accessibleLength += length;
      const offset = from + Math.min(skip, length);
      skip = Math.max(0, skip - length);
      if (remaining && offset < to) {
        const last = Math.min(to, offset + remaining);
        excerpts.push({ label: "Section " + (section + 1) + ": " + this.sections[section].href + " [characters " + offset + "-" + last + "]", text: texts[section].slice(offset, last) });
        remaining -= last - offset;
      }
      if (end && section === end.section) break;
    }
    const consumed = maxChars - remaining;
    return { chapter: "chapter-" + (chapterIndex + 1), title: chapter.title, excerpts,
      nextStart: start + consumed < accessibleLength ? start + consumed : null,
      complete: start === 0 && consumed === accessibleLength && !restricted,
      restricted, note: restricted ? "Only the already-read portion is available; do not summarize the unread remainder." : undefined };
  }
  readBook(currentCfi: string, allow: boolean, chapterId: string, start = 0) {
    const page = this.readChapter(currentCfi, allow, chapterId, start);
    if (!page.chapter) return { ...page, next: null };
    const chapters = this.chapterIndex();
    const nextIndex = Number(page.chapter!.slice(8));
    const boundary = this.accessiblePosition(currentCfi);
    const next = chapters[nextIndex];
    const accessible = next && (allow || next.section < boundary.section ||
      (next.section === boundary.section && next.start < boundary.offset));
    return { ...page, next: page.nextStart !== null ? { chapter: page.chapter, start: page.nextStart } :
      accessible ? { chapter: "chapter-" + (nextIndex + 1), start: 0 } : null,
      coverage: "This is one paginated chapter of the book. Follow next to read sequentially. Never claim full-book coverage until all accessible chapters and pages have been read." };
  }

  isAtOrBefore(earlier: string, current: string) {
    try {
      return this.comparePositions(earlier, current);
    } catch (error) {
      // An unresolvable historical boundary must not block the new question or
      // admit history whose spoiler boundary cannot be established.
      if (error instanceof AppError) return false;
      throw error;
    }
  }
  private comparePositions(earlier: string, current: string) {
    const a = parsePosition(earlier);
    const b = parsePosition(current);
    const earlierSection = this.section(a.index);
    const currentSection = a.index === b.index ? earlierSection : this.section(b.index);
    const earlierOffset = offsetAt(earlierSection.document, earlierSection.offsets, a.end);
    const currentOffset = offsetAt(currentSection.document, currentSection.offsets, b.end);
    return a.index !== b.index ? a.index < b.index : earlierOffset <= currentOffset;
  }
  passage(cfi: string, endCfi?: string) {
    const position = parsePosition(cfi);
    if (endCfi !== undefined) {
      const endPosition = parsePosition(endCfi);
      if (endPosition.index < position.index) throw new AppError("Invalid selected passage.", 400);
      const pieces: string[] = [];
      for (let index = position.index; index <= endPosition.index; index++) {
        const section = this.section(index);
        if (!section.linear && index !== position.index && index !== endPosition.index) continue;
        const start =
          index === position.index
            ? offsetAt(section.document, section.offsets, position.start)
            : 0;
        const end =
          index === endPosition.index
            ? offsetAt(section.document, section.offsets, endPosition.end)
            : section.text.length;
        if (end < start) throw new AppError("Invalid selected passage.", 400);
        pieces.push(section.text.slice(start, end).trim());
        if (pieces.join("\n").length > MAX_PASSAGE_CHARS)
          throw new AppError("Select a passage of up to 20,000 characters.", 400);
      }
      const text = pieces.join("\n").trim();
      if (!text) throw new AppError("Select a passage containing text.", 400);
      return { cfi, endCfi, text };
    }
    const section = this.section(position.index);
    const start = offsetAt(section.document, section.offsets, position.start);
    const end = offsetAt(section.document, section.offsets, position.end);
    if (end <= start || end - start > MAX_PASSAGE_CHARS)
      throw new AppError("Select a passage of up to 20,000 characters.", 400);
    const text = section.text.slice(start, end).trim();
    if (!text) throw new AppError("Select a passage containing text.", 400);
    return { cfi, text };
  }
  retrieve(
    question: string,
    currentCfi: string,
    spoilersAllowed: boolean,
    selected?: ReaderPassage | string,
    passageEndCfi?: string,
  ) {
    if (!selected || typeof selected === "string")
      return this.retrieveAtPosition(question, currentCfi, spoilersAllowed, selected, passageEndCfi);

    // Text saved by createConversation was extracted from the owned edition.
    // Its CFI enriches that text; it is not a prerequisite for using it. Keep
    // selected-passage questions anchored to the selection, not today's page.
    const passage = selected.text.slice(0, MAX_PASSAGE_CHARS).trim();
    if (!passage) throw new AppError("The saved passage is unavailable. Select it again.", 400);
    try {
      const result = this.retrieveAtPosition(question, selected.endCfi || selected.cfi, spoilersAllowed, selected.cfi, selected.endCfi);
      // A shifted CFI can still resolve to different words. Do not substitute
      // that text or its surroundings for the original passage.
      if (result.passage === passage) return { ...result, passage };
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
    return { passage, context: [] };
  }
  private retrieveAtPosition(
    question: string,
    currentCfi: string,
    spoilersAllowed: boolean,
    passageCfi?: string,
    passageEndCfi?: string,
  ) {
    const position = parsePosition(currentCfi);
    const current = this.section(position.index);
    const boundary = offsetAt(current.document, current.offsets, position.end);
    const terms = [...new Set(termsFor(question))].slice(0, 40);
    const excerpts: { label: string; text: string; score: number }[] = [];
    const add = (label: string, text: string, score: number) => {
      const clean = text.trim();
      if (clean && !excerpts.some(entry => entry.text === clean))
        excerpts.push({ label, text: clean, score });
    };
    let passage = "";
    if (passageCfi) {
      const anchor = parsePosition(passageCfi);
      const selected = this.section(anchor.index);
      const start = offsetAt(selected.document, selected.offsets, anchor.start);
      const end = passageEndCfi
        ? selected.text.length
        : offsetAt(selected.document, selected.offsets, anchor.end);
      if (spoilersAllowed || this.isAtOrBefore(passageEndCfi || passageCfi, currentCfi)) {
        passage = this.passage(passageCfi, passageEndCfi).text;
        // The selected passage is sent separately; spend the excerpt budget on its surroundings.
        add("Before selected passage", selected.text.slice(Math.max(0, start - 2500), start), 100);
        const finalPosition = passageEndCfi ? parsePosition(passageEndCfi) : anchor;
        const finalSection = finalPosition.index === anchor.index ? selected : this.section(finalPosition.index);
        const finalEnd = passageEndCfi
          ? offsetAt(finalSection.document, finalSection.offsets, finalPosition.end) : end;
        const cutoff = spoilersAllowed || finalPosition.index < position.index
          ? finalSection.text.length : boundary;
        add("After selected passage", finalSection.text.slice(finalEnd, Math.min(cutoff, finalEnd + 1500)), 99);
      }
    }
    add(
      "At current reading position",
      current.text.slice(Math.max(0, boundary - 4000), boundary),
      90,
    );
    const index = this.searchIndex();
    const candidates = new Set<number>();
    for (const term of terms) for (const id of index.postings.get(term) || []) candidates.add(id);
    const ranked: { id: number; score: number; text: string; end: number }[] = [];
    for (const id of candidates) {
      const chunk = index.chunks[id];
      if (!spoilersAllowed && (chunk.section > position.index ||
          (chunk.section === position.index && chunk.start >= boundary))) continue;
      const end = !spoilersAllowed && chunk.section === position.index ? Math.min(chunk.end, boundary) : chunk.end;
      const text = index.texts[chunk.section].slice(chunk.start, end);
      // Re-score clipped text so inaccessible words cannot select a passage.
      const words = termsFor(text);
      const frequencies = new Map<string, number>();
      for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1);
      const score = terms.reduce((sum, term) => {
        const frequency = frequencies.get(term) || 0;
        return sum + (frequency ? Math.log(1 + index.chunks.length / (index.postings.get(term)?.size || 1)) *
          frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * words.length / 350)) : 0);
      }, 0);
      if (score) ranked.push({ id, score, text, end });
    }
    const perSection = new Map<number, number>();
    let hits = 0;
    for (const hit of ranked.sort((a, b) => b.score - a.score)) {
      const chunk = index.chunks[hit.id];
      const count = perSection.get(chunk.section) || 0;
      if (count >= 2) continue;
      perSection.set(chunk.section, count + 1);
      add("Section " + (chunk.section + 1) + ": " + this.sections[chunk.section].href +
        " [characters " + chunk.start + "-" + hit.end + "]", hit.text, 95 + hit.score / (1 + hit.score));
      if (++hits >= 6) break;
    }
    let remaining = MAX_CONTEXT_CHARS;
    const context = excerpts
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(entry => {
        // Keep referenced ranges exact; omit a whole excerpt if the budget is exhausted.
        const text = entry.text.length <= remaining ? entry.text : "";
        remaining -= text.length;
        return { label: entry.label, text };
      })
      .filter(entry => entry.text);
    return { passage, context };
  }
}

export { ReaderContext, MAX_CONTEXT_CHARS, MAX_PASSAGE_CHARS };
