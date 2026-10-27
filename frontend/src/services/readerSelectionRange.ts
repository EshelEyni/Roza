import { EpubCFI, type Book } from "epubjs";

export function selectionEndpoints(cfi: string) {
  const start = new EpubCFI(cfi);
  const end = new EpubCFI(cfi);
  start.collapse(true);
  end.collapse(false);
  return { start: start.toString(), end: end.toString() };
}

/** Read one range per spine item, never concatenate overlapping screen pages. */
export async function readSelectionRange(
  book: Book,
  anchor: string,
  focus: string,
) {
  const compare = new EpubCFI().compare;
  const [start, end] =
    compare(anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor];
  const first = book.spine.get(start);
  const last = book.spine.get(end);
  if (!first || !last) throw new Error("Selection section is unavailable");
  const pieces: { text: string; cfi: string }[] = [];
  for (let index = first.index; index <= last.index; index += 1) {
    const section = book.spine.get(index);
    if (
      !section ||
      (section.linear === false &&
        index !== first.index &&
        index !== last.index)
    )
      continue;
    await section.load(book.load.bind(book));
    const doc = section.document;
    const body = doc.querySelector("body") || doc.documentElement;
    const range = doc.createRange();
    // epub.js CFIs need text-node boundaries, including for a whole section.
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const firstText = walker.nextNode();
    if (!firstText) continue;
    let lastText = firstText;
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      lastText = node;
    range.setStart(firstText, 0);
    range.setEnd(lastText, lastText.textContent?.length || 0);
    if (index === first.index) {
      const point = new EpubCFI(start).toRange(doc);
      range.setStart(point.startContainer, point.startOffset);
    }
    if (index === last.index) {
      const point = new EpubCFI(end).toRange(doc);
      range.setEnd(point.startContainer, point.startOffset);
    }
    pieces.push({ text: range.toString(), cfi: section.cfiFromRange(range) });
  }
  return {
    text: pieces
      .map(piece => piece.text)
      .join("\n")
      .trim(),
    cfi: pieces[0]?.cfi || start,
    endCfi: first.index === last.index ? undefined : end,
    pieces,
  };
}
