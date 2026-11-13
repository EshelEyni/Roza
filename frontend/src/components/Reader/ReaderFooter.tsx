import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { ReaderProgress } from "./ReaderProgress";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
type Props = Pick<
  EpubReaderController,
  | "state"
  | "locationsReady"
  | "loading"
  | "onProgressNavigate"
  | "move"
  | "atStart"
  | "atEnd"
  | "chapter"
  | "showPublisherPages"
  | "pageLabel"
  | "togglePageNumbering"
  | "saveStatus"
  | "retrySave"
> & { remainingSectionPages?: number | null; remainingBookPages?: number | null; getProgressDestination?: (progress: number) => Promise<string | null>; returnPoint?: {label:string} | null; goBack?: () => Promise<void> };
export function ReaderFooter({
  state,
  remainingSectionPages,
  remainingBookPages,
  locationsReady,
  loading,
  onProgressNavigate,
  getProgressDestination, returnPoint, goBack,
  move,
  atStart,
  atEnd,
  chapter,
  showPublisherPages,
  pageLabel,
  togglePageNumbering,
  saveStatus,
  retrySave,
}: Props) {
  const { t } = useTranslation();
  const [remainingMode, setRemainingMode] = useState(0);
  const indicator = remainingMode === 0
    ? Math.round(state.progress * 100) + "%"
    : remainingMode === 1
      ? (remainingSectionPages == null ? t("reader.countingPages") : t("reader.sectionPagesRemaining", { count: remainingSectionPages }))
      : (remainingBookPages == null ? t("reader.countingPages") : t("reader.bookPagesRemaining", { count: remainingBookPages }));
  const toggleRemaining = () => setRemainingMode(mode => (mode + 1) % 3);
  return (
    <footer className="reader-footer">
      <div className="reader-mobile-progress">
        <button type="button" className="reader-reading-remaining" onClick={toggleRemaining} title={t("reader.toggleRemainingPages")}>{indicator}</button>
        <ReaderProgress
          progress={state.progress}
          ready={locationsReady && !loading}
          onNavigate={onProgressNavigate}
          getDestination={getProgressDestination}
        />
        <span>{pageLabel}</span>
      </div>
      <button
        className="reader-icon-button"
        data-reader-page-turn
        onPointerDown={event => event.preventDefault()}
        onClick={() => move("prev")}
        disabled={loading || atStart}
        aria-label={t("reader.previous")}
        title={t("reader.previous")}
      >
        <FiArrowLeft />
      </button>
      {returnPoint && goBack && <button type="button" className="reader-return-button" disabled={loading}
        onClick={() => void goBack()} aria-label={t("reader.goBackPage",{page:returnPoint.label})}>
        <span>{t("reader.goBackTo")}</span>
        <span>{t("reader.goBackPageLine",{page:returnPoint.label})}</span>
      </button>}
      <div className="reader-footer-center">
        <p>{chapter || t("reader.reading")}</p>
        <ReaderProgress
          progress={state.progress}
          ready={locationsReady && !loading}
          onNavigate={onProgressNavigate}
          getDestination={getProgressDestination}
        />
        <div className="reader-footer-indicators">
          <button
            className="reader-page-count reader-page-count-toggle"
            type="button"
            aria-pressed={showPublisherPages}
            title={t(
              showPublisherPages
                ? "reader.showScreenPages"
                : "reader.showBookPages",
            )}
            aria-label={t(
              showPublisherPages
                ? "reader.showScreenPages"
                : "reader.showBookPages",
            )}
            onClick={togglePageNumbering}
          >
            {pageLabel}
          </button>
          <span>
            {saveStatus === "error" ? (
              <button
                className="reader-save-retry"
                onClick={() => void retrySave()}
              >
                {t("reader.saveError")}
              </button>
            ) : (
              t(saveStatus === "saving" ? "reader.saving" : "reader.saved")
            )}
          </span>
          <button type="button" className="reader-percent reader-reading-remaining" onClick={toggleRemaining} title={t("reader.toggleRemainingPages")}>{indicator}</button>
        </div>
      </div>
      <button
        className="reader-icon-button"
        data-reader-page-turn
        onPointerDown={event => event.preventDefault()}
        onClick={() => move("next")}
        disabled={loading || atEnd}
        aria-label={t("reader.next")}
        title={t("reader.next")}
      >
        <FiArrowRight />
      </button>
    </footer>
  );
}
