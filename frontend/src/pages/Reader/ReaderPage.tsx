import { useTranslation } from "react-i18next";
import { FiGrid, FiList, FiPlay, FiSearch, FiSliders } from "react-icons/fi";
import { Link } from "react-router-dom";
import { GiBookCover, GiBookshelf } from "react-icons/gi";
import { ReaderBookGrid } from "../../components/Reader/ReaderBookGrid";
import { useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { ReaderSelect } from "../../components/Reader/ReaderSelect";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import readerApiService from "../../services/readerApiService";
import type { ReaderBook, ReaderLibraryCounts, ReaderLibrarySort, ReaderLibraryView } from "../../../../shared/types/reader";
import { ReaderUpload } from "../../components/Reader/ReaderUpload";
import { useGetReaderBooks } from "../../hooks/reactQuery/get/useGetReaderBooks";
import { ReaderLibraryOptions } from "../../components/Reader/ReaderLibraryOptions";
import { useReaderMobile } from "../../hooks/useReaderMobile";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "../../styles/app/_reader.scss";

const libraryViews = ["all", "reading", "unread", "finished", "archived"] as const;
const librarySorts = ["recent", "title", "author", "added", "custom"] as const;

type LibraryChange =
  | { kind: "archive"; book: ReaderBook }
  | { kind: "pin"; book: ReaderBook }
  | { kind: "move"; id: string; anchorId: string; placement: "before" | "after" };

function ReaderLibrary({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const mobile = useReaderMobile("(max-width: 800px)");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [view, setView] = useState<ReaderLibraryView>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [counts, setCounts] = useState<ReaderLibraryCounts>();
  const archived = view === "archived";
  const sortStorageKey = "readerLibrarySort:" + userId;
  const [sort, setSort] = useState<ReaderLibrarySort>(() => {
    try {
      return librarySorts.find(value => value === localStorage.getItem(sortStorageKey)) ?? "recent";
    } catch {
      return "recent";
    }
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [temporaryOrder, setTemporaryOrder] = useState<string[]>([]);
  const term = search.trim();
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(term), 250);
    return () => window.clearTimeout(timeout);
  }, [term]);

  const waitingForSearch = Boolean(term && term !== debouncedSearch);
  const books = useGetReaderBooks(!waitingForSearch, view, sort, term, mobile);
  const resume = mobile && view === "all" && !term ? books.data?.pages[0]?.resume : undefined;
  const pageCounts = books.data?.pages[0]?.counts;
  useEffect(() => { if (pageCounts) setCounts(pageCounts); }, [pageCounts]);
  const loadedBooks = waitingForSearch ? [] : Array.from(new Map(
    books.data?.pages.flatMap(page => page.books).map(book => [book.id, book]),
  ).values());
  if (temporaryOrder.length) {
    const positions = new Map(temporaryOrder.map((id, index) => [id, index]));
    loadedBooks.sort((a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity),
    );
  }
  const client = useQueryClient();
  const change = useMutation({
    mutationFn: async (action: LibraryChange): Promise<void> => {
      switch (action.kind) {
        case "archive": await readerApiService.setArchived(action.book.id, !archived); break;
        case "pin": await readerApiService.setPinned(action.book.id, !action.book.pinned); break;
        case "move": await readerApiService.moveBook(action.id, action.anchorId, action.placement, archived); break;
      }
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["readerBooks", userId] });
    },
  });

  const changeSort = (value: ReaderLibrarySort) => {
    if (sort !== value) setTemporaryOrder([]);
    setSort(value);
    try { localStorage.setItem(sortStorageKey, value); } catch { /* Use the selection for this session. */ }
  };
  const sortOptions = librarySorts.map(value => ({ value, label: t("reader.librarySortOptions." + value) }));

  const onMove = (id: string, anchorId: string) => {
    const from = loadedBooks.findIndex(book => book.id === id);
    const to = loadedBooks.findIndex(book => book.id === anchorId);
    if (change.isPending || from < 0 || to < 0 || from === to ||
        Boolean(loadedBooks[from].pinned) !== Boolean(loadedBooks[to].pinned)) return;
    if (sort === "custom") {
      change.mutate({ kind: "move", id, anchorId, placement: from < to ? "after" : "before" });
    } else {
      setTemporaryOrder(arrayMove(loadedBooks, from, to).map(book => book.id));
    }
  };
  return (
    <>
      <div className="reader-library-heading">
        <div>
          <p className="reader-eyebrow">{t("reader.eyebrow")}</p>
          <h1>{t(mobile ? "reader.libraryMobileTitle" : "reader.library")}</h1>
          {mobile ? counts && <p>{t("reader.librarySummary", { count: counts.all, reading: counts.reading })}</p>
            : <p>{t("reader.subtitle")}</p>}
        </div>
        <ReaderUpload compact={mobile} />
      </div>
      <div className="reader-library-controls">
        <div className="reader-library-filters" role="group" aria-label={t("reader.libraryFilter")}>
          {libraryViews.map(filter => (
            <button key={filter} type="button" aria-pressed={view === filter}
              onClick={() => { if (view !== filter) setTemporaryOrder([]); setView(filter); }}>
              {t("reader.libraryViews." + filter)}
              {filter !== "archived" && counts && <span aria-hidden="true">{counts[filter]}</span>}
            </button>
          ))}
        </div>
        <div className="reader-library-tools">
          <label className="reader-search-form reader-library-search">
            <FiSearch aria-hidden="true" />
            <input type="search" value={search} maxLength={200}
              aria-label={t("reader.searchLibrary")} placeholder={t("reader.librarySearchPlaceholder")}
              onChange={event => { setSearch(event.target.value); setTemporaryOrder([]); }} />
          </label>
          {mobile ? <button type="button" className="reader-library-options-trigger"
            aria-label={t("reader.libraryOptions")} aria-haspopup="dialog" onClick={() => setOptionsOpen(true)}>
            <FiSliders aria-hidden="true" />
          </button> : <>
          <div className="reader-library-sort">
            <span hidden id="reader-library-sort-label">{t("reader.librarySort")}</span>
            <ReaderSelect id="reader-library-sort" labelId="reader-library-sort-label" value={sort}
              prefix={t("reader.librarySortPrefix")}
              options={sortOptions} onChange={changeSort} />
          </div>
          <div className="reader-library-layout" role="group" aria-label={t("reader.libraryLayout")}>
            <button type="button" aria-pressed={layout === "grid"} aria-label={t("reader.libraryGridView")}
              title={t("reader.libraryGridView")} onClick={() => setLayout("grid")}><FiGrid aria-hidden="true" /></button>
            <button type="button" aria-pressed={layout === "list"} aria-label={t("reader.libraryListView")}
              title={t("reader.libraryListView")} onClick={() => setLayout("list")}><FiList aria-hidden="true" /></button>
          </div>
          </>}
        </div>
      </div>
      {mobile && <ReaderLibraryOptions open={optionsOpen} sort={sort} sortOptions={sortOptions} layout={layout}
        onSort={changeSort} onLayout={setLayout} onClose={() => setOptionsOpen(false)} />}
      {resume && <Link className="reader-library-resume" to={"/reader/" + resume.id}>
        <span className="reader-library-resume-cover">
          {resume.cover ? <img src={resume.cover} alt="" /> : <GiBookCover aria-hidden="true" />}
        </span>
        <span className="reader-library-resume-info">
          <span className="reader-library-resume-label">{t("reader.continueReading")}</span>
          <strong>{resume.title}</strong>
          <span className="reader-library-resume-progress">
            <progress max={1} value={resume.state.progress} aria-label={t("reader.progress")} />
            <span>{Math.round(resume.state.progress * 100)}%</span>
          </span>
        </span>
        <span className="reader-library-resume-play"><FiPlay aria-hidden="true" /></span>
      </Link>}
      {change.isError && <p className="reader-message" role="alert">{t(
        change.variables?.kind === "archive" ? "reader.archiveError" : "reader.libraryUpdateError",
      )}</p>}
      {(waitingForSearch || books.isLoading) && (
        <p className="reader-message" role="status">
          {t("reader.loading")}
        </p>
      )}
      {!waitingForSearch && books.isError && !books.isFetchNextPageError && (
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
      {!waitingForSearch && books.isSuccess && !loadedBooks.length && (
        <div className="reader-empty">
          <GiBookshelf aria-hidden="true" />
          <h2>{t(term ? "reader.librarySearchEmpty" : archived ? "reader.archiveEmpty" : view === "all" ? "reader.emptyTitle" : "reader.libraryFilterEmpty")}</h2>
          {!term && view === "all" && <p>{t("reader.emptyDescription")}</p>}
        </div>
      )}
      {!!loadedBooks.length && (
        <div className="reader-library-meta">
          {t("reader.bookCount", { count: loadedBooks.length })}
        </div>
      )}
      <ReaderBookGrid books={loadedBooks} layout={layout} archived={archived} pending={change.isPending} custom={sort === "custom"}
        onArchive={book => { setTemporaryOrder([]); change.mutate({ kind: "archive", book }); }}
        onPin={book => { setTemporaryOrder([]); change.mutate({ kind: "pin", book }); }}
        onMove={onMove} />
      {!waitingForSearch && books.isFetchNextPageError && <p className="reader-message" role="alert">{t("reader.libraryError")}</p>}
      {!waitingForSearch && books.hasNextPage && (
        <div className="reader-message">
          <button type="button" className="reader-button" disabled={books.isFetching || change.isPending}
            aria-busy={books.isFetchingNextPage} onClick={() => void books.fetchNextPage()}>
            {t(books.isFetchingNextPage ? "reader.loading" : books.isFetchNextPageError ? "reader.retry" : "reader.loadMore")}
          </button>
        </div>
      )}
    </>
  );
}

export default function ReaderPage() {
  const { t } = useTranslation();
  const { loggedInUser } = useLoginWithToken();
  useDocumentTitle(`Roza / ${t("reader.nav")}`);
  return (
    <main className="reader-library">
      {loggedInUser && <ReaderLibrary key={loggedInUser.id} userId={loggedInUser.id} />}
    </main>
  );
}
