import { closestSentenceWord, type SentenceVisualLine } from "./readerSentenceGeometry";
import { EpubCFI, type Contents, type Location } from "epubjs";
import { defaultReaderKeyboardSettings } from "./readerKeyboardSettings";
import { readerSentenceSpans } from "./readerSentenceSpans";
import { ReaderPassageMarker } from "./readerPassageMarker";
import { readSelectionRange, selectionEndpoints } from "./readerSelectionRange";
import type { EpubRuntime } from "../hooks/reader/useEpubRuntime";
import type { ReaderSelection } from "../hooks/reader/useReaderSelection";

type Word = {
  cfi: string;
  contents: Contents;
  range: Range;
  index: number;
  offset: number;
  sentence: number;
  sentenceRange?: Range;
};
type Direction = "next" | "prev";
/** Keyboard focus is independent of native selection and lookup state. */
export function createReaderWordNavigation(
  runtime: EpubRuntime,
  selection: Pick<ReaderSelection, "closeLookup" | "openLookup" | "flagSelection">,
) {
  let active: Word | undefined;
  let targetX: number | null = null;
  let navigationKind: "word" | "line" | "sentence" = "word";
  let extending = false;
  let anchor: Word | undefined;
  let focusedSelection: import("../types/reader").ReaderTextSelection | undefined;
  let lineEntry = false;
  let group: { first: Word; last: Word; range: Range } | undefined;
  let pending: { direction: Direction; remaining: number } | undefined;
  let settingsKey = "";
  const chapters = new WeakMap<Document, Word[]>();
  const marker = new ReaderPassageMarker(
    () => runtime.renditionRef.current,
    () => runtime.stateRef.current.preferences.selectionColor || "#719bd8",
    () => runtime.stateRef.current.preferences.selectionTextColor || "#28231e",
    "reader-keyboard-word",
  );
  let version = 0;
  let queue = Promise.resolve();
  let turning = false;
  let cached:
    | { documents: Document[]; layout: string; words: Word[] }
    | undefined;
  const clearPaint = () => {
    marker.clear();
    runtime.keyboardWordCfi.current = "";
    active = undefined;
    group = undefined;
  };
  const clear = () => {
    ++version;
    targetX = null;
    anchor = undefined;
    focusedSelection = undefined;
    pending = undefined;
    clearPaint();
  };
  const contents = () =>
    (runtime.renditionRef.current?.getContents() as unknown as
      | Contents[]
      | undefined) || [];
  const chapterWords = (content: Contents): Word[] => {
    const doc = content.document;
    const previous = chapters.get(doc);
    if (previous) return previous;
    const words: Word[] = [];
    const walker = doc.createTreeWalker(doc.body, 4);
    let node: Node | null;
    let text = "";
    let previousBlock: Element | null = null;
    const nodes: { node: Node; start: number; end: number }[] = [];
    while ((node = walker.nextNode())) {
      if (
        node.parentElement?.closest(
          "script, style, [hidden], [aria-hidden=true], input, textarea, select, [contenteditable]",
        )
      )
        continue;
      const block =
        node.parentElement?.closest(
          "p, li, blockquote, h1, h2, h3, h4, h5, h6, div, td, pre",
        ) || null;
      if (nodes.length && block !== previousBlock) text += "\u2029";
      previousBlock = block;
      const offset = text.length;
      text += node.textContent || "";
      nodes.push({ node, start: offset, end: text.length });
      for (const match of (node.textContent || "").matchAll(
        /[\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*/gu,
      )) {
        const range = doc.createRange();
        range.setStart(node, match.index!);
        range.setEnd(node, match.index! + match[0].length);
        let cfi: string | undefined;
        words.push({
          range,
          contents: content,
          index: words.length,
          offset: offset + match.index!,
          sentence: 0,
          get cfi() {
            return (cfi ??= content.cfiFromRange(range));
          },
        });
      }
    }
    const spans = readerSentenceSpans(text, doc.documentElement.lang || "en");
    let sentence = 0;
    const sentenceRanges: Range[] = [];
    // Both the text nodes and sentence offsets are ordered, so map them in one pass.
    let nodeIndex = 0;
    for (const span of spans) {
      while (nodeIndex < nodes.length - 1 && nodes[nodeIndex].end <= span.start)
        nodeIndex++;
      const first = nodes[nodeIndex];
      const range = doc.createRange();
      range.setStart(first.node, Math.max(0, span.start - first.start));
      while (nodeIndex < nodes.length - 1 && nodes[nodeIndex].end < span.end)
        nodeIndex++;
      const last = nodes[nodeIndex];
      range.setEnd(last.node, Math.min(last.end, span.end) - last.start);
      sentenceRanges.push(range);
    }
    for (const word of words) {
      while (sentence < spans.length - 1 && word.offset >= spans[sentence].end)
        sentence++;
      word.sentence = sentence;
      word.sentenceRange = sentenceRanges[sentence];
    }
    chapters.set(doc, words);
    return words;
  };
  const isVisible = (word: Word): boolean => {
    if (!word.range.startContainer.isConnected) return false;
    const host = runtime.host.current?.getBoundingClientRect();
    const frame =
      word.contents.document.defaultView?.frameElement?.getBoundingClientRect();
    if (!host || !frame) return false;
    return Array.from(word.range.getClientRects()).some(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        frame.left + rect.left >= host.left - 1 &&
        frame.left + rect.left < host.right - 1 &&
        frame.top + rect.bottom > host.top &&
        frame.top + rect.top < host.bottom,
    );
  };
  const adjacentWord = (direction: "next" | "prev"): Word | undefined => {
    const edge = active;
    if (!edge) return;
    const words = chapters.get(edge.contents.document);
    if (words?.[edge.index] !== edge) return;
    const offset = direction === "next" ? 1 : -1;
    for (let index = edge.index + offset; words[index]; index += offset) {
      let word = words[index];
      if (navigationKind === "sentence") {
        if (word.sentence === edge.sentence) continue;
        while (word.index > 0 && words[word.index - 1].sentence === word.sentence)
          word = words[word.index - 1];
      }
      // Skip text hidden by the publisher without skipping onto another page.
      if (
        Array.from(word.range.getClientRects()).some(
          (rect) => rect.width > 0 && rect.height > 0,
        )
      )
        return word;
    }
  };
  const visibleWords = (): Word[] => {
    const host = runtime.host.current?.getBoundingClientRect();
    if (!host) return [];
    const pages = contents();
    const documents = pages.map((content) => content.document);
    const layout = JSON.stringify([
      runtime.stateRef.current.preferences,
      host.left,
      host.top,
      host.width,
      host.height,
      ...pages.map((content) => {
        const frame =
          content.document.defaultView?.frameElement?.getBoundingClientRect();
        return frame && [frame.left, frame.top, frame.width, frame.height];
      }),
    ]);
    if (
      cached?.layout === layout &&
      documents.length === cached.documents.length &&
      documents.every((doc, index) => doc === cached!.documents[index])
    )
      return cached.words;
    const words = pages.flatMap((content) =>
      chapterWords(content).filter(isVisible),
    );
    cached = { documents, layout, words };
    return words;
  };
  // Read current DOM rectangles for each movement so font/layout changes cannot stale geometry.
  const geometry = () => {
    const words = visibleWords();
    const lines: SentenceVisualLine[] = [];
    words.forEach((word, index) => {
      const frame = word.contents.document.defaultView?.frameElement?.getBoundingClientRect();
      if (!frame) return;
      for (const rect of Array.from(word.range.getClientRects())) {
        if (!rect.width || !rect.height) continue;
        const top = frame.top + rect.top, bottom = frame.top + rect.bottom;
        const centerY = (top + bottom) / 2;
        let line = lines.at(-1);
        if (!line || Math.abs(line.centerY - centerY) >= Math.min(line.height, rect.height) * .35) {
          line = {centerY, height: rect.height, words: []}; lines.push(line);
        }
        line.words.push({index, left:frame.left + rect.left, right:frame.left + rect.right, top, bottom});
      }
    });
    return {words, lines};
  };
  const highlight = async (word: Word, direction: Direction) => {
    if (lineEntry && targetX !== null) {
      const {words, lines} = geometry();
      const line = direction === "next" ? lines[0] : lines.at(-1);
      if (line) word = words[closestSentenceWord(line, targetX)];
    }
    const selectionAnchor = extending ? anchor || active || word : undefined;
    // Plain arrows always focus one word; Shift explicitly extends the selection.
    const settings: typeof defaultReaderKeyboardSettings = { unit: "words", count: 1 };
    const words = chapterWords(word.contents);
    const offset = direction === "next" ? 1 : -1;
    let remaining =
      pending?.direction === direction ? pending.remaining : settings.count;
    const selected: Word[] = [];
    let cursor: Word | undefined = word;
    while (cursor && isVisible(cursor)) {
      selected.push(cursor);
      const next: Word | undefined = words[cursor.index + offset];
      if (
        settings.unit === "words" ||
        !next ||
        next.sentence !== cursor.sentence
      )
        remaining--;
      if (remaining <= 0) break;
      cursor = next;
      while (
        cursor &&
        !Array.from(cursor.range.getClientRects()).some(
          (rect) => rect.width > 0 && rect.height > 0,
        )
      )
        cursor = words[cursor.index + offset];
    }
    if (!selected.length) return;
    pending = remaining > 0 ? { direction, remaining } : undefined;
    const first =
      direction === "next" ? selected[0] : selected[selected.length - 1];
    const last =
      direction === "next" ? selected[selected.length - 1] : selected[0];
    const range = first.range.cloneRange();
    range.setEnd(last.range.endContainer, last.range.endOffset);
    if (settings.unit === "sentences") {
      if (
        (!words[first.index - 1] ||
          words[first.index - 1].sentence !== first.sentence) &&
        first.sentenceRange
      )
        range.setStart(
          first.sentenceRange.startContainer,
          first.sentenceRange.startOffset,
        );
      if (
        (!words[last.index + 1] ||
          words[last.index + 1].sentence !== last.sentence) &&
        last.sentenceRange
      )
        range.setEnd(
          last.sentenceRange.endContainer,
          last.sentenceRange.endOffset,
        );
    }
    clearPaint();
    selection.closeLookup();
    contents().forEach((content) => {
      const native = content.document.getSelection();
      if (native?.rangeCount) native.removeAllRanges();
    });
    active = direction === "next" ? last : first;
    runtime.keyboardWordCfi.current = active.cfi;
    group = { first, last, range };
    if (turning) word.contents.document.defaultView?.focus();
    anchor = selectionAnchor;
    let cfi = word.contents.cfiFromRange(range);
    let endCfi: string | undefined;
    let text = range.toString();
    if (selectionAnchor) {
      const compare = new EpubCFI().compare(selectionAnchor.cfi, word.cfi);
      const start = compare <= 0 ? selectionAnchor : word;
      const end = compare <= 0 ? word : selectionAnchor;
      if (start.contents.document === end.contents.document) {
        range.setStart(start.range.startContainer, start.range.startOffset);
        range.setEnd(end.range.endContainer, end.range.endOffset);
        cfi = word.contents.cfiFromRange(range); text = range.toString();
        group = {first: start, last: end, range};
      } else {
        cfi = start.cfi; endCfi = end.cfi;
        text = (await readSelectionRange(runtime.epubRef.current!, cfi, endCfi)).text;
      }
    }
    const rect = word.range.getBoundingClientRect();
    const frame = word.contents.document.defaultView?.frameElement?.getBoundingClientRect();
    focusedSelection = {cfi, endCfi, text,
      word: /^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(text) && text.length <= 80 ? text : undefined,
      x: (frame?.left || 0) + rect.left, y: (frame?.top || 0) + rect.bottom + 8};
    await marker.show(focusedSelection, "blue", async () => endCfi
      ? (await readSelectionRange(runtime.epubRef.current!, cfi, endCfi)).pieces.map(piece => piece.cfi)
      : [cfi]);
  };
  const step = async (direction: "next" | "prev", request: number) => {
    const rendition = runtime.renditionRef.current;
    if (!rendition || request !== version || runtime.changingLayout.current)
      return;
    const settings =
      runtime.keyboardRef?.current || defaultReaderKeyboardSettings;
    const key = settings.unit + ":" + settings.count;
    if (settingsKey !== key || pending?.direction !== direction)
      pending = undefined;
    settingsKey = key;
    const native = contents().find(
      (content) => !!content.document.getSelection()?.toString().trim(),
    );
    if (active && !native && navigationKind !== "line") {
      const word = adjacentWord(direction);
      if (word && isVisible(word)) {
        await highlight(word, direction);
        return;
      }
    }
    const continuing =
      active &&
      !native &&
      isVisible(active) &&
      chapters.get(active.contents.document)?.[active.index] === active;
    let words = continuing ? [] : visibleWords();
    const edge =
      direction === "next" ? group?.last || active : group?.first || active;
    const index = edge
      ? words.findIndex((word) => word === edge || word.cfi === edge.cfi)
      : -1;
    let next =
      index < 0
        ? direction === "next"
          ? 0
          : words.length - 1
        : index + (direction === "next" ? 1 : -1);

    const selected = runtime.selectionRef.current;
    const selectedCfi = native
      ? native.cfiFromRange(native.document.getSelection()!.getRangeAt(0))
      : !active && selected
        ? direction === "next"
          ? selected.endCfi || selected.cfi
          : selected.cfi
        : undefined;
    if (selectedCfi) {
      const boundary =
        selectionEndpoints(selectedCfi)[direction === "next" ? "end" : "start"];
      const boundaryCfi = new EpubCFI(boundary);
      const boundaryRange = native
        ? native.document.getSelection()!.getRangeAt(0).cloneRange()
        : contents()
            .find((content) => content.sectionIndex === boundaryCfi.spinePos)
            ?.range(boundary);
      boundaryRange?.collapse(direction === "prev");
      const candidates = words
        .map((word, index) => ({ word, index }))
        .filter(({ word }) => {
          if (
            boundaryRange &&
            word.range.startContainer.ownerDocument ===
              boundaryRange.startContainer.ownerDocument
          ) {
            const order = word.range.compareBoundaryPoints(
              direction === "next" ? 0 : 2,
              boundaryRange,
            );
            return direction === "next" ? order >= 0 : order <= 0;
          }
          const spine = new EpubCFI(word.cfi).spinePos;
          return direction === "next"
            ? spine > boundaryCfi.spinePos
            : spine < boundaryCfi.spinePos;
        });
      next =
        (direction === "next"
          ? candidates[0]
          : candidates[candidates.length - 1]
        )?.index ?? -1;
    }
    if (words[next]) {
      await highlight(words[next], direction);
      return;
    }
    // Skip empty pages, including image-only sections, until a word or book boundary.
    turning = true;
    try {
      while (request === version) {
        const before = rendition.currentLocation() as unknown as Location;
        if (!before || (direction === "next" ? before.atEnd : before.atStart))
          return;
        await rendition[direction]();
        await rendition.reportLocation();
        if (request !== version) return;
        const after = rendition.currentLocation() as unknown as Location;
        if (
          after?.start.cfi === before.start.cfi &&
          after?.end.cfi === before.end.cfi
        )
          return;
        const adjacent = navigationKind === "line" ? undefined : adjacentWord(direction);
        if (adjacent && isVisible(adjacent)) {
          await highlight(adjacent, direction);
          return;
        }
        if (adjacent?.range.startContainer.isConnected) continue;
        words = visibleWords();
        const word = direction === "next" ? words[0] : words[words.length - 1];
        if (word) {
          await highlight(word, direction);
          return;
        }
      }
    } finally {
      turning = false;
    }
  };
  const flagCurrent = () => {
    if (!runtime.flagReady.current || runtime.panelRef.current ||
      document.querySelector('.reader-dictionary.is-open')) return;
    const native = contents().find(content => !!content.document.getSelection()?.toString().trim());
    if (runtime.selectionRef.current) selection.flagSelection();
    else if (native) selection.flagSelection(native.cfiFromRange(native.document.getSelection()!.getRangeAt(0)), native);
    else if (focusedSelection && active && isVisible(active)) runtime.wordAction.current?.("f", focusedSelection);
  };
  const onKey = (event: KeyboardEvent): boolean => {
    const target = event.target as Element | null;
    const host = runtime.host.current;
    const doc = target?.ownerDocument;
    const inReader =
      !!host &&
      ((!!target && (host.contains(target) || runtime.shell.current?.contains(target))) ||
        target === document.body ||
        contents().some((content) => content.document === doc));
    if (
      !inReader ||
      runtime.mobileRef.current ||
      runtime.changingLayout.current ||
      event.defaultPrevented ||
      event.metaKey ||
      event.altKey ||
      event.isComposing ||
      target?.closest?.(
        "input, textarea, select, button, [contenteditable], [role=dialog], [role=textbox]",
      )
    )
      return false;
    if (document.querySelector(".reader-dictionary.is-open")) return false;
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "s" && runtime.flagReady.current && !runtime.panelRef.current &&
      !document.querySelector('[role="dialog"]:not(.reader-dictionary), .reader-dictionary.is-open')) {
      const native = contents().find(content => !!content.document.getSelection()?.toString().trim());
      if (!native && !runtime.selectionRef.current && (!active || !isVisible(active))) return false;
      event.preventDefault();
      if (!event.repeat) {
        if (runtime.selectionRef.current) selection.flagSelection();
        else if (native) selection.flagSelection(native.cfiFromRange(native.document.getSelection()!.getRangeAt(0)), native);
        else if (focusedSelection) runtime.wordAction.current?.("f", focusedSelection);
      }
      return true;
    }
    if (event.ctrlKey && !event.shiftKey && (event.code === "Space" || event.key === " ")) {
      const native = contents().find(
        (content) => !!content.document.getSelection()?.toString().trim(),
      );
      if (!native && !active && !runtime.selectionRef.current) return false;
      event.preventDefault();
      if (native) {
        const range = native.document.getSelection()!.getRangeAt(0);
        selection.openLookup(native.cfiFromRange(range), native);
      } else if (focusedSelection && active && isVisible(active)) {
        selection.openLookup(undefined, undefined, focusedSelection);
      } else if (active) {
        if (isVisible(active))
          selection.openLookup(
            group ? active.contents.cfiFromRange(group.range) : active.cfi,
            active.contents,
          );
      } else selection.openLookup();
      return true;
    }
    const action = /^Key[TACNF]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
    if (!runtime.panelRef.current && !event.ctrlKey && !event.shiftKey && ["t", "a", "c", "n", "f"].includes(action)) {
      const value = runtime.selectionRef.current || focusedSelection;
      if (!value) return false;
      event.preventDefault();
      targetX = null;
      if (!event.repeat) {
        if (action === "t") {
          if (focusedSelection) selection.openLookup(undefined, undefined, focusedSelection);
          else selection.openLookup();
        } else runtime.wordAction.current?.(action, value);
      }
      return true;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(event.key) ||
      (event.ctrlKey && !["ArrowLeft", "ArrowRight"].includes(event.key))) return false;
    event.preventDefault();
    const direction: Direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? "next" : "prev";
    const kind = event.ctrlKey ? "sentence" : ["ArrowDown", "ArrowUp"].includes(event.key) ? "line" : "word";
    const extendSelection = event.shiftKey;
    const request = version;
    queue = queue.then(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      .then(async () => {
        if (request !== version) return;
        navigationKind = kind; extending = extendSelection; lineEntry = false;
        if (kind !== "line") targetX = null;
        if (kind === "line" && active && isVisible(active)) {
          const {words, lines} = geometry();
          const current = lines.findIndex(line => line.words.some(rect => words[rect.index] === active));
          const rect = lines[current]?.words.find(rect => words[rect.index] === active);
          if (rect) {
            targetX ??= (rect.left + rect.right) / 2;
            const next = lines[current + (direction === "next" ? 1 : -1)];
            if (next) { await highlight(words[closestSentenceWord(next, targetX)], direction); return; }
          }
          lineEntry = true;
        }
        await step(direction, request);
      }).catch(() => undefined);
    return true;
  };
  return {
    onKey,
    flagCurrent,
    hasVisibleHighlight: () => !!active && isVisible(active),
    clear,
    relocated: () => {
      cached = undefined;
      if (turning || runtime.changingLayout.current || !active) return;
      if (!isVisible(active)) clear();
    },
    bind: (content: Contents) => {
      cached = undefined;
      const invalidate = () => {
        cached = undefined;
      };
      const observer = new ResizeObserver(invalidate);
      observer.observe(content.document.body);
      const mutations = new MutationObserver(() => {
        chapters.delete(content.document);
        invalidate();
      });
      mutations.observe(content.document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      content.document.addEventListener("pointerdown", clear);
      return () => {
        observer.disconnect();
        mutations.disconnect();
        chapters.delete(content.document);
        cached = undefined;
        content.document.removeEventListener("pointerdown", clear);
      };
    },
  };
}
