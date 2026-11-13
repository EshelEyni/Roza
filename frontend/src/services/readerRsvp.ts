import { EpubCFI } from "epubjs";
import type Section from "epubjs/types/section";

export type RsvpWord = { text: string; cfi: string; paragraphEnd: boolean };
const blockSelector = "p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre,td";

/** Join inline markup before tokenizing, retaining exact UTF-16 DOM offsets. */
export function extractRsvpWords(section: Section): RsvpWord[] {
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
    const block = text.parentElement?.closest(blockSelector) || null;
    const last = groups[groups.length - 1];
    if (last?.block === block && !lineBreak) last.nodes.push(text);
    else groups.push({ block, nodes: [text] });
    lineBreak = false;
  }
  const words: RsvpWord[] = [];
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
    const matches = [...text.matchAll(/\S+/gu)];
    matches.forEach((match, index) => {
      const start = locate(match.index!);
      const end = locate(match.index! + match[0].length);
      const range = doc.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      words.push({
        text: match[0],
        cfi: section.cfiFromRange(range),
        paragraphEnd: index === matches.length - 1,
      });
    });
  }
  return words;
}
export function rsvpDelay(word: RsvpWord, wpm: number) {
  return (
    (60000 / Math.max(100, Math.min(1000, wpm))) *
    (word.paragraphEnd
      ? 2.5
      : /[.!?…]["'”’)]*$/u.test(word.text)
        ? 2
        : /[,;:]["'”’)]*$/u.test(word.text)
          ? 1.5
          : 1)
  );
}
export function rsvpSentence(
  words: RsvpWord[],
  index: number,
  direction: number,
) {
  const end = (i: number) =>
    words[i].paragraphEnd || /[.!?…]["'”’)]*$/u.test(words[i].text);
  if (direction > 0) {
    let i = index;
    while (i < words.length - 1 && !end(i)) i++;
    return Math.min(words.length - 1, i + 1);
  }
  let i = Math.max(0, index - 1);
  while (i > 0 && !end(i - 1)) i--;
  return i;
}
export function rsvpStart(words: RsvpWord[], cfi: string) {
  const compare = new EpubCFI().compare;
  const point = new EpubCFI(cfi);
  point.collapse(true);
  const index = words.findIndex((word) => {
    const end = new EpubCFI(word.cfi);
    end.collapse(false);
    return compare(end.toString(), point.toString()) > 0;
  });
  return index < 0 ? Math.max(0, words.length - 1) : index;
}
