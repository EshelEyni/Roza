import { useTranslation } from "react-i18next";
import { GiBookshelf } from "react-icons/gi";
import { ReaderAccess } from "../../components/Reader/ReaderAccess";
import { ReaderBookGrid } from "../../components/Reader/ReaderBookGrid";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import readerApiService from "../../services/readerApiService";
import type { ReaderBook } from "../../../../shared/types/reader";
import { ReaderUpload } from "../../components/Reader/ReaderUpload";
import { useGetReaderBooks } from "../../hooks/reactQuery/get/useGetReaderBooks";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "../../styles/app/_reader.scss";

function ReaderLibrary() {
  const { t } = useTranslation();
  const [archived, setArchived] = useState(false);
  const books = useGetReaderBooks(true, archived);
  const loadedBooks = Array.from(new Map(
    books.data?.pages.flatMap(page => page.books).map(book => [book.id, book]) || [],
  ).values());
  const client = useQueryClient();
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => readerApiService.setArchived(id, archived),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["readerBooks"] });
    },
  });
  const onArchive = (book: ReaderBook) => archive.mutate({ id: book.id, archived: !archived });
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
      <button type="button" className="reader-button reader-library-archive-toggle"
        aria-pressed={archived} onClick={() => { setArchived(value => !value); archive.reset(); }}>
        {t(archived ? "reader.activeBooks" : "reader.archivedBooks")}
      </button>
      {archive.isError && <p className="reader-message" role="alert">{t("reader.archiveError")}</p>}
      {books.isLoading && (
        <p className="reader-message" role="status">
          {t("reader.loading")}
        </p>
      )}
      {books.isError && !books.isFetchNextPageError && (
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
      {books.isSuccess && !loadedBooks.length && (
        <div className="reader-empty">
          <GiBookshelf aria-hidden="true" />
          <h2>{t(archived ? "reader.archiveEmpty" : "reader.emptyTitle")}</h2>
          {!archived && <p>{t("reader.emptyDescription")}</p>}
        </div>
      )}
      {!!loadedBooks.length && (
        <div className="reader-library-meta">
          {t("reader.bookCount", { count: loadedBooks.length })}
        </div>
      )}
      <ReaderBookGrid books={loadedBooks} archived={archived} pending={archive.isPending} onArchive={onArchive} />
      {books.isFetchNextPageError && <p className="reader-message" role="alert">{t("reader.libraryError")}</p>}
      {books.hasNextPage && (
        <div className="reader-message">
          <button type="button" className="reader-button" disabled={books.isFetching}
            aria-busy={books.isFetchingNextPage} onClick={() => void books.fetchNextPage()}>
            {t(books.isFetchingNextPage ? "reader.loading" : books.isFetchNextPageError ? "reader.retry" : "reader.loadMore")}
          </button>
        </div>
      )}
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
