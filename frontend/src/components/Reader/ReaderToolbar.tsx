import { useRef, useState } from "react";
import { FiCornerDownRight } from "react-icons/fi";
import { ReaderGoToPage } from "./ReaderGoToPage";
import { ReaderToolbarMenu } from "./ReaderToolbarMenu";
import { ScanLineIcon } from "./ReaderSentenceMode";
import { LuFlag } from "react-icons/lu";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiVolume2,
  FiArrowLeft,
  FiX,
  FiBookOpen,
  FiEdit3,
  FiMaximize,
  FiMinimize,
  FiRefreshCw,
  FiSettings,
  FiSearch,
  FiMessageSquare,
  FiFileText,
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
> & { pageNavigation?: EpubReaderController["pageNavigation"]; book: ReaderBook; rsvp?: EpubReaderController["rsvp"]; sentenceMode?: EpubReaderController["sentenceMode"] };
export function ReaderToolbar({
  book,
  pageNavigation,
  rsvp,
  sentenceMode,
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
  const [goToPageOpen, setGoToPageOpen] = useState(false);
  const sentenceEntry = useRef<string | undefined>();
  if (sentenceMode?.active) return <header className="reader-toolbar reader-toolbar-sentence"><span><ScanLineIcon />Sentence Mode</span><span className="reader-toolbar-sentence-actions"><button className="reader-icon-button" aria-label="Close sentence mode" disabled={sentenceMode.busy} onClick={() => void sentenceMode.toggle()}><FiX /></button></span></header>;
  if (rsvp?.active)
    return (
      <header className="reader-toolbar reader-toolbar-rsvp">
        <span className="reader-rsvp-badge">RSVP</span>
        <div className="reader-toolbar-title">
          <h1>{rsvp.chapterTitle || book.title}</h1>
        </div>
        <button
          className="reader-icon-button"
          aria-label={t("reader.rsvp.exit")}
          title={t("reader.rsvp.exit")}
          disabled={rsvp.busy}
          onClick={() => void rsvp.toggle()}
        >
          <FiX aria-hidden="true" />
        </button>
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

          {mobile ? (
            <button className="reader-icon-button" onClick={reload} aria-label={t("reader.reload")} title={t("reader.reload")}><FiRefreshCw /></button>
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
          <ReaderToolbarMenu onBeforeOpen={() => { sentenceEntry.current = sentenceMode?.entryCfi(); }}>
            {pageNavigation && <button className="reader-icon-button" aria-label="Go to page" disabled={loading || !!error} onClick={() => setGoToPageOpen(true)}><FiCornerDownRight /><span>Go to page</span></button>}

          <button className={"reader-icon-button " + (panel === "review" ? "is-active" : "")}
            onClick={() => togglePanel("review")} aria-label={t("reader.review.title")}
            title={t("reader.review.title")} aria-expanded={panel === "review"}>
            <LuFlag aria-hidden="true" /><span>{t("reader.review.title")}</span>
          </button>
          <button className={"reader-icon-button " + (panel === "documents" ? "is-active" : "")}
            onClick={() => togglePanel("documents")} aria-label={t("reader.documents.title")}
            title={t("reader.documents.title")} aria-expanded={panel === "documents"}>
            <FiFileText aria-hidden="true" /><span>{t("reader.documents.title")}</span>
          </button>
            {sentenceMode && <button className="reader-icon-button" aria-label="Sentence Mode" title="Sentence Mode (Ctrl+S+M)" onPointerDown={event => event.stopPropagation()} disabled={loading || !!error || sentenceMode.busy} onClick={() => void sentenceMode.toggle(sentenceEntry.current)}><ScanLineIcon /><span>Sentence Mode</span></button>}
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
                <span>{t("reader.rsvp.mode")}</span>
              </button>
            )}
            <button className="reader-icon-button" aria-label="Audiobook Mode" title="Audiobook Mode" aria-expanded={panel === "tts"} disabled={loading || !!error} onClick={() => togglePanel("tts")}><FiVolume2 /><span>Audiobook Mode</span></button>
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
              <FiSettings /><span>{t("reader.settings")}</span>
            </button>
          </ReaderToolbarMenu>
        </>
      )}
      {goToPageOpen && pageNavigation && <ReaderGoToPage navigation={pageNavigation} onClose={() => setGoToPageOpen(false)} />}
    </header>
  );
}
