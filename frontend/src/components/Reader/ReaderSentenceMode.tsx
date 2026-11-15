import { readerSentencePassageOffsets } from "../../services/readerSentencePassageOffsets";
import {
  measureSentenceLines,
  closestSentenceWord,
  type SentenceVisualLine,
} from "../../services/readerSentenceGeometry";
import { useTranslation } from "react-i18next";
import { EpubCFI } from "epubjs";
import {
  readerSentenceSelectionRange,
} from "../../services/readerSentenceSelectionRange";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiFlag,
  FiGlobe,
  FiMessageSquare,
} from "react-icons/fi";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
import type { ReaderTextSelection } from "../../types/reader";
import { readerAiLimits } from "../../services/readerAiLimits";
import { ReaderDictionary } from "./ReaderDictionary";

/** Lucide scan-line, matching the approved demo without adding an icon package. */
export function ScanLineIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
    </svg>
  );
}

export function ReaderSentenceMode({
  reader,
  bookId,
}: {
  reader: EpubReaderController;
  bookId: string;
}) {
  const { t } = useTranslation();
  const [flagging, setFlagging] = useState(false);
  const flagPending = useRef(false);
  const mode = reader.sentenceMode;
  const [lookup, setLookup] = useState<{
    selection: ReaderTextSelection;
    translate: boolean;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [selectedText, setSelectedText] = useState<{
    cfi: string;
    start: number;
    end: number;
    text: string;
    backward?: boolean;
  } | null>(null);
  const [wordFocus, setWordFocus] = useState({ cfi: "", index: -1 });
  const extendedSelection = useRef<{
    cfi: string;
    anchor: number;
    focus: number;
  } | null>(null);
  const verticalX = useRef<number | null>(null);
  const visualLines = useRef<SentenceVisualLine[] | null>(null);
  const resetVertical = () => {
    verticalX.current = null;
  };
  const getVisualLines = () =>
    (visualLines.current ??= sentenceText.current
      ? measureSentenceLines(sentenceText.current)
      : []);
  const pendingWord = useRef<{ cfi: string; direction: number; x?: number } | null>(null);
  const highlightedWord = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sentenceText = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const sentence = mode.sentence;
  const parts =
    sentence?.text.split(/([\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*)/gu) || [];
  let partOffset = 0;
  const partOffsets = parts.map((part) => {
    const start = partOffset;
    partOffset += part.length;
    return start;
  });
  const translatedRanges = useMemo(() => {
    if (!sentence || !reader.searchBook) return [];
    const section = reader.searchBook.spine.get(sentence.cfi);
    if (!section?.document) return [];
    const source = new EpubCFI(sentence.cfi).toRange(section.document);
    return reader.translatedPassages.flatMap((passage) => {
      const offsets = readerSentencePassageOffsets(source, section.index, passage);
      return offsets ? [offsets] : [];
    });
  }, [sentence?.cfi, reader.searchBook, reader.translatedPassages]);
  const annotationRanges = useMemo(() => {
    if (!sentence || !reader.searchBook) return [];
    const section = reader.searchBook.spine.get(sentence.cfi);
    if (!section?.document) return [];
    const source = new EpubCFI(sentence.cfi).toRange(section.document);
    const draft = reader.annotations.draft;
    const items = draft && reader.panel === "annotations"
      ? [...reader.annotations.items.filter(item => item.id !== draft.id), draft]
      : reader.annotations.items;
    return items.flatMap(item => {
      if (item.color === "none" && !item.note.trim()) return [];
      const offsets = readerSentencePassageOffsets(source, section.index, item);
      return offsets ? [{ ...offsets, color: item.color, note: !!item.note.trim() }] : [];
    });
  }, [sentence?.cfi, reader.searchBook, reader.annotations.items, reader.annotations.draft, reader.panel]);
  useLayoutEffect(() => {
    visualLines.current = null;
  }, [translatedRanges, annotationRanges]);
  const renderTranslated = (text: string, offset: number): ReactNode => {
    const end = offset + text.length;
    const cuts = [
      ...new Set([
        offset,
        end,
        ...[...translatedRanges, ...annotationRanges]
          .flatMap((range) => [
            Math.max(offset, range.start),
            Math.min(end, range.end),
          ])
          .filter((point) => point > offset && point < end),
      ]),
    ].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((start, index) => {
      const value = text.slice(start - offset, cuts[index + 1] - offset);
      const annotation = annotationRanges.filter(range => range.start <= start && range.end >= cuts[index + 1]).at(-1);
      const annotated = annotation ? (
        <mark key={start} className="reader-sentence-annotation" data-color={annotation.color} data-note={String(annotation.note)}>{value}</mark>
      ) : value;
      return translatedRanges.some(
        (range) => range.start <= start && range.end >= cuts[index + 1],
      ) ? (
        <mark key={start} className="reader-sentence-translated">
          {annotated}
        </mark>
      ) : (
        annotated
      );
    });
  };
  const renderPart = (part: string, index: number): ReactNode => {
    const start = partOffsets[index];
    const end = start + part.length;
    const notes =
      sentence?.notes?.filter(
        (note) =>
          note.offset >= start &&
          (note.offset < end ||
            (index === parts.length - 1 && note.offset === end)),
      ) || [];
    if (!notes.length) return renderTranslated(part, start);
    const content: ReactNode[] = [];
    let cursor = 0;
    notes.forEach((note, noteIndex) => {
      const offset = note.offset - start;
      content.push(
        renderTranslated(part.slice(cursor, offset), start + cursor),
      );
      content.push(
        <sup
          key={noteIndex}
          className="reader-sentence-note"
          role="link"
          aria-disabled="true"
          aria-label={"Note " + note.text + " (unavailable in Sentence Mode)"}
          title="Notes are unavailable in Sentence Mode"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {note.text}
        </sup>,
      );
      cursor = offset;
    });
    content.push(renderTranslated(part.slice(cursor), start + cursor));
    return content;
  };
  const wordCount = Math.floor(parts.length / 2);
  const wordIndex = wordFocus.cfi === sentence?.cfi ? wordFocus.index : -1;
  const blocked = mode.busy || !!lookup || !!reader.panel;
  const textTarget = selectedText?.cfi === sentence?.cfi ? selectedText : null;
  const wordPart = wordIndex >= 0 ? wordIndex * 2 + 1 : -1;
  const actionTarget =
    textTarget ||
    (sentence && wordPart >= 0
      ? {
          cfi: sentence.cfi,
          start: partOffsets[wordPart],
          end: partOffsets[wordPart] + parts[wordPart].length,
          text: parts[wordPart],
        }
      : null);
  const wordNavigationOrigin = (direction: number) => {
    if (wordIndex >= 0) return wordIndex;
    const extended =
      extendedSelection.current?.cfi === sentence?.cfi
        ? extendedSelection.current
        : null;
    const focus =
      extended?.focus ??
      (textTarget
        ? textTarget.backward
          ? textTarget.start
          : textTarget.end
        : undefined);
    if (focus === undefined) return -1;
    const anchor =
      extended?.anchor ??
      (textTarget?.backward ? textTarget.end : (textTarget?.start ?? focus));
    const backward = focus < anchor || (focus === anchor && direction < 0);
    const words = parts.flatMap((part, index) =>
      index % 2
        ? [{ start: partOffsets[index], end: partOffsets[index] + part.length }]
        : [],
    );
    // At the active end of a backward selection, continue from its first word;
    // at the active end of a forward selection, continue from its last word.
    if (backward) {
      const index = words.findIndex((word) => word.end > focus);
      return index < 0 ? words.length - 1 : index;
    }
    for (let index = words.length - 1; index >= 0; index--)
      if (words[index].start < focus) return index;
    return 0;
  };
  const clearTextSelection = () => {
    extendedSelection.current = null;
    setSelectedText(null);
    const native = window.getSelection();
    if (native?.anchorNode && sentenceText.current?.contains(native.anchorNode))
      native.removeAllRanges();
  };
  useLayoutEffect(() => {
    const draft = reader.annotations.draft;
    if (reader.panel !== "annotations" || !draft || draft.color === "none") return;
    // The draft already owns the exact source range. Let its preview color replace focus paint.
    clearTextSelection();
    setWordFocus({ cfi: "", index: -1 });
    resetVertical();
  }, [reader.panel, reader.annotations.draft?.cfi, reader.annotations.draft?.endCfi, reader.annotations.draft?.color]);
  const captureSelection = () => {
    const element = sentenceText.current;
    const native = window.getSelection();
    if (!element || !sentence || !native?.rangeCount) return;
    const range = native.getRangeAt(0);
    if (
      !element.contains(range.startContainer) ||
      !element.contains(range.endContainer)
    )
      return;
    if (range.collapsed) {
      setSelectedText(null);
      return;
    }
    const clean = (range: Range) => {
      const fragment = range.cloneContents();
      fragment
        .querySelectorAll(".reader-sentence-note")
        .forEach((note) => note.remove());
      return fragment.textContent || "";
    };
    const prefix = range.cloneRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(range.startContainer, range.startOffset);
    const selected = clean(range);
    const leading = selected.length - selected.trimStart().length;
    const text = selected.trim();
    if (!text) {
      setSelectedText(null);
      return;
    }
    const start = clean(prefix).length + leading;
    const backward =
      native.anchorNode === range.endContainer &&
      native.anchorOffset === range.endOffset;
    setSelectedText((current) =>
      current?.cfi === sentence.cfi &&
      current.start === start &&
      current.end === start + text.length &&
      current.backward === backward
        ? current
        : {
            cfi: sentence.cfi,
            start,
            end: start + text.length,
            text,
            backward,
          },
    );
    setWordFocus({ cfi: "", index: -1 });
  };
  useEffect(() => {
    document.addEventListener("selectionchange", captureSelection);
    return () =>
      document.removeEventListener("selectionchange", captureSelection);
  });
  const extendWords = (
    direction: number,
    count: number,
    targetWord?: number,
  ) => {
    const element = sentenceText.current;
    if (!sentence || !element || !wordCount) return;
    const words = parts.flatMap((part, index) =>
      index % 2
        ? [{ start: partOffsets[index], end: partOffsets[index] + part.length }]
        : [],
    );
    let range =
      extendedSelection.current?.cfi === sentence.cfi
        ? extendedSelection.current
        : null;
    if (!range) {
      if (textTarget)
        range = {
          cfi: sentence.cfi,
          anchor: textTarget.backward ? textTarget.end : textTarget.start,
          focus: textTarget.backward ? textTarget.start : textTarget.end,
        };
      else if (wordIndex >= 0)
        range = {
          cfi: sentence.cfi,
          anchor: direction > 0 ? words[wordIndex].start : words[wordIndex].end,
          focus: direction > 0 ? words[wordIndex].end : words[wordIndex].start,
        };
      else
        range = {
          cfi: sentence.cfi,
          anchor: direction > 0 ? 0 : words[words.length - 1].end,
          focus: direction > 0 ? 0 : words[words.length - 1].end,
        };
    }
    const candidates =
      direction > 0
        ? words.filter((word) => word.end > range!.focus)
        : words.filter((word) => word.start < range!.focus).reverse();
    const next = candidates[Math.min(count, candidates.length) - 1];
    const verticalWord =
      targetWord === undefined ? undefined : words[targetWord];
    const focus = verticalWord
      ? verticalWord.end <= range.anchor
        ? verticalWord.start
        : verticalWord.start >= range.anchor
          ? verticalWord.end
          : direction > 0
            ? verticalWord.end
            : verticalWord.start
      : next
        ? direction > 0
          ? next.end
          : next.start
        : range.focus;
    extendedSelection.current = { ...range, focus };
    const locate = (offset: number) => {
      const walker = document.createTreeWalker(element, 4);
      let last: Text | null = null;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest(".reader-sentence-note")) continue;
        const text = node as Text;
        last = text;
        if (offset <= text.length) return { node: text, offset };
        offset -= text.length;
      }
      return last ? { node: last, offset: last.length } : null;
    };
    const anchorPoint = locate(range.anchor),
      focusPoint = locate(focus);
    if (!anchorPoint || !focusPoint) return;
    window
      .getSelection()
      ?.setBaseAndExtent(
        anchorPoint.node,
        anchorPoint.offset,
        focusPoint.node,
        focusPoint.offset,
      );
    const from = Math.min(range.anchor, focus),
      to = Math.max(range.anchor, focus);
    const selected = sentence.text.slice(from, to);
    const text = selected.trim();
    const start = from + selected.length - selected.trimStart().length;
    setWordFocus({ cfi: "", index: -1 });
    setSelectedText(
      text
        ? {
            cfi: sentence.cfi,
            start,
            end: start + text.length,
            text,
            backward: focus < range.anchor,
          }
        : null,
    );
  };
  const selection = (requireMarked = false, preserveDismissed = false): ReaderTextSelection | null => {
    if (!sentence) return null;
    const cursor = preserveDismissed && extendedSelection.current?.cfi === sentence.cfi
      ? extendedSelection.current : null;
    const retained = cursor && cursor.anchor !== cursor.focus
      ? { start: Math.min(cursor.anchor, cursor.focus),
          end: Math.max(cursor.anchor, cursor.focus),
          text: sentence.text.slice(Math.min(cursor.anchor, cursor.focus), Math.max(cursor.anchor, cursor.focus)) }
      : null;
    const chosen =
      actionTarget || retained ||
      (!requireMarked
        ? { start: 0, end: sentence.text.length, text: sentence.text }
        : null);
    if (!chosen) return null;
    const rect = stage.current?.getBoundingClientRect();
    try {
      const section = reader.searchBook?.spine.get(sentence.cfi);
      if (!section?.document) throw new Error("Section unavailable");
      const range = readerSentenceSelectionRange(
        new EpubCFI(sentence.cfi).toRange(section.document),
        chosen.start,
        chosen.end,
      );
      if (!range) throw new Error("Selection unavailable");
      return {
        text: chosen.text,
        word: chosen.text,
        cfi:
          chosen.start === 0 && chosen.end === sentence.text.length
            ? sentence.cfi
            : section.cfiFromRange(range),
        x: rect?.left || 12,
        y: (rect?.top || 0) + 30,
      };
    } catch {
      setFeedback(
        "Could not locate the selected text. Please select it again.",
      );
      return null;
    }
  };
  const flagSelection = async () => {
    const current = selection();
    if (!current || blocked || !reader.flags.ready || flagPending.current)
      return;
    flagPending.current = true;
    setFlagging(true);
    try {
      await reader.flags.save(current, false, sentence?.text);
    } catch {
      setFeedback(t("reader.review.saveError"));
    } finally {
      flagPending.current = false;
      setFlagging(false);
    }
  };
  useEffect(() => {
    stage.current?.scrollTo(0, 0);
    clearTextSelection();
    setFeedback("");
    const pending = pendingWord.current;
    pendingWord.current = null;
    if (pending?.x === undefined) resetVertical();
    else verticalX.current = pending.x;
    visualLines.current = null;
    const entryLines = sentenceText.current ? measureSentenceLines(sentenceText.current) : [];
    const entryLine = pending?.direction === 1 ? entryLines[0] : entryLines.at(-1);
    const count = Math.floor(
      (sentence?.text.split(/([\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*)/gu)
        .length || 0) / 2,
    );
    setWordFocus(
      pending && sentence && pending.cfi !== sentence.cfi && count
        ? { cfi: sentence.cfi, index: pending.x !== undefined && entryLine
            ? closestSentenceWord(entryLine, pending.x)
            : pending.direction > 0 ? 0 : count - 1 }
        : { cfi: "", index: -1 },
    );
  }, [sentence?.cfi]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useLayoutEffect(() => {
    const element = sentenceText.current;
    if (!element) return;
    let disposed = false;
    // Measure the complete sentence; never hide text just to remove a scrollbar.
    const fit = () => {
      visualLines.current = null;
      if (disposed || !element.clientWidth || !element.clientHeight) return;
      element.style.removeProperty("font-size");
      element.style.removeProperty("text-wrap");
      const preferred = parseFloat(getComputedStyle(element).fontSize);
      const fits = () =>
        element.scrollHeight <= element.clientHeight &&
        element.scrollWidth <= element.clientWidth;
      if (fits()) return;
      // Balancing thousands of words on every measurement is costly in WebKit.
      // Normal wrapping also makes the fit search predictable for long sentences.
      element.style.setProperty("text-wrap", "wrap");
      if (fits()) return;
      let low = 0.5;
      let high = preferred;
      for (let i = 0; i < 14; i++) {
        const size = (low + high) / 2;
        element.style.fontSize = size + "px";
        if (fits()) low = size;
        else high = size;
      }
      element.style.fontSize = Math.floor(low * 100) / 100 + "px";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    if (stage.current) observer.observe(stage.current);
    const styles = new MutationObserver(() => {
      visualLines.current = null;
    });
    styles.observe(element, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    const refresh = () => {
      resetVertical();
      fit();
    };
    window.addEventListener("resize", refresh);
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", refresh);
    return () => {
      disposed = true;
      observer.disconnect();
      styles.disconnect();
      document.fonts.removeEventListener("loadingdone", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [sentence?.text, sentence?.notes, mode.busy]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const actionKey = /^Key[TACNF]$/.test(event.code)
        ? event.code.slice(3).toLowerCase()
        : /^[tacnf]$/i.test(event.key)
          ? event.key.toLowerCase()
          : null;
      if (
        event.ctrlKey &&
        ["ArrowLeft", "ArrowRight"].includes(event.key) &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !blocked &&
        sentence &&
        !target?.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog],[role=textbox],[role=slider]",
        )
      ) {
        event.preventDefault();
        resetVertical();
        clearTextSelection();
        setWordFocus({ cfi: "", index: -1 });
        const direction = event.key === "ArrowRight" ? 1 : -1;
        if (direction > 0 ? mode.canNext : mode.canBack) {
          pendingWord.current = { cfi: sentence.cfi, direction: 1 };
          mode.move(direction);
        }
        return;
      }
      if (
        event.ctrlKey &&
        (event.code === "KeyS" || event.key.toLowerCase() === "s") &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !blocked &&
        sentence &&
        reader.flags.ready &&
        !target?.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog],[role=textbox],[role=slider]",
        )
      ) {
        event.preventDefault();
        if (!event.repeat)
          actions.current
            ?.querySelector<HTMLButtonElement>('[data-shortcut="f"]')
            ?.click();
        return;
      }
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.shiftKey &&
          !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(
            event.key,
          ) &&
          !actionKey) ||
        blocked ||
        target?.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog],[role=textbox],[role=slider]",
        )
      )
        return;
      if (event.shiftKey && ["ArrowRight", "ArrowLeft"].includes(event.key)) {
        if (!reader.mobile && sentence && wordCount) {
          event.preventDefault();
          const key = event.key as "ArrowRight" | "ArrowLeft";
          resetVertical();
          extendWords(key === "ArrowRight" ? 1 : -1, 1);
        }
        return;
      }
      const moveWords = (direction: number, origin: number, repeat = false) => {
        if (!sentence || !wordCount) return;
        const atEdge =
          origin >= 0 &&
          (direction > 0 ? origin === wordCount - 1 : origin === 0);
        if (atEdge) {
          // Holding a key must not bypass the required extra press at an edge.
          if (!repeat && (direction > 0 ? mode.canNext : mode.canBack)) {
            pendingWord.current = { cfi: sentence.cfi, direction };
            mode.move(direction);
          }
          return;
        }
        const next =
          origin < 0 ? (direction > 0 ? 0 : wordCount - 1) : origin + direction;
        setWordFocus({
          cfi: sentence.cfi,
          index: Math.max(0, Math.min(wordCount - 1, next)),
        });
      };
      const action = actionKey
        ? actions.current?.querySelector<HTMLButtonElement>(
            '[data-shortcut="' + actionKey + '"]',
          )
        : null;
      if (action && !action.disabled) {
        event.preventDefault();
        if (!event.repeat) action.click();
        return;
      }
      if (
        ["ArrowDown", "ArrowUp"].includes(event.key) &&
        sentence &&
        wordCount
      ) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const lines = getVisualLines();
        let origin = wordNavigationOrigin(direction);
        if (origin < 0) {
          origin = direction > 0 ? 0 : wordCount - 1;
          if (event.shiftKey) extendWords(direction, 1);
          else {
            clearTextSelection();
            setWordFocus({ cfi: sentence.cfi, index: origin });
          }
          return;
        }
        const matching = lines.flatMap((line, index) =>
          line.words.some((word) => word.index === origin) ? [index] : [],
        );
        const currentLine =
          direction > 0 ? matching[matching.length - 1] : matching[0];
        if (currentLine === undefined) return;
        const rect = lines[currentLine].words.find(
          (word) => word.index === origin,
        )!;
        const x = verticalX.current ?? (rect.left + rect.right) / 2;
        verticalX.current = x;
        const next = lines[currentLine + direction];
        if (next) {
          const index = closestSentenceWord(next, x);
          if (event.shiftKey) extendWords(direction, 1, index);
          else {
            clearTextSelection();
            setWordFocus({ cfi: sentence.cfi, index });
          }
        } else if (direction > 0 ? mode.canNext : mode.canBack) {
          clearTextSelection();
          pendingWord.current = { cfi: sentence.cfi, direction, x };
          mode.move(direction);
        }
      } else if (
        sentence &&
        wordCount &&
        ["ArrowRight", "ArrowLeft"].includes(event.key)
      ) {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const origin = wordNavigationOrigin(direction);
        resetVertical();
        clearTextSelection();
        moveWords(direction, origin, event.repeat);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    mode,
    blocked,
    reader.mobile,
    sentence,
    wordCount,
    wordIndex,
    reader.flags.ready,
    actionTarget,
  ]);
  const openLookup = (translate: boolean) => {
    const current = selection(true);
    if (current) setLookup({ selection: current, translate });
  };
  const translateDisabled =
    !actionTarget || actionTarget.text.length > readerAiLimits.passage;
  const aiDisabled =
    !sentence ||
    (actionTarget?.text || sentence.text).length > readerAiLimits.passage;
  return (
    <section
      className="reader-sentence-mode"
      aria-label="Sentence Mode"
      dir="ltr"
      style={
        {
          "--sentence-selection-color":
            reader.state.preferences.selectionColor || "#719bd8",
          "--sentence-selection-text-color":
            reader.state.preferences.selectionTextColor || "#28231e",
          "--sentence-translation-color":
            reader.state.preferences.translationColor || "#a3c2ff",
          "--sentence-translation-text-color":
            reader.state.preferences.translationTextColor || "#28231e",
        } as CSSProperties
      }
    >
      {lookup && (
        <ReaderDictionary
          key={lookup.selection.cfi}
          selection={lookup.selection}
          passage={
            !/^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(lookup.selection.text) ||
            lookup.selection.text.length > 80
          }
          autoLookup={lookup.translate}
          bookId={bookId}
          getLookupPage={reader.getLookupPage}
          onClose={() => setLookup(null)}
          onFlag={() => void reader.flags.save(lookup.selection, true)}
          flagged={!!reader.flags.has(lookup.selection)}
          flagReady={reader.flags.ready}
          onCopyFeedback={setFeedback}
          onTranslationDismiss={(passage) => {
            const cursor =
              extendedSelection.current ||
              (sentence && actionTarget
                ? {
                    cfi: sentence.cfi,
                    anchor: textTarget?.backward
                      ? actionTarget.end
                      : actionTarget.start,
                    focus: textTarget?.backward
                      ? actionTarget.start
                      : actionTarget.end,
                  }
                : null);
            clearTextSelection();
            setWordFocus({ cfi: "", index: -1 });
            extendedSelection.current = cursor;
            reader.markTranslation(passage);
          }}
          onAnnotate={(note) => {
            const current = lookup.selection;
            setLookup(null);
            reader.annotations.select(current, note);
          }}
          annotationBusy={reader.annotations.busy || reader.annotations.loading}
          onAskAi={(autoSubmit) => {
            const current = lookup.selection;
            setLookup(null);
            reader.askSentenceAi(current, autoSubmit);
          }}
          aiDisabled={aiDisabled}
          busy={false}
          extending={false}
        />
      )}
      <div className="reader-sentence-stage" ref={stage}>
        <div className="reader-sentence-content">
          <p className="reader-sentence-chapter">{mode.chapterTitle}</p>
          <div
            className="reader-sentence-text"
            ref={sentenceText}
            aria-live="polite"
            aria-busy={mode.busy}
            dir="auto"
            onPointerDown={() => {
              resetVertical();
              clearTextSelection();
              setWordFocus({ cfi: "", index: -1 });
            }}
            onPointerUp={captureSelection}
          >
            {mode.busy
              ? "Loading sentences…"
              : sentence
                ? parts.map((part, index) =>
                    index % 2 === 0 ? (
                      <span key={index}>{renderPart(part, index)}</span>
                    ) : (
                      <span
                        key={index}
                        data-sentence-word=""
                        onClick={() => {
                          if (!window.getSelection()?.toString().trim())
                            setWordFocus({
                              cfi: sentence.cfi,
                              index: (index - 1) / 2,
                            });
                        }}
                        className={
                          wordIndex === (index - 1) / 2
                            ? "reader-sentence-word-active"
                            : undefined
                        }
                        ref={
                          wordIndex === (index - 1) / 2
                            ? highlightedWord
                            : undefined
                        }
                        style={
                          wordIndex === (index - 1) / 2
                            ? {
                                backgroundColor:
                                  reader.state.preferences.selectionColor ||
                                  "#719bd8",
                                color:
                                  reader.state.preferences.selectionTextColor ||
                                  "#28231e",
                              }
                            : undefined
                        }
                      >
                        {renderPart(part, index)}
                      </span>
                    ),
                  )
                : "No readable sentences."}
          </div>
        </div>
      </div>
      {mode.error && (
        <div className="reader-sentence-error" role="alert">
          {mode.error}{" "}
          <button onClick={() => void mode.retry()} disabled={mode.busy}>
            Retry
          </button>
        </div>
      )}
      <div className="reader-sentence-progress">
        <span>
          {mode.number} / {mode.count}
        </span>
        <progress
          aria-label="Sentence progress in chapter"
          value={mode.number}
          max={mode.count || 1}
        />
        <span>
          {mode.count ? Math.round((mode.number / mode.count) * 100) : 0}%
        </span>
      </div>
      <footer className="reader-sentence-controls">
        <div className="reader-sentence-nav">
          <button
            disabled={blocked || !mode.canBack}
            onClick={() => {
              pendingWord.current = null;
              resetVertical();
              mode.move(-1);
            }}
          >
            <FiChevronLeft />
            Back
          </button>
          <button
            disabled={blocked || !mode.canNext}
            onClick={() => {
              pendingWord.current = null;
              mode.move(1);
            }}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
        <div
          className="reader-sentence-actions"
          ref={actions}
          onMouseDown={(event) => event.preventDefault()}
        >
          <button
            disabled={blocked || translateDisabled}
            data-shortcut="t"
            aria-label="Translate"
            aria-keyshortcuts="t"
            title="Translate (T)"
            onClick={() => openLookup(true)}
          >
            <FiGlobe />
            <span>Translate</span>
          </button>
          <button
            disabled={blocked || aiDisabled}
            data-shortcut="a"
            aria-label="Ask AI"
            aria-keyshortcuts="a"
            title="Ask AI (A)"
            onClick={() => {
              const current = selection();
              if (current) reader.askSentenceAi(current);
            }}
          >
            <FiMessageSquare />
            <span>Ask AI</span>
          </button>
          <button
            disabled={blocked || !sentence}
            data-shortcut="c"
            aria-label="Copy"
            aria-keyshortcuts="c"
            title="Copy selected text or sentence (C)"
            onClick={async () => {
              try {
                const current = selection();
                if (!current) return;
                await navigator.clipboard.writeText(current.text);
                setFeedback("Selected text copied");
              } catch {
                setFeedback("Could not copy sentence. Please try again.");
              }
            }}
          >
            <FiCopy />
            <span>Copy</span>
          </button>
          <button
            data-shortcut="n"
            aria-label="Annotate"
            aria-keyshortcuts="n"
            title="Annotate (N)"
            disabled={
              blocked ||
              !sentence ||
              reader.annotations.busy ||
              reader.annotations.loading
            }
            onClick={() => {
              const current = selection(false, true);
              if (current) reader.annotations.select(current, true);
            }}
          >
            <FiEdit3 />
            <span>Annotate</span>
          </button>
          <button
            disabled={blocked || !sentence || !reader.flags.ready || flagging}
            data-shortcut="f"
            aria-keyshortcuts="f Control+s"
            title={t("reader.review.flag") + " · F"}
            aria-label="Flag"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void flagSelection()}
          >
            <FiFlag />
            <span>Flag</span>
          </button>
        </div>
      </footer>
      {feedback && (
        <div className="reader-sentence-toast" role="status">
          {feedback}
        </div>
      )}
    </section>
  );
}
