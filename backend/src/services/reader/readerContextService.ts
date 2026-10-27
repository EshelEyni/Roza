import AdmZip from "adm-zip";
import {
  DOMParser,
  Node as XmlNode,
  Document as XmlDocument,
  Element as XmlElement,
} from "@xmldom/xmldom";
import path from "path";
import { AppError } from "../error/errorService";

const MAX_CONTEXT_CHARS = 8000;
const MAX_PASSAGE_CHARS = 3000;
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
    return { ...section, document, ...documentText(document) };
  }
  isAtOrBefore(earlier: string, current: string) {
    const a = parsePosition(earlier);
    const b = parsePosition(current);
    if (a.index !== b.index) return a.index < b.index;
    const section = this.section(a.index);
    return (
      offsetAt(section.document, section.offsets, a.end) <=
      offsetAt(section.document, section.offsets, b.end)
    );
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
          throw new AppError("Select a passage of up to 3,000 characters.", 400);
      }
      const text = pieces.join("\n").trim();
      if (!text) throw new AppError("Select a passage containing text.", 400);
      return { cfi, endCfi, text };
    }
    const section = this.section(position.index);
    const start = offsetAt(section.document, section.offsets, position.start);
    const end = offsetAt(section.document, section.offsets, position.end);
    if (end <= start || end - start > MAX_PASSAGE_CHARS)
      throw new AppError("Select a passage of up to 3,000 characters.", 400);
    const text = section.text.slice(start, end).trim();
    if (!text) throw new AppError("Select a passage containing text.", 400);
    return { cfi, text };
  }
  retrieve(
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
    ].slice(0, 20);
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
        const cutoff =
          spoilersAllowed || anchor.index < position.index ? selected.text.length : boundary;
        add(
          "Around selected passage",
          selected.text.slice(Math.max(0, start - 900), Math.min(cutoff, end + 600)),
          100,
        );
      }
    }
    add(
      "At current reading position",
      current.text.slice(Math.max(0, boundary - 1800), boundary),
      90,
    );
    for (let index = 0; index < this.sections.length; index++) {
      if (!spoilersAllowed && index > position.index) break;
      const section = index === position.index ? current : this.section(index);
      const available =
        !spoilersAllowed && index === position.index
          ? section.text.slice(0, boundary)
          : section.text;
      for (let start = 0; start < available.length; start += 1000) {
        const chunk = available.slice(start, start + 1200);
        const lower = chunk.toLowerCase();
        const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
        if (score) {
          add("Section " + (index + 1) + ": " + section.href, chunk, score);
          // Keep only a small top set rather than retaining all matching book text.
          excerpts.sort((a, b) => b.score - a.score);
          if (excerpts.length > 8) excerpts.length = 8;
        }
      }
    }
    let remaining = MAX_CONTEXT_CHARS;
    const context = excerpts
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
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
