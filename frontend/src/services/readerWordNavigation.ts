import { EpubCFI, type Contents, type Location } from "epubjs";
import { ReaderPassageMarker } from "./readerPassageMarker";
import { selectionEndpoints } from "./readerSelectionRange";
import type { EpubRuntime } from "../hooks/reader/useEpubRuntime";
import type { ReaderSelection } from "../hooks/reader/useReaderSelection";

type Word = { cfi: string; contents: Contents; range: Range; index: number };
/** Keyboard focus is independent of native selection and lookup state. */
export function createReaderWordNavigation(
  runtime: EpubRuntime,
  selection: Pick<ReaderSelection, "closeLookup" | "openLookup">,
) {
  let active: Word | undefined;
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
    active = undefined;
  };
  const clear = () => {
    ++version;
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
    while ((node = walker.nextNode())) {
      if (
        node.parentElement?.closest(
          "script, style, [hidden], [aria-hidden=true], input, textarea, select, [contenteditable]",
        )
      )
        continue;
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
          get cfi() {
            return (cfi ??= content.cfiFromRange(range));
          },
        });
      }
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
    if (!active) return;
    const words = chapters.get(active.contents.document);
    if (words?.[active.index] !== active) return;
    const offset = direction === "next" ? 1 : -1;
    for (let index = active.index + offset; words[index]; index += offset) {
      const word = words[index];
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
  const highlight = async (word: Word) => {
    clearPaint();
    selection.closeLookup();
    contents().forEach((content) =>
      content.document.getSelection()?.removeAllRanges(),
    );
    active = word;
    if (turning) word.contents.document.defaultView?.focus();
    await marker.show(
      { cfi: word.cfi, text: word.range.toString() },
      "blue",
      async () => [word.cfi],
    );
  };
  const step = async (direction: "next" | "prev", request: number) => {
    const rendition = runtime.renditionRef.current;
    if (!rendition || request !== version || runtime.changingLayout.current)
      return;
    const native = contents().find(
      (content) => !!content.document.getSelection()?.toString().trim(),
    );
    if (active && !native) {
      const word = adjacentWord(direction);
      if (word && isVisible(word)) {
        await highlight(word);
        return;
      }
    }
    const continuing =
      active &&
      !native &&
      isVisible(active) &&
      chapters.get(active.contents.document)?.[active.index] === active;
    let words = continuing ? [] : visibleWords();
    const index = active
      ? words.findIndex((word) => word.cfi === active!.cfi)
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
      await highlight(words[next]);
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
        const adjacent = adjacentWord(direction);
        if (adjacent && isVisible(adjacent)) {
          await highlight(adjacent);
          return;
        }
        if (adjacent?.range.startContainer.isConnected) continue;
        words = visibleWords();
        const word = direction === "next" ? words[0] : words[words.length - 1];
        if (word) {
          await highlight(word);
          return;
        }
      }
    } finally {
      turning = false;
    }
  };
  const onKey = (event: KeyboardEvent): boolean => {
    const target = event.target as Element | null;
    const host = runtime.host.current;
    const doc = target?.ownerDocument;
    const inReader =
      !!host &&
      ((!!target && host.contains(target)) ||
        contents().some((content) => content.document === doc));
    if (
      !inReader ||
      runtime.mobileRef.current ||
      runtime.changingLayout.current ||
      event.defaultPrevented ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      target?.closest?.(
        "input, textarea, select, button, [contenteditable], [role=dialog], [role=textbox]",
      )
    )
      return false;
    if (event.ctrlKey && (event.code === "Space" || event.key === " ")) {
      const native = contents().find(
        (content) => !!content.document.getSelection()?.toString().trim(),
      );
      if (!native && !active && !runtime.selectionRef.current) return false;
      event.preventDefault();
      if (native) {
        const range = native.document.getSelection()!.getRangeAt(0);
        selection.openLookup(native.cfiFromRange(range), native);
      } else if (active) {
        if (isVisible(active))
          selection.openLookup(active.cfi, active.contents);
      } else selection.openLookup();
      return true;
    }
    if (event.ctrlKey || !["ArrowDown", "ArrowUp"].includes(event.key))
      return false;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? "next" : "prev";
    const request = version;
    // Give each repeated key its own frame so intermediate words are visible.
    queue = queue
      .then(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      )
      .then(() => step(direction, request))
      .catch(() => undefined);
    return true;
  };
  return {
    onKey,
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
