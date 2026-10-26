import { useTranslation } from "react-i18next";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
type Props = Pick<
  EpubReaderController,
  "mobile" | "saveStatus" | "retrySave" | "notice"
>;
export function ReaderNotices({
  mobile,
  saveStatus,
  retrySave,
  notice,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      {mobile && saveStatus === "error" && (
        <p className="reader-notice" role="status">
          <button
            className="reader-save-retry"
            onClick={() => void retrySave()}
          >
            {t("reader.saveError")}
          </button>
        </p>
      )}
      {notice && (
        <p className="reader-notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
