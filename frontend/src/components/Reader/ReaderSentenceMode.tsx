import { useTranslation } from "react-i18next";
import { readerSentenceWordRange } from "../../services/readerSentenceWordRange";
import { useEffect, useRef, useState } from "react";
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
  const [wordFocus, setWordFocus] = useState({ cfi: "", index: -1 });
  const pendingWord = useRef<{ cfi: string; direction: number } | null>(null);
  const highlightedWord = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const sentence = mode.sentence;
  const parts =
    sentence?.text.split(/([\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*)/gu) || [];
  const wordCount = Math.floor(parts.length / 2);
  const wordIndex = wordFocus.cfi === sentence?.cfi ? wordFocus.index : -1;
  const blocked = mode.busy || !!lookup || !!reader.panel;
  const selection = (): ReaderTextSelection | null => {
    if (!sentence) return null;
    const rect = stage.current?.getBoundingClientRect();
    return {
      ...sentence,
      word: sentence.text,
      x: rect?.left || 12,
      y: (rect?.top || 0) + 30,
    };
  };
  const flagSelection = async () => {
    const current = selection();
    const book = reader.searchBook;
    if (
      !current ||
      !book ||
      blocked ||
      !reader.flags.ready ||
      flagPending.current
    )
      return;
    let index = wordIndex;
    const native = window.getSelection();
    if (native?.rangeCount && native.toString().trim()) {
      const range = native.getRangeAt(0);
      const words = [
        ...(stage.current?.querySelectorAll("[data-sentence-word]") || []),
      ];
      const selectedIndex = words.findIndex(
        (word) =>
          word.contains(range.startContainer) &&
          word.contains(range.endContainer),
      );
      if (selectedIndex >= 0) index = selectedIndex;
    }
    flagPending.current = true;
    setFlagging(true);
    try {
      if (index >= 0) {
        const range = readerSentenceWordRange(
          await book.getRange(current.cfi),
          index,
        );
        const section = book.spine.get(current.cfi);
        if (!range || !section) throw new Error("Word range unavailable");
        const text = range.toString();
        await reader.flags.save(
          {
            ...current,
            text,
            word: text,
            cfi: section.cfiFromRange(range),
            endCfi: undefined,
          },
          false,
          current.text,
        );
      } else await reader.flags.save(current);
    } catch {
      setFeedback(t("reader.review.saveError"));
    } finally {
      flagPending.current = false;
      setFlagging(false);
    }
  };
  useEffect(() => {
    stage.current?.scrollTo(0, 0);
    setFeedback("");
    const pending = pendingWord.current;
    pendingWord.current = null;
    const count = Math.floor(
      (sentence?.text.split(/([\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*)/gu)
        .length || 0) / 2,
    );
    setWordFocus(
      pending && sentence && pending.cfi !== sentence.cfi && count
        ? { cfi: sentence.cfi, index: pending.direction > 0 ? 0 : count - 1 }
        : { cfi: "", index: -1 },
    );
  }, [sentence?.cfi]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const word = highlightedWord.current;
    const container = stage.current;
    if (!word || !container) return;
    const bounds = word.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    if (bounds.top < viewport.top)
      container.scrollTop += bounds.top - viewport.top - 8;
    else if (bounds.bottom > viewport.bottom)
      container.scrollTop += bounds.bottom - viewport.bottom + 8;
  }, [wordIndex, sentence?.cfi]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "s" &&
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
        event.shiftKey ||
        blocked ||
        target?.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog],[role=textbox],[role=slider]",
        )
      )
        return;
      const action = actions.current?.querySelector<HTMLButtonElement>(
        '[data-shortcut="' +
          event.key.toLowerCase().replace(/[^a-z]/g, "") +
          '"]',
      );
      if (action && !action.disabled) {
        event.preventDefault();
        if (!event.repeat) action.click();
        return;
      }
      if (["ArrowRight", "ArrowLeft"].includes(event.key)) {
        event.preventDefault();
        pendingWord.current = null;
        setWordFocus({ cfi: "", index: -1 });
        mode.move(event.key === "ArrowRight" ? 1 : -1);
      } else if (
        !reader.mobile &&
        sentence &&
        wordCount &&
        ["ArrowDown", "ArrowUp"].includes(event.key)
      ) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next =
          wordIndex < 0
            ? direction > 0
              ? 0
              : wordCount - 1
            : wordIndex + direction;
        if (next < 0 || next >= wordCount) {
          if (direction > 0 ? mode.canNext : mode.canBack) {
            pendingWord.current = { cfi: sentence.cfi, direction };
            mode.move(direction);
          }
        } else setWordFocus({ cfi: sentence.cfi, index: next });
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
  ]);
  const openLookup = (translate: boolean) => {
    const current = selection();
    if (current) setLookup({ selection: current, translate });
  };
  const aiDisabled = !sentence || sentence.text.length > readerAiLimits.passage;
  return (
    <section
      className="reader-sentence-mode"
      aria-label="Sentence Mode"
      dir="ltr"
    >
      {lookup && (
        <ReaderDictionary
          key={lookup.selection.cfi}
          selection={lookup.selection}
          passage
          autoLookup={lookup.translate}
          bookId={bookId}
          getLookupPage={reader.getLookupPage}
          onClose={() => setLookup(null)}
          onFlag={() => void reader.flags.save(lookup.selection, true)}
          flagged={!!reader.flags.has(lookup.selection)}
          flagReady={reader.flags.ready}
          onCopyFeedback={setFeedback}
          onTranslationDismiss={reader.markTranslation}
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
            aria-live="polite"
            aria-busy={mode.busy}
            dir="auto"
            onPointerDown={() => setWordFocus({ cfi: "", index: -1 })}
          >
            {mode.busy
              ? "Loading sentences…"
              : sentence
                ? parts.map((part, index) =>
                    index % 2 === 0 ? (
                      part
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
                        {part}
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
        <div className="reader-sentence-actions" ref={actions}>
          <button
            disabled={blocked || aiDisabled}
            data-shortcut="t"
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
            aria-keyshortcuts="c"
            title="Copy sentence (C)"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sentence.text);
                setFeedback("Sentence copied");
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
            aria-keyshortcuts="n"
            title="Annotate (N)"
            disabled={
              blocked ||
              !sentence ||
              reader.annotations.busy ||
              reader.annotations.loading
            }
            onClick={() => {
              const current = selection();
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
