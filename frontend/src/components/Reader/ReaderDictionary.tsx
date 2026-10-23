import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiBookOpen, FiVolume2, FiX } from "react-icons/fi";
import { ReaderLookupResult } from "../../../../shared/types/readerDictionary";
import readerApiService from "../../services/readerApiService";

export interface ReaderWordSelection {
  word: string;
  cfi: string;
  x: number;
  y: number;
}

export function ReaderDictionary({
  selection,
  bookId,
  onClose,
}: {
  selection: ReaderWordSelection;
  bookId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<ReaderLookupResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [speechError, setSpeechError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    button.current?.focus({ preventScroll: true });
    window.speechSynthesis?.getVoices();
    const onOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !dialog.current?.contains(event.target)
      )
        onClose();
    };
    document.addEventListener("pointerdown", onOutside);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      mounted.current = false;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      window.speechSynthesis?.cancel();
    };
  }, [onClose]);

  useEffect(() => {
    if (opened) dialog.current?.focus({ preventScroll: true });
  }, [opened]);

  useEffect(() => {
    if (opened) return;
    window.addEventListener("blur", onClose);
    return () => window.removeEventListener("blur", onClose);
  }, [opened, onClose]);

  async function lookup() {
    if (loading || result) return;
    setOpened(true);
    setLoading(true);
    setError(false);
    try {
      const data = await readerApiService.lookupWord(bookId, {
        word: selection.word,
        location: selection.cfi,
        requestId: requestId.current,
      });
      if (mounted.current) setResult(data);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function pronounce() {
    setSpeechError(false);
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setSpeechError(true);
      return;
    }
    const voice = window.speechSynthesis
      .getVoices()
      .find(item => /^en[-_]/i.test(item.lang));
    if (!voice) {
      setSpeechError(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selection.word);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;
    utterance.onend = () => {
      if (mounted.current) setSpeaking(false);
    };
    utterance.onerror = () => {
      if (mounted.current) {
        setSpeaking(false);
        setSpeechError(true);
      }
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  const entry = result?.entry;
  return (
    <div
      className={"reader-dictionary " + (opened ? "is-open" : "")}
      ref={dialog}
      tabIndex={-1}
      onBlur={event => {
        if (!opened && !event.currentTarget.contains(event.relatedTarget))
          onClose();
      }}
      role="dialog"
      aria-label={t("reader.dictionaryTitle")}
      style={{
        left: Math.max(
          12,
          Math.min(selection.x, window.innerWidth - (opened ? 380 : 64)),
        ),
        top: Math.max(
          12,
          Math.min(selection.y, window.innerHeight - (opened ? 430 : 80)),
        ),
      }}
    >
      {opened && (
        <button
          className="reader-icon-button reader-dictionary-close"
          onClick={onClose}
          aria-label={t("reader.close")}
        >
          <FiX />
        </button>
      )}
      {!opened ? (
        <button
          ref={button}
          className="reader-icon-button reader-dictionary-action"
          aria-label={t("reader.lookupHebrew")}
          title={t("reader.lookupHebrew")}
          onClick={() => void lookup()}
        >
          <FiBookOpen aria-hidden="true" />
        </button>
      ) : (
        <>
          <div className="reader-dictionary-heading">
            <div>
              <small>{t("reader.dictionaryTitle")}</small>
              <h2 lang="en" dir="ltr">
                {selection.word}
              </h2>
              {entry && entry.headword !== entry.word && (
                <p lang="en" dir="ltr">
                  {entry.headword}
                </p>
              )}
            </div>
            <button
              className="reader-icon-button"
              onClick={pronounce}
              disabled={speaking}
              aria-label={t("reader.pronounce")}
              title={t("reader.pronounce")}
            >
              <FiVolume2 />
            </button>
          </div>
          {speechError && (
            <p role="status">{t("reader.pronunciationUnavailable")}</p>
          )}
          {loading && <p role="status">{t("reader.lookupLoading")}</p>}
          {error && (
            <div role="alert">
              <p>{t("reader.lookupError")}</p>
              <button className="reader-button" onClick={() => void lookup()}>
                {t("reader.retry")}
              </button>
            </div>
          )}
          {result && !entry && <p role="status">{t("reader.wordNotFound")}</p>}
          {entry && (
            <>
              <p
                className="reader-dictionary-meanings"
                lang={entry.kind === "translation" ? "he-x-mtfrom-en" : "he"}
                dir="rtl"
              >
                {entry.senses[0].meanings.join(" · ")}
              </p>
              {entry.kind === "translation" && (
                <p className="reader-dictionary-source">
                  {t("reader.automaticTranslation")}
                </p>
              )}
              {entry.kind !== "translation" && (
                <details>
                  <summary>{t("reader.dictionaryDetails")}</summary>
                  {entry.senses.map(sense => (
                    <section key={sense.id} className="reader-dictionary-sense">
                      <small>{t("reader.pos." + sense.partOfSpeech)}</small>
                      {!!sense.labels?.length && (
                        <p
                          className="reader-dictionary-labels"
                          lang="en"
                          dir="ltr"
                        >
                          {sense.labels.join(" · ")}
                        </p>
                      )}
                      <p lang="he" dir="rtl">
                        {sense.meanings.join(" · ")}
                      </p>
                      {sense.explanations.map((text, index) => (
                        <p key={index} lang="he" dir="rtl">
                          {text}
                        </p>
                      ))}
                      {sense.definition && (
                        <p lang="en" dir="ltr">
                          {sense.definition}
                        </p>
                      )}
                      {sense.sourceUrl && (
                        <a
                          className="reader-dictionary-source"
                          href={sense.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {sense.source}
                        </a>
                      )}
                      {sense.examples.map((text, index) => (
                        <blockquote key={index} lang="en" dir="ltr">
                          {text}
                        </blockquote>
                      ))}
                    </section>
                  ))}
                </details>
              )}
              <p className="reader-dictionary-saved" role="status">
                {t("reader.vocabularySaved", { count: result.lookupCount })}
              </p>
              <small className="reader-dictionary-source">
                {entry.kind === "translation" ? (
                  <a
                    className="reader-google-attribution"
                    href="https://translate.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      className="reader-google-badge-color"
                      src="/images/google-translate/color-regular.png"
                      alt="Powered by Google Translate"
                    />
                    <img
                      className="reader-google-badge-white"
                      src="/images/google-translate/white-regular.png"
                      alt="Powered by Google Translate"
                    />
                  </a>
                ) : entry.attribution ? (
                  <>
                    <a
                      href={entry.attribution.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {entry.attribution.name}
                    </a>
                    {" · "}
                    <a
                      href={entry.attribution.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {entry.attribution.license}
                    </a>
                  </>
                ) : (
                  entry.source
                )}
              </small>
            </>
          )}
        </>
      )}
    </div>
  );
}
