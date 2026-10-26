import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiBookOpen,
  FiGlobe,
  FiMessageSquare,
  FiVolume2,
  FiX,
} from "react-icons/fi";
import { ReaderSheet } from "./ReaderSheet";
import { useReaderMobile } from "../../hooks/useReaderMobile";
import {
  ReaderLookupProvider,
  ReaderLookupResult,
} from "../../../../shared/types/readerDictionary";
import readerApiService from "../../services/readerApiService";
import { createRequestId } from "../../services/createRequestId";

export interface ReaderTextSelection {
  text: string;
  word?: string;
  cfi: string;
  x: number;
  y: number;
}

export function ReaderDictionary({
  selection,
  bookId,
  onClose,
  onAskAi,
  aiDisabled = false,
}: {
  selection: ReaderTextSelection;
  bookId: string;
  onClose: () => void;
  onAskAi: () => void;
  aiDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const mobile = useReaderMobile();
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<ReaderLookupResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lookupProvider, setLookupProvider] =
    useState<ReaderLookupProvider>("auto");
  const [speechError, setSpeechError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const requestId = useRef(createRequestId());
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!mobile) button.current?.focus({ preventScroll: true });
    window.speechSynthesis?.getVoices();
    const onOutside = (event: PointerEvent) => {
      if (
        !(mobile && opened) &&
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
  }, [onClose, mobile, opened]);

  useEffect(() => {
    if (opened && !mobile) dialog.current?.focus({ preventScroll: true });
  }, [opened, mobile]);

  useEffect(() => {
    if (opened || mobile) return;
    window.addEventListener("blur", onClose);
    return () => window.removeEventListener("blur", onClose);
  }, [opened, onClose, mobile]);

  async function lookup(
    provider: ReaderLookupProvider = "auto",
    retry = false,
  ) {
    if (loading || !selection.word) return;
    if (!retry) requestId.current = createRequestId();
    setLookupProvider(provider);
    setOpened(true);
    setLoading(true);
    setError(false);
    try {
      const data = await readerApiService.lookupWord(bookId, {
        word: selection.word,
        location: selection.cfi,
        requestId: requestId.current,
        provider,
      });
      if (mounted.current) setResult(data);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function pronounce() {
    if (!selection.word) return;
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
  const actionWidth = selection.word ? (mobile ? 108 : 92) : mobile ? 60 : 52;
  const content = (
    <div
      className={"reader-dictionary " + (opened ? "is-open" : "")}
      ref={dialog}
      tabIndex={-1}
      onBlur={event => {
        if (
          !mobile &&
          !opened &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          onClose();
      }}
      role="dialog"
      aria-label={t(
        opened ? "reader.dictionaryTitle" : "reader.chat.selectionActions",
      )}
      style={{
        width: opened ? undefined : actionWidth,
        left: Math.max(
          12,
          Math.min(
            selection.x,
            window.innerWidth - (opened ? 380 : actionWidth + 12),
          ),
        ),
        top: Math.max(
          12,
          Math.min(selection.y, window.innerHeight - (opened ? 430 : 80)),
        ),
      }}
    >
      {opened && !mobile && (
        <button
          className="reader-icon-button reader-dictionary-close"
          onClick={onClose}
          aria-label={t("reader.close")}
        >
          <FiX />
        </button>
      )}
      {!opened ? (
        <div className="reader-dictionary-actions">
          {selection.word && (
            <button
              ref={button}
              className="reader-icon-button reader-dictionary-action"
              aria-label={t("reader.lookupHebrew")}
              title={t("reader.lookupHebrew")}
              onClick={() => void lookup()}
            >
              <FiBookOpen aria-hidden="true" />
            </button>
          )}
          <button
            ref={selection.word ? undefined : button}
            className="reader-icon-button reader-dictionary-action"
            aria-label={t("reader.chat.ask")}
            title={t("reader.chat.ask")}
            disabled={aiDisabled}
            onClick={onAskAi}
          >
            <FiMessageSquare aria-hidden="true" />
          </button>
        </div>
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
          {result && entry?.kind !== "translation" && (
            <button
              type="button"
              className="reader-button reader-google-lookup"
              disabled={loading}
              onClick={() => void lookup("google")}
            >
              <FiGlobe aria-hidden="true" />
              {t("reader.translateWithGoogle")}
            </button>
          )}
          {loading && <p role="status">{t("reader.lookupLoading")}</p>}
          {error && (
            <div role="alert">
              <p>
                {t(
                  lookupProvider === "google"
                    ? "reader.googleLookupError"
                    : "reader.lookupError",
                )}
              </p>
              <button
                className="reader-button"
                onClick={() => void lookup(lookupProvider, true)}
              >
                {t("reader.retry")}
              </button>
            </div>
          )}
          {result && !entry && (
            <p role="status">
              {t(
                lookupProvider === "google"
                  ? "reader.googleWordNotFound"
                  : "reader.wordNotFound",
              )}
            </p>
          )}
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
  return mobile && opened ? (
    <ReaderSheet
      className="reader-dictionary-sheet"
      label={t("reader.dictionaryTitle")}
      onClose={onClose}
    >
      {content}
    </ReaderSheet>
  ) : (
    content
  );
}
