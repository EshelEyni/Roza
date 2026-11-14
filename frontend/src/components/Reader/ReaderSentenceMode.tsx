import { useEffect, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiFlag,
  FiGlobe,
  FiMessageSquare,
  FiMoreHorizontal,
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
  const mode = reader.sentenceMode;
  const [lookup, setLookup] = useState<{
    selection: ReaderTextSelection;
    translate: boolean;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const sentence = mode.sentence;
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
  useEffect(() => {
    stage.current?.scrollTo(0, 0);
    setFeedback("");
  }, [sentence?.cfi]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        blocked ||
        target?.closest(
          "input,textarea,select,[contenteditable=true],[role=dialog]",
        )
      )
        return;
      if (
        ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)
      ) {
        event.preventDefault();
        mode.move(
          event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1,
        );
      } else if (event.key === "Escape") {
        event.preventDefault();
        void mode.toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, blocked]);
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
          >
            {mode.busy
              ? "Loading sentences…"
              : sentence?.text || "No readable sentences."}
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
            onClick={() => mode.move(-1)}
          >
            <FiChevronLeft />
            Back
          </button>
          <button
            disabled={blocked || !mode.canNext}
            onClick={() => mode.move(1)}
          >
            Next
            <FiChevronRight />
          </button>
        </div>
        <div className="reader-sentence-actions">
          <button
            disabled={blocked || aiDisabled}
            onClick={() => openLookup(true)}
          >
            <FiGlobe />
            <span>Translate</span>
          </button>
          <button
            disabled={blocked || aiDisabled}
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
            disabled
            title="Save for Later requires Ticket #25"
            aria-label="Flag — Save for Later requires Ticket #25"
          >
            <FiFlag />
            <span>Flag</span>
          </button>
          <button
            disabled={blocked || !sentence}
            onClick={() => openLookup(false)}
          >
            <FiMoreHorizontal />
            <span>More</span>
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
