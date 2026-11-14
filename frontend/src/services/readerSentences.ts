import type Section from "epubjs/types/section";
import { readerSentenceSpans } from "./readerSentenceSpans";
import { readerNoteReference } from "./readerNoteReference";

export type ReaderSentence = {
  text: string;
  cfi: string;
  notes?: { offset: number; text: string }[];
};

/** Join inline nodes before segmenting, retaining exact UTF-16 DOM offsets. */
export function extractReaderSentences(section: Section): ReaderSentence[] {
  const doc = section.document;
  const body = doc.querySelector("body") || doc.documentElement;
  const walker = doc.createTreeWalker(body, 5);
  const groups: {
    block: Element | null;
    nodes: Text[];
    notes: { offset: number; text: string }[];
    length: number;
  }[] = [];
  const seenNotes = new Set<Element>();
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
    let group = groups[groups.length - 1];
    if (!group || group.block !== block || lineBreak) {
      group = { block, nodes: [], notes: [], length: 0 };
      groups.push(group);
    }
    const note = readerNoteReference(text);
    if (note) {
      if (!seenNotes.has(note)) {
        seenNotes.add(note);
        group.notes.push({
          offset: group.length,
          text: note.textContent?.trim() || "",
        });
      }
    } else {
      group.nodes.push(text);
      group.length += text.length;
    }
    lineBreak = false;
  }
  const sentences: ReaderSentence[] = [];
  for (const { nodes, notes } of groups) {
    if (!nodes.length) continue;
    const text = nodes.map((node) => node.data).join("");
    const locate = (offset: number) => {
      for (const node of nodes) {
        if (offset < node.length) return { node, offset };
        offset -= node.length;
      }
      const node = nodes[nodes.length - 1];
      return { node, offset: node.length };
    };
    const assignedNotes = new Set<number>();
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
        notes: notes.flatMap((note, index) => {
          if (
            assignedNotes.has(index) ||
            note.offset < span.start ||
            note.offset > span.end
          )
            return [];
          assignedNotes.add(index);
          return [
            {
              text: note.text,
              offset: text.slice(span.start, note.offset).replace(/\s+/gu, " ")
                .length,
            },
          ];
        }),
      });
    }
  }
  return sentences;
}
