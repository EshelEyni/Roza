import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Book,
  BookDataItem,
  BooKDataItemType,
  Chapter,
} from "../../../../shared/types/books";
import { useGetBook } from "../../hooks/reactQuery/get/useGetBook";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import bookApi from "../../services/bookApiService";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { PDFCreator } from "../../services/pdfService/PDFCreator";
import { downloadFile } from "../../services/utilService";
import {
  download,
  manuscriptWords,
  newId,
  plainText,
  words,
} from "../../components/WritingStudio/manuscript";
import { ManuscriptText } from "../../components/WritingStudio/ManuscriptText";
import "../../components/WritingStudio/writingStudio.css";

const categories: BooKDataItemType[] = [
  "chapters",
  "characters",
  "plotlines",
  "themes",
  "notes",
];
const labels: Record<BooKDataItemType, string> = {
  chapters: "Chapters",
  characters: "Characters",
  plotlines: "Plotlines",
  themes: "Themes",
  notes: "Notes",
};
const titleOf = (item: BookDataItem, index: number) =>
  "name" in item
    ? item.name || `Untitled ${index + 1}`
    : plainText(item.text).slice(0, 60) || `Note ${index + 1}`;
const textOf = (item: BookDataItem) =>
  "text" in item ? item.text : item.description;

export default function BookDetails() {
  const { id } = useParams();
  const query = useGetBook(id);
  useDocumentTitle(`Roza / ${query.book?.name || "Book overview"}`);
  if (query.isLoadingBook)
    return (
      <main className="ws ws-loading" role="status">
        Opening your book…
      </main>
    );
  if (!query.book || query.isErrorBook)
    return (
      <main className="ws ws-loading">
        <h1>Unable to open this book</h1>
        <p>
          {query.errorBook instanceof Error
            ? query.errorBook.message
            : "Please try again."}
        </p>
        <Link to="/books">Back to library</Link>
      </main>
    );
  return <BookOverview key={query.book.id} book={query.book} />;
}

