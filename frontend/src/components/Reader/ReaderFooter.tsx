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
>;
export function ReaderFooter({
  state,
  locationsReady,
  loading,
  onProgressNavigate,
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
  return (
    <footer className="reader-footer">
      <div className="reader-mobile-progress">
        <span>{Math.round(state.progress * 100)}%</span>
        <ReaderProgress
          progress={state.progress}
          ready={locationsReady && !loading}
          onNavigate={onProgressNavigate}
        />
        <span>{pageLabel}</span>
      </div>
      <button
        className="reader-icon-button"
        onClick={() => move("prev")}
        disabled={loading || atStart}
        aria-label={t("reader.previous")}
        title={t("reader.previous")}
      >
        <FiArrowLeft />
      </button>
      <div className="reader-footer-center">
        <p>{chapter || t("reader.reading")}</p>
        <ReaderProgress
          progress={state.progress}
          ready={locationsReady && !loading}
          onNavigate={onProgressNavigate}
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
          <span className="reader-percent">
            {Math.round(state.progress * 100)}%
          </span>
        </div>
      </div>
      <button
        className="reader-icon-button"
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
