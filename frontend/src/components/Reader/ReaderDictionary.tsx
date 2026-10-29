import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiBookOpen,
  FiGlobe,
  FiMessageSquare,
  FiVolume2,
  FiX,
  FiCopy,
  FiArrowLeft,
  FiArrowRight,
} from "react-icons/fi";
import { ReaderSheet } from "./ReaderSheet";
import { useReaderMobile } from "../../hooks/useReaderMobile";
import {
  ReaderLookupProvider,
  ReaderLookupResult,
} from "../../../../shared/types/readerDictionary";
import readerApiService from "../../services/readerApiService";
import { createRequestId } from "../../services/createRequestId";

export type { ReaderTextSelection } from "../../types/reader";
import type { ReaderTextSelection } from "../../types/reader";

export function ReaderDictionary({
  selection,
  bookId,
  onClose: closePopup,
  onTranslationDismiss,
  onAskAi,
  aiDisabled = false,
  onExtend,
  extending,
  busy,
  atStart,
  atEnd,
}: {
  selection: ReaderTextSelection;
  bookId: string;
  onClose: () => void;
  onTranslationDismiss?: (selection: ReaderTextSelection) => void;
  onAskAi: (autoSubmit?: boolean) => void;
  aiDisabled?: boolean;
  onExtend: (direction: "next" | "prev") => Promise<void>;
  extending: boolean;
  busy: boolean;
  atStart: boolean;
  atEnd: boolean;
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
  const [copyStatus, setCopyStatus] = useState("");
  const requestId = useRef(createRequestId());
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const lastSelection = useRef(selection);
  lastSelection.current = selection;
  const translated = useRef(false);
  const dismissal = useRef(onTranslationDismiss);
  dismissal.current = onTranslationDismiss;
  useEffect(() => () => {
    if (translated.current) {
      translated.current = false;
      dismissal.current?.(lastSelection.current);
    }
  }, []);
  const onClose = useCallback(() => {
    const mark = translated.current;
    translated.current = false;
    closePopup();
    if (mark) onTranslationDismiss?.(lastSelection.current);
  }, [closePopup, onTranslationDismiss]);
  useEffect(() => setCopyStatus(""), [selection.text]);

  useEffect(() => {
    mounted.current = true;
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
    translated.current = true;
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
  async function copy() {
    try {
      await navigator.clipboard.writeText(selection.text);
      setCopyStatus(t("reader.selectionCopied"));
    } catch {
      setCopyStatus(t("reader.selectionCopyError"));
    }
  }
  const actionWidth = selection.word
    ? mobile
      ? 320
      : 272
    : mobile
      ? 268
      : 228;
  // CSS viewport units keep these bounds current when the window is resized.
  const popupWidth = opened ? 360 : actionWidth;
  const popupTop = `clamp(12px, ${selection.y}px, max(12px, calc(100dvh - ${opened ? 442 : 152}px)))`;
  const content = (
    <div
      className={"reader-dictionary " + (opened ? "is-open" : "")}
      ref={dialog}
      tabIndex={-1}
      onPointerDown={event => {
        // Keep the iframe's native range while activating a selection action.
        if (!opened) event.preventDefault();
      }}
      onBlur={event => {
        if (
          !mobile &&
          !opened &&
          !extending &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          onClose();
      }}
      role="dialog"
      aria-label={t(
        opened ? "reader.dictionaryTitle" : "reader.chat.selectionActions",
      )}
      style={mobile && opened ? undefined : {
        width: popupWidth,
        left: `clamp(12px, ${selection.x}px, max(12px, calc(100dvw - ${popupWidth + 12}px)))`,
        top: popupTop,
        maxHeight: `min(520px, calc(100dvh - ${popupTop} - 12px))`,
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
        <>
          <div className="reader-dictionary-actions" aria-busy={busy}>
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
              onClick={() => onAskAi()}
            >
              <FiMessageSquare aria-hidden="true" />
            </button>
            <button
              className="reader-icon-button"
              disabled={busy}
              onClick={() => void copy()}
              aria-label={t("reader.selectionCopy")}
              title={t("reader.selectionCopy")}
            >
              <FiCopy aria-hidden="true" />
            </button>
            <button
              className="reader-icon-button"
              disabled={busy || atStart}
              onClick={() => void onExtend("prev")}
              aria-label={t("reader.selectionPrevious")}
              title={t("reader.selectionPrevious")}
            >
              <FiArrowLeft aria-hidden="true" />
            </button>
            <button
              className="reader-icon-button"
              disabled={busy || atEnd}
              onClick={() => void onExtend("next")}
              aria-label={t("reader.selectionNext")}
              title={t("reader.selectionNext")}
            >
              <FiArrowRight aria-hidden="true" />
            </button>
            <button
              className="reader-icon-button"
              onClick={onClose}
              aria-label={t("reader.close")}
              title={t("reader.close")}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
          {extending && (
            <p className="reader-selection-help">
              {t("reader.selectionExtendHelp")}
            </p>
          )}
          {copyStatus && <p role="status">{copyStatus}</p>}
        </>
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
          <div className="reader-dictionary-lookup-actions">
            {result && entry?.kind !== "translation" && (
              <button
                type="button"
                className="reader-button reader-dictionary-lookup-action"
                disabled={loading}
                onClick={() => void lookup("google")}
              >
                <FiGlobe aria-hidden="true" />
                {t("reader.translateWithGoogle")}
              </button>
            )}
            <button
              type="button"
              className="reader-button reader-dictionary-lookup-action"
              disabled={aiDisabled}
              onClick={() => onAskAi(true)}
            >
              <FiMessageSquare aria-hidden="true" />
              {t("reader.chat.ask")}
            </button>
          </div>
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
