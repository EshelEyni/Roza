import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { audiobookWords, type AudiobookSection } from "../../services/readerTts";
import { readerCaretRange } from "../../services/readerCaretRange";
import { paintNativeHighlight } from "../../services/readerNativeHighlight";
import { closestSentenceWord, groupSentenceWordRects } from "../../services/readerSentenceGeometry";
import { readerSentenceSpans } from "../../services/readerSentenceSpans";
import { readerWordPattern } from "../../services/readerWordPattern";
import { readingPageDownDelta } from "./readingPageDown";

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

function sentences(data: ReadingBlock) {
  return readerSentenceSpans(
    data.text.replace(/\r?\n(?:[\t ]*\r?\n)+/g, breaks => "\u2029".repeat(breaks.length)),
    data.block.closest("[lang]")?.getAttribute("lang") || data.block.ownerDocument.documentElement.lang || "en",
  );
}

export function manuscriptNarration(editable: HTMLElement, selection?: Range) {
  const blocks = new Set(Array.from(editable.querySelectorAll(stringSelector),
    leaf => leaf.closest(blockSelector)));
  const ranges: Range[] = [];
  const wordRanges: ((index: number) => Range | undefined)[] = [];
  const items: AudiobookSection["sentences"] = [];
  let totalWords = 0;
  let start = 0;
  let paragraph = 0;
  for (const block of blocks) {
    if (!block) continue;
    const data = readBlock(block);
    const part = data.parts.find(item => item.node === selection?.startContainer);
    const offset = part && selection ? part.start + selection.startOffset : undefined;
    for (const span of sentences(data)) {
      const text = data.text.slice(span.start, span.end);
      const words = audiobookWords(text);
      if (!words.length) continue;
      if (offset !== undefined && span.start <= offset && offset < span.end) start = items.length;
      ranges.push(data.rangeFor(span));
      wordRanges.push(index => {
        const word = words[index];
        return word && data.rangeFor({ start: span.start + word.start, end: span.start + word.end });
      });
      items.push({ text, words, paragraph, startWord: totalWords, cfi: String(items.length) });
      totalWords += words.length;
    }
    paragraph++;
  }
  const section: AudiobookSection = {
    section: 0, title: "", sentences: items, totalWords, start, offset: 0,
    previous: null, next: null,
  };
  return { section, ranges, wordRanges, editable };
}

function sentenceWordIndex(data: ReadingBlock, direction: number, currentIndex?: number) {
  const spans = sentences(data);
  const word = currentIndex === undefined ? undefined : data.words[currentIndex];
  if (direction < 0) spans.reverse();
  for (const span of spans) {
    if (word && (direction > 0 ? span.start < word.end : span.end > word.start)) continue;
    const index = data.words.findIndex(word => span.start <= word.start && span.end >= word.end);
    if (index >= 0) return index;
  }
  return -1;
}

