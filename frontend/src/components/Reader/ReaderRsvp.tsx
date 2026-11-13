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
        <div className="reader-rsvp-navigation">
          <button
            onClick={() => rsvp.skip(-1, true)}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.previousSentence")}
          </button>
          <button
            onClick={() => rsvp.skip(-1)}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.previousWord")}
          </button>
          <button
            onClick={rsvp.play}
            disabled={rsvp.busy || !!selection || !rsvp.word || rsvp.boundary}
            aria-pressed={rsvp.playing}
          >
            {rsvp.playing ? t("reader.rsvp.pause") : t("reader.rsvp.play")}
          </button>
          <button
            onClick={() => rsvp.skip(1)}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.nextWord")}
          </button>
          <button
            onClick={() => rsvp.skip(1, true)}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.nextSentence")}
          </button>
        </div>
        <label>
          {t("reader.rsvp.speed", { wpm: rsvp.wpm })}{" "}
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
        <label>
          <input
            type="checkbox"
            checked={resume}
            onChange={(event) => setResume(event.target.checked)}
          />{" "}
          {t("reader.rsvp.resume")}
        </label>
        <div className="reader-rsvp-navigation">
          <button
            onClick={() => rsvp.chapter(-1)}
            disabled={rsvp.busy || !!selection || !rsvp.canPreviousChapter}
          >
            {t("reader.rsvp.previousChapter")}
          </button>
          <button
            onClick={() => rsvp.chapter(1)}
            disabled={rsvp.busy || !!selection || !rsvp.canNextChapter}
          >
            {t("reader.rsvp.nextChapter")}
          </button>
          <button
            onClick={() => void rsvp.toggle()}
            disabled={rsvp.busy || !!selection}
          >
            {t("reader.rsvp.normal")}
          </button>
        </div>
        <p>{t("reader.rsvp.hint")}</p>
      </div>
    </section>
  );
}
