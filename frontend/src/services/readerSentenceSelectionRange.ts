import { readerNoteReference } from "./readerNoteReference";

/** Map normalized, note-free display offsets back to the original EPUB DOM. */
export function readerSentenceSelectionRange(
  sentence: Range,
  start: number,
  end: number,
): Range | null {
  const doc = sentence.startContainer.ownerDocument;
  if (!doc || start < 0 || end <= start) return null;
  const nodes: { node: Text; start: number; end: number }[] = [];
  const add = (node: Node) => {
    if (
      !sentence.intersectsNode(node) ||
      readerNoteReference(node) ||
      node.parentElement?.closest(
        "script,style,noscript,svg,[hidden],[aria-hidden='true']",
      )
    )
      return;
    const text = node as Text;
    const from = node === sentence.startContainer ? sentence.startOffset : 0;
    const to =
      node === sentence.endContainer ? sentence.endOffset : text.length;
    if (to > from) nodes.push({ node: text, start: from, end: to });
  };
  const root = sentence.commonAncestorContainer;
  if (root.nodeType === 3) add(root);
  else {
    const walker = doc.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      add(node);
  }
  const raw = nodes
    .map((part) => part.node.data.slice(part.start, part.end))
    .join("");
  const offsets = [0];
  for (const match of raw.matchAll(/\s+|\S+/gu)) {
    if (/^\s/u.test(match[0])) offsets.push(match.index! + match[0].length);
    else
      for (let i = 1; i <= match[0].length; i++) offsets.push(match.index! + i);
  }
  if (end >= offsets.length) return null;
  const locate = (offset: number, ending: boolean) => {
    for (let i = 0; i < nodes.length; i++) {
      const part = nodes[i];
      const length = part.end - part.start;
      if (
        offset < length ||
        (ending && offset === length) ||
        i === nodes.length - 1
      )
        return { node: part.node, offset: part.start + offset };
      offset -= length;
    }
    return null;
  };
  const first = locate(offsets[start], false);
  const last = locate(offsets[end], true);
  if (!first || !last) return null;
  const range = doc.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset);
  return range;
}
