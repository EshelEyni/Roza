import {
  FiChevronLeft,
  FiChevronRight,
  FiSkipBack,
  FiSkipForward,
  FiPlay,
  FiPause,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
import { ReaderDictionary } from "./ReaderDictionary";
import type { ReaderTextSelection } from "../../types/reader";

export function ReaderRsvp({
  reader,
  bookId,
}: {
  reader: EpubReaderController;
  bookId: string;
}) {
  const { t } = useTranslation();
  const rsvp = reader.rsvp;
  const [selection, setSelection] = useState<ReaderTextSelection | null>(null);
  const [resume, setResume] = useState(false);
  function lookup(event: React.MouseEvent<HTMLButtonElement>) {
    if (!rsvp.word) return;
    rsvp.pause();
    const rect = event.currentTarget.getBoundingClientRect();
    const candidate = rsvp.word.text.replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, "");
    const word =
      /^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(candidate) &&
      candidate.length <= 80
        ? candidate
        : undefined;
    setSelection({
      word,
      text: rsvp.word.text,
      cfi: rsvp.word.cfi,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
  }
  return (
    <section
      className="reader-rsvp"
      aria-label={t("reader.rsvp.title")}
      dir="ltr"
    >
      {selection && (
        <ReaderDictionary
          selection={selection}
          bookId={bookId}
          getLookupPage={reader.getLookupPage}
          onClose={() => {
            setSelection(null);
            if (resume) rsvp.play();
          }}
          onAskAi={() => {
            setSelection(null);
          }}
          aiDisabled
          onExtend={async () => undefined}
          extending={false}
          busy={false}
          atStart
          atEnd
        />
      )}
      <p className="reader-rsvp-eyebrow">{t("reader.rsvp.focus")}</p>
      <div className="reader-rsvp-stage">
        <button
          className="reader-rsvp-word"
          disabled={!rsvp.word || rsvp.busy}
          onClick={lookup}
          aria-label={
            rsvp.word
              ? t("reader.rsvp.translate", { word: rsvp.word.text })
              : t("reader.rsvp.noWord")
          }
          style={{ fontFamily: reader.state.preferences.fontFamily }}
        >
          {rsvp.busy
            ? t("reader.rsvp.loading")
            : rsvp.word?.text || t("reader.rsvp.empty")}
        </button>
      </div>
      <div className="reader-rsvp-controls">
        {rsvp.error && <p role="alert">{rsvp.error}</p>}
        {rsvp.boundary && <p role="status">{t("reader.rsvp.finished")}</p>}
        <div className="reader-rsvp-progress">
          <div>
            <span>
              {t("reader.rsvp.wordProgress", {
                current: rsvp.wordNumber,
                total: rsvp.wordCount,
              })}
            </span>
            <span>
              {rsvp.wordCount
                ? Math.round((rsvp.wordNumber / rsvp.wordCount) * 100)
                : 0}
              %
            </span>
          </div>
          <progress
            aria-label={t("reader.rsvp.chapterProgress")}
            value={rsvp.wordNumber}
            max={rsvp.wordCount || 1}
          />
        </div>
        <div className="reader-rsvp-sentences">
          <button
            onClick={() => rsvp.skip(-1, true)}
            disabled={rsvp.busy || !!selection}
          >
            <FiSkipBack aria-hidden="true" />
            {t("reader.rsvp.previousSentence")}
          </button>
          <button
            onClick={() => rsvp.skip(1, true)}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.nextSentence")}
            <FiSkipForward aria-hidden="true" />
          </button>
        </div>
        <div className="reader-rsvp-playback">
          <button
            aria-label={t("reader.rsvp.previousWord")}
            title={t("reader.rsvp.previousWord")}
            onClick={() => rsvp.skip(-1)}
            disabled={rsvp.busy || !!selection}
          >
            <FiSkipBack aria-hidden="true" />
          </button>
          <button
            className="reader-rsvp-play"
            aria-label={
              rsvp.playing ? t("reader.rsvp.pause") : t("reader.rsvp.play")
            }
            onClick={rsvp.play}
            disabled={rsvp.busy || !!selection || !rsvp.word || rsvp.boundary}
            aria-pressed={rsvp.playing}
          >
            {rsvp.playing ? (
              <FiPause aria-hidden="true" />
            ) : (
              <FiPlay aria-hidden="true" />
            )}
          </button>
          <button
            aria-label={t("reader.rsvp.nextWord")}
            title={t("reader.rsvp.nextWord")}
            onClick={() => rsvp.skip(1)}
            disabled={rsvp.busy || !!selection}
          >
            <FiSkipForward aria-hidden="true" />
          </button>
        </div>
        <label className="reader-rsvp-speed">
          <span>
            <span>{t("reader.rsvp.readingSpeed")}</span>
            <strong>{rsvp.wpm} WPM</strong>
          </span>
          <input
            aria-label={t("reader.rsvp.speedLabel")}
            type="range"
            min="100"
            max="1000"
            step="25"
            value={rsvp.wpm}
            onChange={(event) => rsvp.speed(Number(event.target.value))}
          />
        </label>
        <label className="reader-rsvp-resume">
          <input
            type="checkbox"
            checked={resume}
            onChange={(event) => setResume(event.target.checked)}
          />{" "}
          {t("reader.rsvp.resume")}
        </label>
        <div className="reader-rsvp-chapters">
          <button
            aria-label={t("reader.rsvp.previousChapter")}
            onClick={() => rsvp.chapter(-1)}
            disabled={rsvp.busy || !!selection || !rsvp.canPreviousChapter}
          >
            <FiChevronLeft aria-hidden="true" />
            {t("reader.rsvp.chapter")}
          </button>
          <button
            onClick={() => void rsvp.toggle()}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.normal")}
          </button>
          <button
            aria-label={t("reader.rsvp.nextChapter")}
            onClick={() => rsvp.chapter(1)}
            disabled={rsvp.busy || !!selection || !rsvp.canNextChapter}
          >
            {t("reader.rsvp.chapter")}
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
        <p className="reader-rsvp-hint">{t("reader.rsvp.hint")}</p>
      </div>
    </section>
  );
}
