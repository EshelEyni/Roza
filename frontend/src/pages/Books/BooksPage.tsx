import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import bookApi from "../../services/bookApiService";
import { getDefaultBook } from "../../services/bookUtilService";
import type { ManuscriptFilter, ManuscriptPage, ManuscriptSort } from "../../../../shared/types/books";
import "../../components/WritingStudio/writingStudio.css";
import { ReaderSelect } from "../../components/Reader/ReaderSelect";
import { useTranslation } from "react-i18next";
import { FiGrid, FiList, FiSearch } from "react-icons/fi";

type LibraryLayout = "grid" | "list";
const layoutKey = "roza.studioLibraryLayout";
const manuscriptFilters: { value: ManuscriptFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "writing", label: "In progress" },
  { value: "blank", label: "Not started" },
  { value: "epub", label: "Has EPUB" },
];

function readLayout(): LibraryLayout {
  try {
    return localStorage.getItem(layoutKey) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export default function BooksPage() {
  const { t } = useTranslation();
  useDocumentTitle(`Roza / ${t("writingStudioNav")}`);
  const { loggedInUser } = useLoginWithToken();
  const readerAccess = useFeatureAccess("reader");
  const publishingAccess = useFeatureAccess("studioPublishing");
  const navigate = useNavigate();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const term = search.trim();
  const [debouncedTerm, setDebouncedTerm] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTerm(term), 250);
    return () => window.clearTimeout(timeout);
  }, [term]);
  const waitingForSearch = term !== debouncedTerm;
  const [sort, setSort] = useState<ManuscriptSort>("recent");
  const [filter, setFilter] = useState<ManuscriptFilter>("all");
  const [layout, setLayout] = useState<LibraryLayout>(readLayout);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["books", "studio", loggedInUser?.id, debouncedTerm, sort, filter],
    queryFn: ({ pageParam, signal }) =>
      bookApi.queryManuscripts(debouncedTerm, sort, filter, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: page => page.nextOffset ?? undefined,
    networkMode: "always",
    enabled: !!loggedInUser && !waitingForSearch,
  });
  const create = useMutation({
    mutationFn: () =>
      bookApi.add(getDefaultBook(loggedInUser?.id, name.trim())),
    onSuccess: book => {
      void client.invalidateQueries({ queryKey: ["books"] });
      navigate(`/book-edit/${book.id}`);
    },
  });
  const books = waitingForSearch ? [] : Array.from(new Map(
    query.data?.pages.flatMap(page => page.manuscripts).map(book => [book.id, book]),
  ).values());
  // Keep the chip counts steady while another filter loads.
  const lastCounts = useRef<ManuscriptPage["counts"]>();
  if (query.data?.pages[0]?.counts) lastCounts.current = query.data.pages[0].counts;
  const counts = waitingForSearch ? undefined : lastCounts.current;
  const filtered = !!term || filter !== "all";
  const loading = waitingForSearch || query.isLoading;
  function changeLayout(next: LibraryLayout) {
    setLayout(next);
    try {
      localStorage.setItem(layoutKey, next);
    } catch {
      // The layout choice is a convenience; ignore blocked storage.
    }
  }
  const loadError = !waitingForSearch && query.isError && !query.isFetchNextPageError;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && loggedInUser && !create.isPending) create.mutate();
  }
  return (
    <main className="ws ws-library">
      <div className="ws-library-inner">
        <header className="ws-library-heading">
          <div>
            <span className="ws-eyebrow">Writing Studio</span>
            <h1>Your manuscripts</h1>
            <p>Every story you are writing, on one shelf. Pick one up where you left it.</p>
          </div>
          <button
            className="ws-primary"
            onClick={() => setCreating(!creating)}
            aria-expanded={creating}
          >
            ＋ New manuscript
          </button>
        </header>
        {creating && (
          <form className="ws-create" onSubmit={submit}>
            <label htmlFor="manuscript-name">What’s your working title?</label>
            <div>
              <input
                id="manuscript-name"
                autoFocus
                required
                maxLength={200}
                placeholder="An untold story"
                value={name}
                onChange={event => setName(event.target.value)}
              />
              <button
                className="ws-primary"
                disabled={create.isPending || !name.trim()}
              >
                {create.isPending ? "Creating…" : "Create manuscript"}
              </button>
              <button
                type="button"
                disabled={create.isPending}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
            </div>
            {create.isError && (
              <p role="alert">
                {create.error.message ||
                  "Unable to create your manuscript. Please try again."}
              </p>
            )}
          </form>
        )}
        <div className="ws-library-controls">
          <div className="ws-library-filters" role="group" aria-label="Show manuscripts">
            {manuscriptFilters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
                {counts && <span aria-hidden="true">{counts[value]}</span>}
              </button>
            ))}
          </div>
          <div className="ws-library-tools">
            <label className="ws-library-search">
              <FiSearch aria-hidden="true" />
              <input
                type="search"
                maxLength={200}
                aria-label="Search manuscripts"
                placeholder="Search manuscripts"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </label>
            <span id="manuscript-sort-label" className="ws-sr-only">
              Sort manuscripts
            </span>
            <div className="ws-library-sort">
              <ReaderSelect
                id="manuscript-sort"
                labelId="manuscript-sort-label"
                value={sort}
                prefix="Sort"
                options={[
                  { value: "recent", label: "Recently edited" },
                  { value: "title", label: "Title A–Z" },
                  { value: "words", label: "Word count" },
                ]}
                onChange={setSort}
              />
            </div>
            <div className="ws-library-layout" role="group" aria-label="Layout">
              <button type="button" aria-pressed={layout === "grid"} aria-label="Grid view"
                title="Grid view" onClick={() => changeLayout("grid")}>
                <FiGrid aria-hidden="true" />
              </button>
              <button type="button" aria-pressed={layout === "list"} aria-label="List view"
                title="List view" onClick={() => changeLayout("list")}>
                <FiList aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        {loading && (
          <p role="status" className="ws-muted">
            Gathering your stories…
          </p>
        )}
        {loadError && (
          <div className="ws-notice ws-error" role="alert">
            Unable to load your library.{" "}
            <button onClick={() => void query.refetch()}>Try again</button>
          </div>
        )}
        {query.isSuccess && !loading && !books.length && (
          <div className="ws-empty">
            <h2>
              {filtered ? "No matching manuscripts" : "Your story belongs here."}
            </h2>
            <p>
              {term
                ? "Try a different title."
                : filtered
                  ? "No manuscripts on this shelf yet."
                  : "Start a manuscript. Gather your ideas. Find your rhythm."}
            </p>
            {!filtered && (
              <button className="ws-primary" onClick={() => setCreating(true)}>
                Create your first manuscript
              </button>
            )}
          </div>
        )}
        <div className={`ws-book-grid${layout === "list" ? " ws-book-list" : ""}`}>
          {books.map((book, index) => {
            const showEpub = readerAccess && publishingAccess && !!book.readerBookId;
            const goal = book.wordGoal && book.wordCount ? book.wordGoal : 0;
            return (
              <article key={book.id} className="ws-book-card">
                <Link
                  to={`/book-edit/${book.id}`}
                  className="ws-book-card-link"
                  aria-label={`Write ${book.name}`}
                />
                <div className="ws-book-cover">
                  {book.cover ? (
                    <img className="ws-book-cover-image" src={book.cover} alt="" />
                  ) : (
                    <span className="ws-book-cloth" data-color={index % 4} aria-hidden="true">
                      <small>Manuscript</small>
                      <b dir="auto">{book.name}</b>
                      <span>❦</span>
                    </span>
                  )}
                  {showEpub && <span className="ws-book-badge">EPUB</span>}
                </div>
                <div className="ws-book-info">
                  <h3 dir="auto">{book.name}</h3>
                  <p className="ws-book-facts">
                    {book.chapterCount
                      ? `${book.chapterCount} ${book.chapterCount === 1 ? "chapter" : "chapters"} · ${book.wordCount.toLocaleString()} words`
                      : "No chapters yet"}
                    {" · "}
                    <time dateTime={String(book.updatedAt)}>
                      {new Date(book.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </p>
                  {goal ? (
                    <div className="ws-book-goal">
                      <span>
                        {Math.round(Math.min(1, book.wordCount / goal) * 100)}% of{" "}
                        {goal.toLocaleString()} word goal
                      </span>
                      <progress max={goal} value={Math.min(book.wordCount, goal)} />
                    </div>
                  ) : !book.chapterCount ? (
                    <div className="ws-book-goal">
                      <span>Blank page · ready for chapter one</span>
                    </div>
                  ) : null}
                  <div className="ws-book-open">
                    <span>
                      {book.chapterCount ? "Continue writing" : "Start writing"}{" "}
                      <span aria-hidden="true">→</span>
                    </span>
                    {showEpub && (
                      <Link to={`/reader/${book.readerBookId}`} className="ws-book-epub">
                        Read EPUB
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!waitingForSearch && query.hasNextPage && (
          <div className="ws-library-pagination">
            {query.isFetchNextPageError && (
              <p role="alert">Unable to load more manuscripts.</p>
            )}
            <button
              type="button"
              disabled={query.isFetching}
              aria-busy={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              <span>{query.isFetchingNextPage ? "Loading…" : query.isFetchNextPageError ? "Try again" : "Load more"}</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
