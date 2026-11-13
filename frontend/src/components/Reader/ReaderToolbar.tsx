import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiBookOpen,
  FiEdit3,
  FiMaximize,
  FiMinimize,
  FiRefreshCw,
  FiSettings,
  FiSearch,
  FiMessageSquare,
} from "react-icons/fi";
import type { ReaderBook } from "../../../../shared/types/reader";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
type Props = Pick<
  EpubReaderController,
  | "panel"
  | "togglePanel"
  | "loading"
  | "error"
  | "mobile"
  | "fullscreen"
  | "toggleFullscreen"
  | "reload"
> & { book: ReaderBook; rsvp?: EpubReaderController["rsvp"] };
export function ReaderToolbar({
  book,
  rsvp,
  panel,
  togglePanel,
  loading,
  error,
  mobile,
  fullscreen,
  toggleFullscreen,
  reload,
}: Props) {
  const { t } = useTranslation();
  if (rsvp?.active)
    return (
      <header className="reader-toolbar reader-toolbar-rsvp">
        <button
          className="reader-icon-button"
          aria-label={t("reader.rsvp.exit")}
          disabled={rsvp.busy}
          onClick={() => void rsvp.toggle()}
        >
          <FiArrowLeft />
        </button>
        <div className="reader-toolbar-title">
          <h1>{book.title}</h1>
        </div>
        <span className="reader-rsvp-badge">RSVP</span>
      </header>
    );
  return (
    <header className="reader-toolbar">
      <Link
        className="reader-icon-button"
        to="/reader"
        aria-label={t("reader.back")}
        title={t("reader.back")}
      >
        <FiArrowLeft />
      </Link>
      <div className="reader-toolbar-title">
        <h1>{book.title}</h1>
        <p>{book.author || t("reader.unknownAuthor")}</p>
      </div>
      {!rsvp?.active && (
        <>
          <button
            className={
              "reader-icon-button " +
              (panel === "annotations" ? "is-active" : "")
            }
            onClick={() => togglePanel("annotations")}
            aria-label={t("reader.annotations.title")}
            title={t("reader.annotations.title")}
            aria-expanded={panel === "annotations"}
          >
            <FiEdit3 />
          </button>
          <button
            className={
              "reader-icon-button " + (panel === "chat" ? "is-active" : "")
            }
            onClick={() => togglePanel("chat")}
            aria-label={t("reader.chat.title")}
            aria-expanded={panel === "chat"}
            title={t("reader.chat.title")}
            disabled={loading || !!error}
          >
            <FiMessageSquare />
          </button>
          <button
            className={
              "reader-icon-button " + (panel === "search" ? "is-active" : "")
            }
            onClick={() => togglePanel("search")}
            aria-label={t("reader.search")}
            aria-expanded={panel === "search"}
            title={t("reader.search")}
          >
            <FiSearch />
          </button>
          <button
            className={
              "reader-icon-button " + (panel === "contents" ? "is-active" : "")
            }
            onClick={() => togglePanel("contents")}
            aria-label={t("reader.contents")}
            aria-expanded={panel === "contents"}
            title={t("reader.contents")}
          >
            <FiBookOpen />
          </button>
          <div className="reader-mode-controls">
            {rsvp && (
              <button
                className="reader-icon-button"
                aria-label={t("reader.rsvp.mode")}
                title={t("reader.rsvp.mode")}
                aria-pressed={rsvp.active}
                disabled={loading || rsvp.busy}
                onClick={() => void rsvp.toggle()}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 3H6a3 3 0 0 0-3 3v2m13-5h2a3 3 0 0 1 3 3v2M3 16v2a3 3 0 0 0 3 3h2m13-5v2a3 3 0 0 1-3 3h-2M8 8h8M8 12h5M8 16h8" />
                </svg>
              </button>
            )}
            <button
              className={
                "reader-icon-button " +
                (panel === "settings" ? "is-active" : "")
              }
              onClick={() => togglePanel("settings")}
              aria-label={t("reader.settings")}
              aria-expanded={panel === "settings"}
              title={t("reader.settings")}
            >
              <FiSettings />
            </button>
          </div>
          {mobile ? (
            <button
              className="reader-icon-button"
              onClick={reload}
              aria-label={t("reader.reload")}
              title={t("reader.reload")}
            >
              <FiRefreshCw />
            </button>
          ) : (
            <button
              className="reader-icon-button"
              onClick={() => void toggleFullscreen()}
              aria-label={t("reader.fullscreen")}
              title={t("reader.fullscreen")}
              aria-pressed={fullscreen}
            >
              {fullscreen ? <FiMinimize /> : <FiMaximize />}
            </button>
          )}
        </>
      )}
    </header>
  );
}
