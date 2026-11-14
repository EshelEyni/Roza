/** Map a displayed sentence word back to its EPUB text nodes, including inline markup. */
export function readerSentenceWordRange(
  sentence: Range,
  wordIndex: number,
): Range | null {
  const root = sentence.commonAncestorContainer,
    doc = root.ownerDocument;
  if (!doc || wordIndex < 0) return null;
  const nodes: { node: Text; start: number; end: number }[] = [];
  const add = (node: Node) => {
    if (
      !sentence.intersectsNode(node) ||
      node.parentElement?.closest(
        "script,style,noscript,svg,[hidden],[aria-hidden='true']",
      )
    )
      return;
    const text = node as Text;
    const start = node === sentence.startContainer ? sentence.startOffset : 0;
    const end =
      node === sentence.endContainer ? sentence.endOffset : text.length;
    if (end > start) nodes.push({ node: text, start, end });
  };
  if (root.nodeType === 3) add(root);
  else {
    const walker = doc.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      add(node);
  }
  const text = nodes
    .map((part) => part.node.data.slice(part.start, part.end))
    .join("");
  const word = [...text.matchAll(/[\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*/gu)][
    wordIndex
  ];
  if (!word || word.index === undefined) return null;
  const range = doc.createRange(),
    endOffset = word.index + word[0].length;
  let offset = 0,
    started = false;
  for (const part of nodes) {
    const length = part.end - part.start;
    if (!started && word.index < offset + length) {
      range.setStart(part.node, part.start + word.index - offset);
      started = true;
    }
    if (started && endOffset <= offset + length) {
      range.setEnd(part.node, part.start + endOffset - offset);
      return range;
    }
    offset += length;
  }
  return null;
}
