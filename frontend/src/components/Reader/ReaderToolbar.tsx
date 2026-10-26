import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiBookOpen,
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
> & { book: ReaderBook };
export function ReaderToolbar({
  book,
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
      <button
        className={
          "reader-icon-button " + (panel === "settings" ? "is-active" : "")
        }
        onClick={() => togglePanel("settings")}
        aria-label={t("reader.settings")}
        aria-expanded={panel === "settings"}
        title={t("reader.settings")}
      >
        <FiSettings />
      </button>
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
    </header>
  );
}
