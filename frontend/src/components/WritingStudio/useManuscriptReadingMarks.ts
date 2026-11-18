import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { readerCaretRange } from "../../services/readerCaretRange";
import { readerMarkTextColor, readerPassageColor, readerSelectionColor } from "../../services/readerMarkColors";
import { paintNativeHighlight } from "../../services/readerNativeHighlight";
import { closestSentenceWord, groupSentenceWordRects } from "../../services/readerSentenceGeometry";
import { readerSentenceSpans } from "../../services/readerSentenceSpans";
import { readerWordPattern } from "../../services/readerWordPattern";

const blockSelector = '[data-slate-node="element"]';
const stringSelector = "[data-slate-string]";

function readBlock(block: Element) {
  const doc = block.ownerDocument;
  const parts: { node: Text; start: number; end: number }[] = [];
  let text = "";
  for (const leaf of block.querySelectorAll(stringSelector)) {
    if (leaf.closest(blockSelector) !== block) continue;
    const walker = doc.createTreeWalker(leaf, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!node.length) continue;
      parts.push({ node, start: text.length, end: text.length + node.length });
      text += node.data;
    }
  }
  const words = Array.from(text.matchAll(readerWordPattern), match => ({
    start: match.index!,
    end: match.index! + match[0].length,
  }));
  const rangeFor = ({ start, end }: { start: number; end: number }) => {
    const first = parts.find(part => part.end > start)!;
    const last = parts.find(part => part.end >= end)!;
    const range = doc.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    return range;
  };
  const visualLines = () => groupSentenceWordRects(words.flatMap((word, index) =>
    Array.from(rangeFor(word).getClientRects())
      .filter(rect => rect.width && rect.height)
      .map(({ left, right, top, bottom }) => ({ index, left, right, top, bottom })),
  ));
  return { block, parts, text, words, rangeFor, visualLines };
}

type ReadingBlock = ReturnType<typeof readBlock>;

export function useManuscriptReadingMarks(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const active = useRef<{ block: Element; index: number }>();
  const column = useRef<number>();
  const marks = useRef<(() => void)[]>([]);
  const removeMarks = useCallback(() => {
    marks.current.forEach(remove => remove());
    marks.current = [];
  }, []);
  const clear = useCallback(() => {
    removeMarks();
    active.current = undefined;
    column.current = undefined;
  }, [removeMarks]);
  useEffect(() => {
    if (!enabled) return;
    root.current?.querySelector<HTMLElement>("[data-slate-editor]")?.focus({ preventScroll: true });
    return clear;
  }, [clear, enabled]);

  const mark = (data: ReadingBlock, index: number) => {
    removeMarks();
    active.current = { block: data.block, index };
    const word = data.words[index];
    const sentence = readerSentenceSpans(
      data.text.replace(/\r?\n(?:[\t ]*\r?\n)+/g, breaks => "\u2029".repeat(breaks.length)),
      data.block.closest("[lang]")?.getAttribute("lang") || data.block.ownerDocument.documentElement.lang || "en",
    ).find(span => span.start <= word.start && span.end >= word.end);
    const wordRange = data.rangeFor(word);
    const sentenceMark = sentence && paintNativeHighlight(data.rangeFor(sentence), readerPassageColor, readerMarkTextColor);
    const wordMark = paintNativeHighlight(wordRange, readerSelectionColor, readerMarkTextColor, 1);
    if (sentenceMark) marks.current.push(sentenceMark);
    if (wordMark) marks.current.push(wordMark);
    return wordRange;
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const { currentTarget, clientX, clientY } = event;
    const doc = currentTarget.ownerDocument;
    if (doc.getSelection()?.toString().trim()) return;
    const caret = readerCaretRange(doc, clientX, clientY);
    const block = caret?.startContainer.parentElement?.closest(blockSelector);
    clear();
    if (!caret || !block || !currentTarget.contains(block)) return;
    const data = readBlock(block);
    const part = data.parts.find(part => part.node === caret.startContainer);
    if (!part) return;
    const offset = part.start + caret.startOffset;
    const index = data.words.findIndex(word => word.start <= offset && offset <= word.end &&
      Array.from(data.rangeFor(word).getClientRects()).some(rect =>
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom,
      ),
    );
    if (index < 0) return;
    currentTarget.focus({ preventScroll: true });
    mark(data, index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") clear();
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 :
      event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
    if (!vertical) column.current = undefined;
    const blocks = [...new Set(Array.from(event.currentTarget.querySelectorAll(stringSelector),
      leaf => leaf.closest(blockSelector)))].filter((block): block is Element => !!block);
    const current = active.current;
    let blockIndex = current ? blocks.indexOf(current.block) : -1;
    let data = blockIndex >= 0 ? readBlock(blocks[blockIndex]) : undefined;
    let index = -1;
    if (current && data?.words[current.index]) {
      if (vertical) {
        const lines = data.visualLines();
        const matching = lines.flatMap((line, i) =>
          line.words.some(word => word.index === current.index) ? [i] : [],
        );
        const lineIndex = direction > 0 ? matching[matching.length - 1] : matching[0];
        if (lineIndex !== undefined) {
          const word = lines[lineIndex].words.find(word => word.index === current.index)!;
          const x = column.current ?? (word.left + word.right) / 2;
          column.current = x;
          const next = lines[lineIndex + direction];
          if (next) index = closestSentenceWord(next, x);
        }
      } else {
        const next = current.index + direction;
        if (data.words[next]) index = next;
      }
    }
    if (index < 0) {
      if (blockIndex < 0) blockIndex = direction > 0 ? -1 : blocks.length;
      do {
        blockIndex += direction;
        if (!blocks[blockIndex]) return;
        data = readBlock(blocks[blockIndex]);
      } while (!data.words.length);
      const x = column.current;
      const lines = vertical && x !== undefined ? data.visualLines() : [];
      const line = direction > 0 ? lines[0] : lines[lines.length - 1];
      index = line && x !== undefined ? closestSentenceWord(line, x) :
        direction > 0 ? 0 : data.words.length - 1;
    }
    if (!data) return;
    event.currentTarget.ownerDocument.getSelection()?.removeAllRanges();
    const word = mark(data, index).getBoundingClientRect();
    const scroller = event.currentTarget.closest(".ws-writing");
    if (!scroller) return;
    const bounds = scroller.getBoundingClientRect();
    if (word.top < bounds.top) scroller.scrollBy(0, word.top - bounds.top);
    else if (word.bottom > bounds.bottom) scroller.scrollBy(0, word.bottom - bounds.bottom);
  };

  return { root, onClick: enabled ? onClick : undefined, onKeyDown: enabled ? onKeyDown : undefined };
}
