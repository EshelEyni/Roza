import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiBookOpen,
  FiEdit3,
  FiGlobe,
  FiMessageSquare,
  FiVolume2,
  FiX,
  FiCopy,
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
  autoLookup = false,
  onAnnotate,
  annotationBusy,
  onCopyFeedback,
  selection,
  bookId,
  getLookupPage,
  onClose: closePopup,
  onTranslationDismiss,
  onAskAi,
  aiDisabled = false,
  extending,
  busy,
}: {
  autoLookup?: boolean;
  onAnnotate?: (note: boolean) => void;
  annotationBusy?: boolean;
  onCopyFeedback?: (message: string) => void;
  selection: ReaderTextSelection;
  bookId: string;
  getLookupPage: (cfi: string) => Promise<string>;
  onClose: () => void;
  onTranslationDismiss?: (selection: ReaderTextSelection) => void;
  onAskAi: (autoSubmit?: boolean) => void;
  aiDisabled?: boolean;
  extending: boolean;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const mobile = useReaderMobile();
  const [opened, setOpened] = useState(false);
  const [lookups, setLookups] = useState<Partial<Record<ReaderLookupProvider, { result?: ReaderLookupResult; loading?: boolean; error?: boolean }>>>({});
  const pending = useRef(new Set<ReaderLookupProvider>());
  const [lookupProvider, setLookupProvider] =
    useState<ReaderLookupProvider>("auto");
  const { result, loading, error } = lookups[lookupProvider] || {};
  const [speechError, setSpeechError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const requestId = useRef<Partial<Record<ReaderLookupProvider, string>>>({});
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

  useEffect(() => {
    mounted.current = true;
    window.speechSynthesis?.getVoices();
    const onOutside = (event: PointerEvent) => {
      if (
        !(mobile && opened) &&
        event.target instanceof Node &&
        !dialog.current?.contains(event.target) &&
        !(event.target instanceof Element && event.target.closest("[data-reader-page-turn]"))
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
    if (pending.current.has(provider) || !selection.word) return;
    pending.current.add(provider);
    if (!retry || !requestId.current[provider]) requestId.current[provider] = createRequestId();
    setLookupProvider(provider);
    translated.current = true;
    setOpened(true);
    setLookups(current => ({ ...current, [provider]: { ...current[provider], loading: true, error: false } }));
    try {
      const signal = AbortSignal.timeout(15000);
      const pageLocation = await Promise.race([
        getLookupPage(selection.cfi),
        new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("Lookup timed out")), { once: true })),
      ]);
      const data = await readerApiService.lookupWord(bookId, {
        word: selection.word,
        location: selection.cfi,
        pageLocation,
        requestId: requestId.current[provider]!,
        provider,
      }, signal);
      if (mounted.current) setLookups(current => ({ ...current, [provider]: { result: data } }));
    } catch {
      if (mounted.current) setLookups(current => ({ ...current, [provider]: { ...current[provider], error: true } }));
    } finally {
      pending.current.delete(provider);
      if (mounted.current) setLookups(current => ({ ...current, [provider]: { ...current[provider], loading: false } }));
    }
  }

  const keyboardLookup = useRef(lookup);
  keyboardLookup.current = lookup;
  useEffect(() => {
    if ((autoLookup || selection.lookupRequest) && selection.word) void keyboardLookup.current();
  }, [autoLookup, selection.lookupRequest, selection.cfi, selection.word]);

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
      onCopyFeedback?.(t("reader.selectionCopied"));
    } catch {
      onCopyFeedback?.(t("reader.selectionCopyError"));
    }
  }
  const actionCount = 2 + (selection.word ? 1 : 0) + (onAnnotate ? 1 : 0);
  // Match the icon widths, gaps, 6px padding, and 1px border on each side.
  const actionWidth = actionCount * (mobile ? 44 : 38) +
    (actionCount - 1) * (mobile ? 4 : 2) + 14;
  // CSS viewport units keep these bounds current when the window is resized.
  const popupWidth = opened ? 360 : actionWidth;
  const popupTop = `clamp(12px, ${selection.y}px, max(12px, calc(100dvh - ${opened ? 442 : 152}px)))`;
  const [mobilePosition, setMobilePosition] = useState<{
    left: number; top: number; width: number; maxHeight: number; visibility: "visible" | "hidden";
  }>();
  useEffect(() => {
    if (!mobile || opened) return;
    const viewport = window.visualViewport;
    let request = 0;
    const update = () => {
      const element = dialog.current;
      if (!element) return;
      const left = viewport?.offsetLeft || 0;
      const top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const popupWidth = Math.min(actionWidth, Math.max(0, width - 24));
      const maxHeight = Math.max(0, height - 24);
      // Dock in the reader footer instead of following Safari's selection menu.
      setMobilePosition({
        width: popupWidth,
        left: left + (width - popupWidth) / 2,
        top: Math.max(top + 12, top + height - Math.min(element.scrollHeight + 2, maxHeight) -
          (document.querySelector(".reader-footer")?.getBoundingClientRect().height || 0) - 8),
        maxHeight,
        visibility: "visible",
      });
    };
    const schedule = () => {
      cancelAnimationFrame(request);
      request = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    if (dialog.current) observer.observe(dialog.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
  }, [mobile, opened, actionWidth]);
  const content = (
    <div
      className={"reader-dictionary " + (opened ? "is-open" : mobile ? "reader-selection-docked" : "")}
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
          !event.currentTarget.contains(event.relatedTarget) &&
          !(event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-reader-page-turn]"))
        )
          onClose();
      }}
      role="dialog"
      aria-label={t(
        opened ? "reader.dictionaryTitle" : "reader.chat.selectionActions",
      )}
      style={mobile && opened ? undefined : mobile ? (mobilePosition || { visibility: "hidden" }) : {
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
          <div className={"reader-dictionary-actions" + (onAnnotate ? " reader-dictionary-icon-row" : "")} aria-busy={busy}>
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
            {onAnnotate && <>
              <button className="reader-icon-button reader-selection-annotate" disabled={busy || annotationBusy}
                onClick={() => onAnnotate(true)} aria-label={t("reader.annotations.addNote")}
                title={t("reader.annotations.addNote")}>
                <FiEdit3 aria-hidden="true" />
              </button>
            </>}
            <button
              className="reader-icon-button reader-selection-copy"
              disabled={busy}
              onClick={() => void copy()}
              aria-label={t("reader.selectionCopy")}
              title={t("reader.selectionCopy")}
            >
              <FiCopy aria-hidden="true" />
            </button>
          </div>
          {extending && (
            <p className="reader-selection-help">
              {t("reader.selectionExtendHelp")}
            </p>
          )}

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
            {(Object.keys({ auto: true, google: true }) as ReaderLookupProvider[]).map(provider => (
              <button
                type="button"
                className="reader-button reader-dictionary-lookup-action"
                key={provider}
                aria-pressed={provider === (entry?.kind === "translation" ? "google" : lookupProvider)}
                aria-busy={lookups[provider]?.loading}
                onClick={() => {
                  setLookupProvider(provider);
                  if (!lookups[provider]) void lookup(provider);
                }}
              >
                {provider === "google" ? <FiGlobe aria-hidden="true" /> : <FiBookOpen aria-hidden="true" />}
                {t(provider === "google" ? "reader.googleButton" : "reader.localButton")}
              </button>
            ))}
            <button
              type="button"
              className="reader-button reader-dictionary-lookup-action reader-dictionary-ai-action"
              disabled={aiDisabled}
              onClick={() => onAskAi(true)}
            >
              <FiMessageSquare aria-hidden="true" />
              {t("reader.aiButton")}
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
                {result.lookupCount !== undefined ? t("reader.vocabularySaved", { count: result.lookupCount }) : t("reader.vocabularySaveError")}
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
