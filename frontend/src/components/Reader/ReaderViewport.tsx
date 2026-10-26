import { useTranslation } from "react-i18next";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import type { ReaderPreferences } from "../../../../shared/types/reader";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
type Props = Pick<
  EpubReaderController,
  "loading" | "error" | "retry" | "move" | "atStart" | "atEnd" | "host"
> & { width: ReaderPreferences["width"] };
export function ReaderViewport({
  width,
  loading,
  error,
  retry,
  move,
  atStart,
  atEnd,
  host,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className={"reader-paper reader-width-" + width}>
      {loading && (
        <div className="reader-overlay" role="status">
          {t("reader.opening")}
        </div>
      )}
      {error && (
        <div className="reader-overlay reader-error" role="alert">
          <p>{error}</p>
          <button className="reader-button" onClick={retry}>
            {t("reader.retry")}
          </button>
        </div>
      )}
      <div
        className={
          "reader-page-turn-area" +
          (loading || !!error || atStart ? " is-disabled" : "")
        }
        onClick={() => {
          if (!loading && !error && !atStart) move("prev");
        }}
      >
        <button
          className="reader-page-turn reader-page-turn-previous"
          disabled={loading || !!error || atStart}
          aria-label={t("reader.previous")}
          title={t("reader.previous")}
        >
          <FiChevronLeft aria-hidden="true" />
        </button>
      </div>
      <div className="reader-viewport" ref={host} dir="ltr" />
      <div
        className={
          "reader-page-turn-area" +
          (loading || !!error || atEnd ? " is-disabled" : "")
        }
        onClick={() => {
          if (!loading && !error && !atEnd) move("next");
        }}
      >
        <button
          className="reader-page-turn reader-page-turn-next"
          disabled={loading || !!error || atEnd}
          aria-label={t("reader.next")}
          title={t("reader.next")}
        >
          <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
