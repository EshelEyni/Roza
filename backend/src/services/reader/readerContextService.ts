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
type Section = { href: string; source: string; linear: boolean };
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
      return { href, source: zip.readAsText(name), linear: item.getAttribute("linear") !== "no" };
    });
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
    const terms = [
      ...new Set(
        (question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(
          term =>
            ![
              "the",
              "and",
              "this",
              "that",
              "what",
              "does",
              "with",
              "from",
              "about",
              "why",
              "how",
              "explain",
              "book",
            ].includes(term),
        ),
      ),
    ].slice(0, 40);
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
    for (let index = 0; index < this.sections.length; index++) {
      if (!spoilersAllowed && index > position.index) break;
      const section = index === position.index ? current : this.section(index);
      const available =
        !spoilersAllowed && index === position.index
          ? section.text.slice(0, boundary)
          : section.text;
      for (let start = 0; start < available.length; start += 2200) {
        const chunk = available.slice(start, start + 2600);
        const lower = chunk.toLowerCase();
        const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
        if (score) {
          add("Section " + (index + 1) + ": " + section.href, chunk, score);
          // Keep only a small top set rather than retaining all matching book text.
          excerpts.sort((a, b) => b.score - a.score);
          if (excerpts.length > 16) excerpts.length = 16;
        }
      }
    }
    let remaining = MAX_CONTEXT_CHARS;
    const context = excerpts
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(entry => {
        const text = entry.text.slice(0, Math.max(0, remaining));
        remaining -= text.length;
        return { label: entry.label, text };
      })
      .filter(entry => entry.text);
    return { passage, context };
  }
}

export { ReaderContext, MAX_CONTEXT_CHARS, MAX_PASSAGE_CHARS };
