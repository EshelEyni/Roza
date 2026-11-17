import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { readerCaretRange } from "../../services/readerCaretRange";
import { readerMarkTextColor, readerPassageColor, readerSelectionColor } from "../../services/readerMarkColors";
import { paintNativeHighlight } from "../../services/readerNativeHighlight";
import { readerSentenceSpans } from "../../services/readerSentenceSpans";
import { readerWordPattern } from "../../services/readerWordPattern";

function readingRanges(event: MouseEvent<HTMLDivElement>) {
  const { currentTarget, clientX, clientY } = event;
  const doc = currentTarget.ownerDocument;
  const caret = readerCaretRange(doc, clientX, clientY);
  const block = caret?.startContainer.parentElement?.closest('[data-slate-node="element"]');
  if (!caret || !block || !currentTarget.contains(block)) return;

  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const parts: { node: Text; start: number; end: number }[] = [];
  let text = "";
  let offset = -1;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.length || !node.parentElement?.closest("[data-slate-string]")) continue;
    if (node === caret.startContainer) offset = text.length + caret.startOffset;
    parts.push({ node, start: text.length, end: text.length + node.length });
    text += node.data;
  }
  if (offset < 0) return;

  const rangeFor = (start: number, end: number) => {
    const first = parts.find(part => part.end > start)!;
    const last = parts.find(part => part.end >= end)!;
    const range = doc.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    return range;
  };
  for (const match of text.matchAll(readerWordPattern)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (start > offset) break;
    if (end < offset) continue;
    const word = rangeFor(start, end);
    if (!Array.from(word.getClientRects()).some(rect =>
      clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom,
    )) continue;
    const sentence = readerSentenceSpans(
      text.replace(/\r?\n(?:[\t ]*\r?\n)+/g, breaks => "\u2029".repeat(breaks.length)),
      block.closest("[lang]")?.getAttribute("lang") || doc.documentElement.lang || "en",
    ).find(span => span.start <= start && span.end >= end);
    return { word, sentence: sentence && rangeFor(sentence.start, sentence.end) };
  }
}

export function useManuscriptReadingMarks(enabled: boolean) {
  const marks = useRef<(() => void)[]>([]);
  const clear = useCallback(() => {
    marks.current.forEach(remove => remove());
    marks.current = [];
  }, []);
  useEffect(() => {
    if (enabled) return clear;
  }, [clear, enabled]);

  return {
    onClick: enabled ? (event: MouseEvent<HTMLDivElement>) => {
      if (event.currentTarget.ownerDocument.getSelection()?.toString().trim()) return;
      const ranges = readingRanges(event);
      clear();
      if (!ranges) return;
      const { word, sentence } = ranges;
      const sentenceMark = sentence && paintNativeHighlight(sentence, readerPassageColor, readerMarkTextColor);
      const wordMark = paintNativeHighlight(word, readerSelectionColor, readerMarkTextColor, 1);
      if (sentenceMark) marks.current.push(sentenceMark);
      if (wordMark) marks.current.push(wordMark);
    } : undefined,
    clear,
  };
}
