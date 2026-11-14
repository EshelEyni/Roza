import type Section from "epubjs/types/section";
import { readerSentenceSpans } from "./readerSentenceSpans";

export type ReaderSentence = { text: string; cfi: string };

/** Join inline nodes before segmenting, retaining exact UTF-16 DOM offsets. */
export function extractReaderSentences(section: Section): ReaderSentence[] {
  const doc = section.document;
  const body = doc.querySelector("body") || doc.documentElement;
  const walker = doc.createTreeWalker(body, 5);
  const groups: { block: Element | null; nodes: Text[] }[] = [];
  let lineBreak = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 1) {
      if ((node as Element).localName === "br") lineBreak = true;
      continue;
    }
    const text = node as Text;
    if (
      text.parentElement?.closest(
        "script,style,noscript,svg,[hidden],[aria-hidden='true']",
      )
    )
      continue;
    const block =
      text.parentElement?.closest(
        "p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre,td",
      ) || null;
    const last = groups[groups.length - 1];
    if (last?.block === block && !lineBreak) last.nodes.push(text);
    else groups.push({ block, nodes: [text] });
    lineBreak = false;
  }
  const sentences: ReaderSentence[] = [];
  for (const { nodes } of groups) {
    const text = nodes.map((node) => node.data).join("");
    const locate = (offset: number) => {
      for (const node of nodes) {
        if (offset < node.length) return { node, offset };
        offset -= node.length;
      }
      const node = nodes[nodes.length - 1];
      return { node, offset: node.length };
    };
    for (const span of readerSentenceSpans(
      text,
      doc.documentElement.getAttribute("lang") || "en",
    )) {
      const start = locate(span.start);
      const end = locate(span.end);
      const range = doc.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      sentences.push({
        text: text.slice(span.start, span.end).replace(/\s+/gu, " "),
        cfi: section.cfiFromRange(range),
      });
    }
  }
  return sentences;
}
