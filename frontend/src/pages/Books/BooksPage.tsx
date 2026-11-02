import { Book } from "../../../../shared/types/books";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import bookApi from "../../services/bookApiService";
import { getDefaultBook } from "../../services/bookUtilService";
import { manuscriptWords } from "../../components/WritingStudio/manuscript";
import "../../components/WritingStudio/writingStudio.css";

export default function BooksPage() {
  useDocumentTitle("Roza / Writing studio");
  const { loggedInUser } = useLoginWithToken();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const query = useQuery({
    queryKey: ["books", "studio", loggedInUser?.id],
    queryFn: () => bookApi.query({ limit: 10000, sort: "-updatedAt" }),
    enabled: !!loggedInUser,
  });
  const create = useMutation({
    mutationFn: () =>
      bookApi.add(getDefaultBook(loggedInUser?.id, name.trim())),
    onSuccess: book => {
      void client.invalidateQueries({ queryKey: ["books"] });
      navigate(`/book-edit/${book.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (book: Book) => bookApi.update({ ...book, isArchived: true }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["books"] });
    },
  });
  const books = [...(query.data || [])]
    .filter(book =>
      book.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.name.localeCompare(b.name)
        : sort === "words"
          ? manuscriptWords(b) - manuscriptWords(a)
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
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
            Your manuscripts <span>{query.data?.length ?? 0}</span>
          </h2>
          <div>
            <input
              type="search"
              aria-label="Search manuscripts"
              placeholder="Search manuscripts…"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select
              aria-label="Sort manuscripts"
              value={sort}
              onChange={event => setSort(event.target.value)}
            >
              <option value="recent">Recently edited</option>
              <option value="title">Title A–Z</option>
              <option value="words">Word count</option>
            </select>
          </div>
        </div>
        {query.isLoading && (
          <p role="status" className="ws-muted">
            Gathering your stories…
          </p>
        )}
        {query.isError && (
          <div className="ws-notice ws-error" role="alert">
            Unable to load your library.{" "}
            <button onClick={() => void query.refetch()}>Try again</button>
          </div>
        )}
        {!query.isLoading && !query.isError && !books.length && (
          <div className="ws-empty">
            <h2>
              {search ? "No matching manuscripts" : "Your story belongs here."}
            </h2>
            <p>
              {search
                ? "Try a different title."
                : "Start a manuscript. Gather your ideas. Find your rhythm."}
            </p>
            {!search && (
              <button className="ws-primary" onClick={() => setCreating(true)}>
                Create your first manuscript
              </button>
            )}
          </div>
        )}
        {archive.isError && (
          <div className="ws-notice ws-error" role="alert">
            {archive.error.message ||
              "Unable to archive the manuscript. Please try again."}
          </div>
        )}
        <div className="ws-book-grid">
          {books.map((book, index) => (
            <article key={book.id} className="ws-book-card">
              <Link
                to={`/book-edit/${book.id}`}
                className="ws-book-cover"
                data-color={index % 4}
                aria-label={`Write ${book.name}`}
              >
                <span className="ws-eyebrow">
                  MANUSCRIPT / {String(index + 1).padStart(2, "0")}
                </span>
                <h3 dir="auto">{book.name}</h3>
                <span className="ws-cover-rule" />
                <small>
                  {book.chapters.filter(chapter => !chapter.isArchived).length}{" "}
                  chapters
                </small>
              </Link>
              <div className="ws-book-meta">
                <span>{manuscriptWords(book).toLocaleString()} words</span>
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
                <Link
                  to={`/book/${book.id}`}
                  aria-label={`Details for ${book.name}`}
                >
                  Details
                </Link>
                <button
                  disabled={archive.isPending}
                  aria-label={`Archive ${book.name}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Archive “${book.name}”? It will be removed from your library. Its data is retained, but restoring a whole book currently requires support.`,
                      )
                    )
                      archive.mutate(book);
                  }}
                >
                  Archive
                </button>
              </div>
            </article>
          ))}
        </div>
        <footer className="ws-library-footer">One page at a time.</footer>
      </div>
    </main>
  );
}
