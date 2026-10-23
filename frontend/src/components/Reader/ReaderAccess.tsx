import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useGetReaderAccess } from "../../hooks/reactQuery/get/useGetReaderAccess";

export function ReaderAccess({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const access = useGetReaderAccess();
  if (access.isLoading)
    return (
      <p className="reader-message" role="status">
        {t("reader.loading")}
      </p>
    );
  if (access.isError)
    return (
      <div className="reader-message" role="alert">
        <p>{t("reader.accessError")}</p>
        <button className="reader-button" onClick={() => void access.refetch()}>
          {t("reader.retry")}
        </button>
      </div>
    );
  if (!access.data?.enabled)
    return <p className="reader-message">{t("reader.unavailable")}</p>;
  return <>{children}</>;
}
