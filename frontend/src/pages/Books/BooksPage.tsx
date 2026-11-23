import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import bookApi from "../../services/bookApiService";
import { getDefaultBook } from "../../services/bookUtilService";
import type { ManuscriptSort } from "../../../../shared/types/books";
import "../../components/WritingStudio/writingStudio.css";
import { ReaderSelect } from "../../components/Reader/ReaderSelect";
import { useTranslation } from "react-i18next";

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
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["books", "studio", loggedInUser?.id, debouncedTerm, sort],
    queryFn: ({ pageParam, signal }) => bookApi.queryManuscripts(debouncedTerm, sort, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: page => page.nextOffset ?? undefined,
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
  const loading = waitingForSearch || query.isLoading;
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
            <span className="ws-eyebrow">ROZA / YOUR WRITING LIFE</span>
            <h1>
              A little space.
              <br />A world of stories.
            </h1>
            <p>Your manuscripts, ready for the next chapter.</p>
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
        <div className="ws-library-tools">
          <h2>
            Your manuscripts <span>{waitingForSearch ? 0 : query.data?.pages[0]?.total ?? 0}</span>
          </h2>
          <div>
            <input
              type="search"
              maxLength={200}
              aria-label="Search manuscripts"
              placeholder="Search manuscripts…"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <span id="manuscript-sort-label" className="ws-sr-only">
              Sort manuscripts
            </span>
            <div className="ws-library-sort">
              <ReaderSelect
                id="manuscript-sort"
                labelId="manuscript-sort-label"
                value={sort}
                options={[
                  { value: "recent", label: "Recently edited" },
                  { value: "title", label: "Title A–Z" },
                  { value: "words", label: "Word count" },
                ]}
                onChange={setSort}
              />
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
              {term ? "No matching manuscripts" : "Your story belongs here."}
            </h2>
            <p>
              {term
                ? "Try a different title."
                : "Start a manuscript. Gather your ideas. Find your rhythm."}
            </p>
            {!term && (
              <button className="ws-primary" onClick={() => setCreating(true)}>
                Create your first manuscript
              </button>
            )}
          </div>
        )}
        <div className="ws-book-grid">
          {books.map((book, index) => (
            <article key={book.id} className="ws-book-card">
              <Link
                to={`/book-edit/${book.id}`}
                className="ws-book-cover"
                data-color={index % 4}
                data-has-cover={book.cover ? "true" : undefined}
                aria-label={`Write ${book.name}`}
              >
                {book.cover && (
                  <img className="ws-book-cover-image" src={book.cover} alt="" />
                )}
                <span className="ws-eyebrow">
                  MANUSCRIPT / {String(index + 1).padStart(2, "0")}
                </span>
                <h3 dir="auto">{book.name}</h3>
                <span className="ws-cover-rule" />
                <small>
                  {book.chapterCount}{" "}
                  chapters
                </small>
              </Link>
              <div className="ws-book-meta">
                <span>{book.wordCount.toLocaleString()} words</span>
                <time dateTime={String(book.updatedAt)}>
                  {new Date(book.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
              <div className="ws-book-links">
                <Link to={`/book-edit/${book.id}`}>
                  Continue writing <span aria-hidden="true">→</span>
                </Link>
                {readerAccess && publishingAccess && book.readerBookId && (
                  <Link to={`/reader/${book.readerBookId}`} className="ws-book-epub">
                    Read EPUB
                  </Link>
                )}
              </div>
            </article>
          ))}
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
