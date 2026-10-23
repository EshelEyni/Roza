import { useTranslation } from "react-i18next";
import { GiBookshelf } from "react-icons/gi";
import { ReaderAccess } from "../../components/Reader/ReaderAccess";
import { ReaderBookPreview } from "../../components/Reader/ReaderBookPreview";
import { ReaderUpload } from "../../components/Reader/ReaderUpload";
import { useGetReaderBooks } from "../../hooks/reactQuery/get/useGetReaderBooks";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "../../styles/app/_reader.scss";

function ReaderLibrary() {
  const { t } = useTranslation();
  const books = useGetReaderBooks(true);
  return (
    <>
      <div className="reader-library-heading">
        <div>
          <p className="reader-eyebrow">{t("reader.eyebrow")}</p>
          <h1>{t("reader.library")}</h1>
          <p>{t("reader.subtitle")}</p>
        </div>
        <ReaderUpload />
      </div>
      {books.isLoading && (
        <p className="reader-message" role="status">
          {t("reader.loading")}
        </p>
      )}
      {books.isError && (
        <div className="reader-message" role="alert">
          <p>{t("reader.libraryError")}</p>
          <button
            className="reader-button"
            onClick={() => void books.refetch()}
          >
            {t("reader.retry")}
          </button>
        </div>
      )}
      {books.isSuccess && !books.data.length && (
        <div className="reader-empty">
          <GiBookshelf aria-hidden="true" />
          <h2>{t("reader.emptyTitle")}</h2>
          <p>{t("reader.emptyDescription")}</p>
        </div>
      )}
      {!!books.data?.length && (
        <div className="reader-library-meta">
          {t("reader.bookCount", { count: books.data.length })}
        </div>
      )}
      <div className="reader-book-grid">
        {books.data?.map(book => (
          <ReaderBookPreview key={book.id} book={book} />
        ))}
      </div>
    </>
  );
}

export default function ReaderPage() {
  useDocumentTitle("Roza / Reader");
  return (
    <main className="reader-library">
      <ReaderAccess>
        <ReaderLibrary />
      </ReaderAccess>
    </main>
  );
}