function BookOverview({ book }: { book: Book }) {
  const { dataItemType, dataItemId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { loggedInUser } = useLoginWithToken();
  const [category, setCategory] = useState<BooKDataItemType>(
    categories.includes(book.filterBy) ? book.filterBy : "chapters",
  );
  const [search, setSearch] = useState("");
  const [reading, setReading] = useState(book.isReadMode);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(book.name);
  const [exportError, setExportError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ next }: { next: Book; destination?: string }) =>
      bookApi.update(next),
    onSuccess: (saved, variables) => {
      client.setQueryData(["book", book.id], saved);
      void client.invalidateQueries({ queryKey: ["books"] });
      setRenaming(false);
      if (variables.destination) navigate(variables.destination);
    },
  });
  const routeType = categories.includes(dataItemType as BooKDataItemType)
    ? (dataItemType as BooKDataItemType)
    : null;
  const item = routeType
    ? book[routeType].find(
        entry => entry.id === dataItemId && !entry.isArchived,
      )
    : undefined;
  const items = book[category].filter(entry => !entry.isArchived);
  const chapters = book.chapters.filter(entry => !entry.isArchived);
  const total = manuscriptWords(book);
  const filtered = items.filter((entry, index) =>
    `${titleOf(entry, index)} ${plainText(textOf(entry))}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const overviewUrl = `/book/${book.id}`;
  const editUrl = item
    ? `/book-edit/${book.id}/${routeType}/${item.id}`
    : `/book-edit/${book.id}`;
  const itemIndex =
    item && routeType
      ? book[routeType]
          .filter(entry => !entry.isArchived)
          .findIndex(entry => entry.id === item.id)
      : -1;

  function addPage() {
    const entry = {
      ...getDefaultBookDataItem({ bookId: book.id, type: category }),
      id: newId(),
    };
    if ("name" in entry)
      entry.name =
        category === "chapters" ? `Chapter ${items.length + 1}` : "Untitled";
    mutation.mutate({
      next: { ...book, [category]: [...book[category], entry] },
      destination: `/book-edit/${book.id}/${category}/${entry.id}`,
    });
  }
  function rename(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) mutation.mutate({ next: { ...book, name: name.trim() } });
  }
  function archive() {
    const label = item ? titleOf(item, itemIndex) : book.name;
    if (
      !window.confirm(
        `Archive “${label}”? The content will be kept in storage but hidden from your library. Restoring it later currently requires support.`,
      )
    )
      return;
    mutation.mutate({
      next:
        item && routeType
          ? {
              ...book,
              [routeType]: book[routeType].map(entry =>
                entry.id === item.id ? { ...entry, isArchived: true } : entry,
              ),
            }
          : { ...book, isArchived: true },
      destination: item ? overviewUrl : "/books",
    });
  }
  function chapterPdf(chapter: Chapter) {
    try {
      const pdf = new PDFCreator(
        loggedInUser?.language || "en",
      ).createBookChapterPdf({ chapter }) as Blob;
      downloadFile({ blob: pdf, fileName: chapter.name || "Chapter" });
    } catch {
      setExportError(
        "Unable to create the PDF. You can export the manuscript as HTML from the book overview.",
      );
    }
  }

  return (
    <main className="ws ws-details">
      <div className="ws-details-inner">
        <nav className="ws-breadcrumb" aria-label="Book navigation">
          <Link to="/books">← Library</Link>
          {item && (
            <>
              <span>/</span>
              <Link to={overviewUrl}>{book.name}</Link>
            </>
          )}
          {reading && !item && (
            <button onClick={() => setReading(false)}>← Book overview</button>
          )}
        </nav>
        <header className="ws-overview-heading">
          <div>
            <span className="ws-eyebrow">
              {item
                ? `${routeType === "chapters" ? "CHAPTER" : labels[routeType!].toUpperCase()} ${String(itemIndex + 1).padStart(2, "0")}`
                : reading
                  ? "MANUSCRIPT PREVIEW"
                  : "BOOK OVERVIEW"}
            </span>
            <h1 dir="auto">{item ? titleOf(item, itemIndex) : book.name}</h1>
            <p>
              {item
                ? `${words(textOf(item)).toLocaleString()} words · ${Math.max(1, Math.ceil(words(textOf(item)) / 200))} min read`
                : "Your story, from the first idea to the final chapter."}
            </p>
          </div>
          <Link className="ws-action ws-primary" to={editUrl}>
            {item ? "Edit this page" : "Continue writing"} →
          </Link>
        </header>
        {(mutation.isError || exportError) && (
          <div className="ws-notice ws-error" role="alert">
            {exportError ||
              mutation.error?.message ||
              "The change could not be saved. Please try again."}
          </div>
        )}
        <div className="ws-overview-actions">
          {!item && (
            <>
              <button onClick={() => setReading(!reading)}>
                {reading ? "Back to overview" : "Read manuscript"}
              </button>
              <button
                onClick={() => {
                  setName(book.name);
                  setRenaming(!renaming);
                }}
                aria-expanded={renaming}
              >
                Rename book
              </button>
              <button onClick={() => download(book, "html")}>
                Export manuscript
              </button>
              <button onClick={() => download(book, "json")}>
                Download backup
              </button>
            </>
          )}
          {item?.type === "chapters" && (
            <button onClick={() => chapterPdf(item)}>
              Download chapter PDF
            </button>
          )}
          <button
            className="ws-archive-action"
            disabled={mutation.isPending}
            onClick={archive}
          >
            {mutation.isPending
              ? "Saving…"
              : item
                ? "Archive page"
                : "Archive book"}
          </button>
        </div>
        {renaming && !item && (
          <form className="ws-create" onSubmit={rename}>
            <label htmlFor="overview-book-name">Book title</label>
            <div>
              <input
                id="overview-book-name"
                autoFocus
                maxLength={200}
                required
                value={name}
                onChange={event => setName(event.target.value)}
              />
              <button
                className="ws-primary"
                disabled={!name.trim() || mutation.isPending}
              >
                Save title
              </button>
              <button type="button" onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        {dataItemType && !item ? (
          <section className="ws-empty">
            <h2>This page is no longer available.</h2>
            <Link className="ws-action" to={overviewUrl}>
              Return to book overview
            </Link>
          </section>
        ) : item ? (
          <>
            <article className="ws-reading-page">
              <ManuscriptText value={textOf(item)} />
              {!plainText(textOf(item)).trim() && (
                <p className="ws-muted">
                  This page is still unwritten. Open the editor to begin.
                </p>
              )}
              {item.type === "chapters" &&
                !!plainText(item.description).trim() && (
                  <details className="ws-preview-notes">
                    <summary>Chapter notes</summary>
                    <ManuscriptText value={item.description} />
                  </details>
                )}
            </article>
            {item.type === "chapters" && (
              <nav
                className="ws-chapter-paging"
                aria-label="Chapter navigation"
              >
                {chapters[itemIndex - 1] ? (
                  <Link
                    to={`${overviewUrl}/chapters/${chapters[itemIndex - 1].id}`}
                  >
                    ← {chapters[itemIndex - 1].name || "Previous chapter"}
                  </Link>
                ) : (
                  <span />
                )}
                <Link to={overviewUrl}>All chapters</Link>
                {chapters[itemIndex + 1] ? (
                  <Link
                    to={`${overviewUrl}/chapters/${chapters[itemIndex + 1].id}`}
                  >
                    {chapters[itemIndex + 1].name || "Next chapter"} →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        ) : reading ? (
          <section aria-label="Manuscript preview">
            {chapters.length ? (
              chapters.map((chapter, index) => (
                <article key={chapter.id} className="ws-reading-page">
                  <span className="ws-eyebrow">
                    CHAPTER {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 dir="auto">{chapter.name || `Chapter ${index + 1}`}</h2>
                  <ManuscriptText value={chapter.text} />
                  <Link
                    className="ws-action"
                    to={`/book-edit/${book.id}/chapters/${chapter.id}`}
                  >
                    Edit chapter →
                  </Link>
                </article>
              ))
            ) : (
              <div className="ws-empty">
                <h2>Your first chapter is waiting.</h2>
                <Link className="ws-action" to={editUrl}>
                  Start writing →
                </Link>
              </div>
            )}
          </section>
        ) : (
          <>
            <dl className="ws-book-stats">
              <div>
                <dt>Manuscript words</dt>
                <dd>{total.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Chapters</dt>
                <dd>{chapters.length}</dd>
              </div>
              <div>
                <dt>Planning pages</dt>
                <dd>
                  {categories
                    .filter(type => type !== "chapters")
                    .reduce(
                      (count, type) =>
                        count +
                        book[type].filter(entry => !entry.isArchived).length,
                      0,
                    )}
                </dd>
              </div>
              <div>
                <dt>Last edited</dt>
                <dd className="ws-date">
                  {new Date(book.updatedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
            <section aria-label="Book contents">
              <div className="ws-category-tabs" aria-label="Content categories">
                {categories.map(type => (
                  <button
                    key={type}
                    aria-pressed={category === type}
                    onClick={() => {
                      setCategory(type);
                      setSearch("");
                    }}
                  >
                    {labels[type]}{" "}
                    <span>
                      {book[type].filter(entry => !entry.isArchived).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ws-contents-tools">
                <h2>{labels[category]}</h2>
                <div>
                  <input
                    type="search"
                    aria-label="Search book contents"
                    placeholder="Search titles and text…"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                  <button
                    className="ws-primary"
                    disabled={mutation.isPending}
                    onClick={addPage}
                  >
                    ＋ {category === "chapters" ? "Add chapter" : "Add page"}
                  </button>
                </div>
              </div>
              <ol className="ws-content-list">
                {filtered.map(entry => (
                  <li key={entry.id}>
                    <span className="ws-row-number">
                      {String(items.indexOf(entry) + 1).padStart(2, "0")}
                    </span>
                    <Link
                      className="ws-content-title"
                      to={`${overviewUrl}/${category}/${entry.id}`}
                    >
                      <h3 dir="auto">{titleOf(entry, items.indexOf(entry))}</h3>
                      <p dir="auto">
                        {plainText(textOf(entry)).trim().slice(0, 160) ||
                          "A blank page, ready for your ideas."}
                      </p>
                    </Link>
                    <span className="ws-row-count">
                      {words(textOf(entry)).toLocaleString()} words
                    </span>
                    <Link
                      className="ws-row-edit"
                      aria-label={`Edit ${titleOf(entry, items.indexOf(entry))}`}
                      to={`/book-edit/${book.id}/${category}/${entry.id}`}
                    >
                      Write →
                    </Link>
                  </li>
                ))}
              </ol>
              {!filtered.length && (
                <div className="ws-empty">
                  <h2>
                    {search
                      ? "No matching pages"
                      : category === "chapters"
                        ? "Give your story a beginning."
                        : "A place for your ideas."}
                  </h2>
                  <p>
                    {search
                      ? "Try another title or phrase."
                      : "Add a page to start shaping this part of your book."}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