function scrollParent(element: Element) {
  const doc = element.ownerDocument;
  for (let node = element.parentElement; node && node !== doc.body; node = node.parentElement) {
    if (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return doc.scrollingElement;
}

/** Sticky or fixed controls that are not part of the reading surface's own ancestry. */
function isPinnedOver(element: Element, editable: Element) {
  for (let node: Element | null = element; node && !node.contains(editable); node = node.parentElement) {
    if (/sticky|fixed/.test(getComputedStyle(node).position)) return true;
  }
  return false;
}

function coveredTop(editable: Element, view: { top: number; bottom: number }, x: number) {
  const doc = editable.ownerDocument;
  let top = view.top;
  for (let layer = 0; layer < 4 && top + 1 < view.bottom; layer++) {
    const cover = doc.elementsFromPoint(x, top + 1)
      .find(element => !editable.contains(element) && isPinnedOver(element, editable));
    const bottom = cover?.getBoundingClientRect().bottom;
    if (bottom === undefined || bottom <= top) break;
    top = Math.min(bottom, view.bottom);
  }
  return top;
}

export function followManuscriptNarration(editable: HTMLElement, range: Range, kind: "sentence" | "word" = "sentence") {
  if (!editable.contains(range.commonAncestorContainer)) return;
  const scroller = scrollParent(editable);
  const rect = range.getBoundingClientRect();
  if (scroller && rect.height) {
    const doc = editable.ownerDocument;
    const box = scroller === doc.scrollingElement
      ? { top: 0, left: 0, right: doc.documentElement.clientWidth }
      : scroller.getBoundingClientRect();
    const bottom = Math.min(doc.documentElement.clientHeight, box.top + scroller.clientTop + scroller.clientHeight);
    const x = Math.min(Math.max((rect.left + rect.right) / 2, box.left + 1), box.right - 1);
    const top = coveredTop(editable, { top: Math.max(0, box.top + scroller.clientTop), bottom }, x);
    const player = doc.querySelector(".ws-floating-audio")?.getBoundingClientRect();
    const overlapsPlayer = player && rect.left < player.right && rect.right > player.left &&
      rect.top < player.bottom && rect.bottom > player.top;
    if (overlapsPlayer && rect.height + 8 <= player.top - top) {
      scroller.scrollBy(0, rect.bottom - player.top + 8);
    } else if (rect.top < top || rect.bottom > bottom) {
      scroller.scrollBy(0, rect.top - top);
    }
  }
  return paintNativeHighlight(range, `var(--ws-${kind}-highlight)`, `var(--ws-${kind}-highlight-text)`, kind === "word" ? 3 : 2);
}

function precedingLineTop(editable: HTMLElement, sentence: Range, firstRect: DOMRect) {
  const block = sentence.startContainer.parentElement?.closest(blockSelector);
  if (!block) return undefined;
  const center = (firstRect.top + firstRect.bottom) / 2;
  const lines = readBlock(block).visualLines();
  const current = lines.findIndex(line =>
    Math.abs(line.centerY - center) < Math.min(line.height, firstRect.height) * 0.35,
  );
  if (current < 0) return undefined;
  let preceding = lines[current - 1];
  if (!preceding) {
    const blocks = [...new Set(Array.from(editable.querySelectorAll(stringSelector),
      leaf => leaf.closest(blockSelector)))];
    for (let index = blocks.indexOf(block) - 1; index >= 0; index--) {
      const previous = blocks[index];
      if (!previous) continue;
      const lastLine = readBlock(previous).visualLines().at(-1);
      if (!lastLine) continue;
      preceding = lastLine;
      break;
    }
  }
  return preceding && Math.min(...preceding.words.map(word => word.top));
}

/** Advances to the line before the marked sentence when that sentence fits in view. */
function pageDownWithinSentence(editable: HTMLElement, target: EventTarget, sentence: Range) {
  if (target instanceof Element && target !== editable &&
      (target.closest("input, textarea, select, dialog, [role='dialog'], [contenteditable='true']"))) {
    return false;
  }
  const rects = Array.from(sentence.getClientRects());
  const scroller = scrollParent(editable);
  if (!rects.length || !scroller) return false;
  const doc = editable.ownerDocument;
  const viewport = doc.documentElement.clientHeight;
  const box = scroller === doc.scrollingElement
    ? { top: 0, left: 0, right: doc.documentElement.clientWidth }
    : scroller.getBoundingClientRect();
  const top = Math.max(0, box.top + scroller.clientTop);
  const bottom = Math.min(viewport, box.top + scroller.clientTop + scroller.clientHeight);
  const center = (Math.min(...rects.map(rect => rect.left)) + Math.max(...rects.map(rect => rect.right))) / 2;
  const x = Math.min(Math.max(center, box.left + 1), box.right - 1);
  const view = { top: coveredTop(editable, { top, bottom }, x), bottom };
  const firstRect = rects.find(rect => rect.width && rect.height);
  const contextTop = firstRect && firstRect.top >= view.top && firstRect.top < view.bottom
    ? precedingLineTop(editable, sentence, firstRect)
    : undefined;
  const delta = readingPageDownDelta(rects, view, undefined, contextTop);
  if (delta === undefined) return false;
  if (delta > 0) scroller.scrollBy(0, delta);
  return true;
}

export function useManuscriptReadingMarks(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  // `index` is the active word, or the sentence's first word when only the sentence is marked.
  const active = useRef<{ block: Element; index: number; sentenceOnly?: boolean }>();
  const column = useRef<number>();
  const markedSentence = useRef<Range>();
  const marks = useRef<(() => void)[]>([]);
  const removeMarks = useCallback(() => {
    marks.current.forEach(remove => remove());
    marks.current = [];
    markedSentence.current = undefined;
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

  const mark = (data: ReadingBlock, index: number, withWord = true) => {
    removeMarks();
    active.current = { block: data.block, index, sentenceOnly: !withWord };
    const word = data.words[index];
    const sentence = sentences(data).find(span => span.start <= word.start && span.end >= word.end);
    const wordRange = data.rangeFor(word);
    markedSentence.current = sentence && data.rangeFor(sentence);
    const sentenceMark = markedSentence.current && paintNativeHighlight(
      markedSentence.current, "var(--ws-sentence-highlight)", "var(--ws-sentence-highlight-text)",
    );
    const wordMark = withWord && paintNativeHighlight(
      wordRange, "var(--ws-word-highlight)", "var(--ws-word-highlight-text)", 1,
    );
    if (sentenceMark) marks.current.push(sentenceMark);
    if (wordMark) marks.current.push(wordMark);
    return wordRange;
  };

  const markRange = (range: Range) => {
    const block = range.startContainer.parentElement?.closest(blockSelector);
    if (!block || !root.current?.contains(block)) return;
    const data = readBlock(block);
    const part = data.parts.find(part => part.node === range.startContainer);
    if (!part) return;
    const start = part.start + range.startOffset;
    const index = data.words.findIndex(word => word.end > start);
    if (index < 0) return;
    column.current = undefined;
    mark(data, index);
  };

  /** Brings a numbered line to the top of the uncovered reading view and marks its first sentence. */
  const revealLine = (block: Element) => {
    const editable = root.current?.querySelector<HTMLElement>("[data-slate-editor]");
    if (!editable?.contains(block)) return;
    editable.focus({ preventScroll: true });
    editable.ownerDocument.getSelection()?.removeAllRanges();
    clear();
    const scroller = scrollParent(editable);
    if (scroller) {
      const doc = editable.ownerDocument;
      const viewport = doc.documentElement.clientHeight;
      const box = scroller === doc.scrollingElement
        ? { top: 0, left: 0, right: doc.documentElement.clientWidth }
        : scroller.getBoundingClientRect();
      const top = Math.max(0, box.top + scroller.clientTop);
      const bottom = Math.min(viewport, box.top + scroller.clientTop + scroller.clientHeight);
      const line = block.getBoundingClientRect();
      const x = Math.min(Math.max((line.left + line.right) / 2, box.left + 1), box.right - 1);
      const viewTop = coveredTop(editable, { top, bottom }, x);
      const visible = line.top >= viewTop && line.top < bottom && Math.min(line.bottom, bottom) - line.top >= Math.min(line.height, bottom - viewTop);
      if (!visible) scroller.scrollBy(0, Math.floor(line.top - viewTop));
    }
    const data = readBlock(block);
    if (data.words.length) mark(data, 0, false);
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
    if (event.key === "PageDown") {
      if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
          !event.nativeEvent.isComposing && markedSentence.current &&
          pageDownWithinSentence(event.currentTarget, event.target, markedSentence.current)) {
        event.preventDefault();
      }
      return;
    }
    if (event.altKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const sentenceJump = event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
    if (event.ctrlKey && !sentenceJump) return;
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 :
      event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;

    const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
    if (!vertical) column.current = undefined;
    const blocks = [...new Set(Array.from(event.currentTarget.querySelectorAll(stringSelector),
      leaf => leaf.closest(blockSelector)))].filter((block): block is Element => !!block);
    const selection = event.currentTarget.ownerDocument.getSelection();
    // Drag, double-click, and touch selections can bypass click-to-mark.
    if (selection?.rangeCount && !selection.isCollapsed &&
        event.currentTarget.contains(selection.anchorNode) &&
        event.currentTarget.contains(selection.focusNode)) {
      const range = selection.getRangeAt(0);
      const block = range.startContainer.parentElement?.closest(blockSelector);
      if (block && blocks.includes(block)) {
        const data = readBlock(block);
        const part = data.parts.find(part => part.node === range.startContainer);
        if (part) {
          const offset = part.start + range.startOffset;
          const index = data.words.findIndex(word => word.start <= offset && offset < word.end);
          if (index >= 0) {
            active.current = { block, index };
            column.current = undefined;
          }
        }
      }
    }
    const current = active.current;
    // With only a sentence marked, Right Arrow marks its first word and Left Arrow moves back a sentence.
    const sentenceOnly = !!current?.sentenceOnly && !vertical && !sentenceJump;
    const bySentence = sentenceJump || (sentenceOnly && direction < 0);
    let blockIndex = current ? blocks.indexOf(current.block) : -1;
    let data = blockIndex >= 0 ? readBlock(blocks[blockIndex]) : undefined;
    if (sentenceJump && (!current || !data?.words[current.index])) return;
    event.preventDefault();
    let index = -1;
    if (current && data?.words[current.index]) {
      if (sentenceOnly && direction > 0) {
        index = current.index;
      } else if (bySentence) {
        index = sentenceWordIndex(data, direction, current.index);
      } else if (vertical) {
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
        if (bySentence) {
          index = sentenceWordIndex(data, direction);
        } else if (data.words.length) {
          const x = column.current;
          const lines = vertical && x !== undefined ? data.visualLines() : [];
          const line = direction > 0 ? lines[0] : lines[lines.length - 1];
          index = line && x !== undefined ? closestSentenceWord(line, x) :
            direction > 0 ? 0 : data.words.length - 1;
        }
      } while (index < 0);
    }
    if (!data) return;
    selection?.removeAllRanges();
    const word = mark(data, index, !bySentence).getBoundingClientRect();
    const scroller = scrollParent(event.currentTarget);
    if (!scroller) return;
    const bounds = scroller.getBoundingClientRect();
    if (word.top < bounds.top) scroller.scrollBy(0, word.top - bounds.top);
    else if (word.bottom > bounds.bottom) scroller.scrollBy(0, word.bottom - bounds.bottom);
  };

  return { root, markedSentence, clear, markRange, revealLine, onClick: enabled ? onClick : undefined, onKeyDown: enabled ? onKeyDown : undefined };
}
