import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ReaderAccess } from "../../components/Reader/ReaderAccess";
import { EpubReader } from "../../components/Reader/EpubReader";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import readerApiService from "../../services/readerApiService";
import "../../styles/app/_reader.scss";

function ReaderDetailsContent() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { loggedInUser } = useLoginWithToken();
  const book = useQuery({
    queryKey: ["readerBook", loggedInUser?.id, id],
    queryFn: () => readerApiService.getById(id),
    retry: false,
    refetchOnWindowFocus: false,
  });
  useDocumentTitle("Roza / " + (book.data?.title || "Reader"));
  if (book.isLoading)
    return (
      <p className="reader-message" role="status">
        {t("reader.loading")}
      </p>
    );
  if (book.isError || !book.data || !loggedInUser)
    return (
      <div className="reader-message" role="alert">
        <p>{t("reader.openError")}</p>
        <Link className="reader-button" to="/reader">
          {t("reader.back")}
        </Link>
        <button className="reader-button" onClick={() => void book.refetch()}>
          {t("reader.retry")}
        </button>
      </div>
    );
  return (
    <EpubReader key={loggedInUser.id + ":" + book.data.id} book={book.data} userId={loggedInUser.id} />
  );
}

export default function ReaderDetails() {
  return (
    <main className="reader-details">
      <ReaderAccess>
        <ReaderDetailsContent />
      </ReaderAccess>
    </main>
  );
}
