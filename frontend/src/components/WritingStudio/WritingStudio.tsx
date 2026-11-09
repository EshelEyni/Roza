import { useEffect, useMemo, useReducer, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Book,
  BookDataItem,
  BooKDataItemType,
  SlateCustomElement,
} from "../../../../shared/types/books";
import { useGetBook } from "../../hooks/reactQuery/get/useGetBook";
import bookApi from "../../services/bookApiService";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { DraftStore } from "./draftStore";
import {
  download,
  manuscriptWords,
  newId,
  plainText,
  words,
} from "./manuscript";
import { ManuscriptEditor } from "./ManuscriptEditor";
import "./writingStudio.css";

const categories: BooKDataItemType[] = [
  "chapters",
  "characters",
  "plotlines",
  "themes",
  "notes",
];
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences are optional. */
  }
}
const itemName = (item: BookDataItem, index: number) =>
  item.name?.trim() || (item.type === "notes"
    ? plainText(item.text).slice(0, 45) || `Note ${index + 1}`
    : `Untitled ${index + 1}`);

export default function WritingStudio() {
  const { id } = useParams();
  const { book, isLoadingBook, isErrorBook, errorBook } = useGetBook(id);
  if (isLoadingBook)
    return (
      <main className="ws ws-loading" role="status">
        Opening your manuscript…
      </main>
    );
  if (isErrorBook || !book)
    return (
      <main className="ws ws-loading">
        <h1>Unable to open this manuscript</h1>
        <p>
          {errorBook instanceof Error ? errorBook.message : "Please try again."}
        </p>
        <Link to="/books">Return to library</Link>
      </main>
    );
  return <Workspace key={`${book.userId}:${book.id}`} initialBook={book} />;
}

export function Workspace({ initialBook }: { initialBook: Book }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams();
  const [store] = useState(
    () =>
      new DraftStore(initialBook, bookApi.update, {
        getItem: key => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: key => localStorage.removeItem(key),
      }),
  );
  const [, render] = useReducer(n => n + 1, 0);
  const book = store.book;
  const scope = `roza:studio:${book.userId}:${book.id}`;
  const [category, setCategory] = useState<BooKDataItemType>(
    categories.includes(params.dataItemType as BooKDataItemType)
      ? (params.dataItemType as BooKDataItemType)
      : "chapters",
  );
  const [selected, setSelected] = useState(() => {
    const candidate =
      params.dataItemId ||
      (category === "chapters" ? preference(`${scope}:chapter`, "") : "");
    const available = book[category].filter(entry => !entry.isArchived);
    return available.some(entry => entry.id === candidate)
      ? candidate
      : available[0]?.id || "";
  });
  const [drawer, setDrawer] = useState(false);
  const [focus, setFocus] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notes, setNotes] = useState(true);
  const [summary, setSummary] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(
    () => preference("roza:studio:theme", "light") === "dark",
  );
  const [goal, setGoal] = useState(
    () => Number(preference(`${scope}:goal`, "50000")) || 50000,
  );
  const [size, setSize] = useState(() => preference("roza:studio:font", "20"));
  const [settings, setSettings] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);
  const [archived, setArchived] = useState<BookDataItem[]>([]);
  const items = book[category].filter(item => !item.isArchived);
  const item = items.find(item => item.id === selected);
  const filtered = items.filter((item, index) =>
    `${itemName(item, index)} ${plainText("text" in item ? item.text : item.description)}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const total = useMemo(() => manuscriptWords(book), [book]);
  const text = item ? ("text" in item ? item.text : item.description) : [];
  const visibleText = summary && item?.type === "chapters" ? item.description : text;

  useEffect(() => store.subscribe(render), [store]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (store.dirty || store.recovery) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const online = () => {
      if (store.state === "error" && !store.error.includes("changed"))
        void store.flush();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden" && store.state !== "error")
        void store.flush();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", hidden);
      store.dispose();
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      void queryClient.invalidateQueries({
        queryKey: ["book", initialBook.id],
      });
    };
  }, [store, queryClient, initialBook.id]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void store.flush();
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        setFocus(value => !value);
      }
      if (event.key === "Escape") {
        setFocus(false);
        setDrawer(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [store]);

  useEffect(() => setSummary(false), [selected, category]);

  function select(id: string) {
    setSummary(false);
    setSelected(id);
    setDrawer(false);
    setNotes(true);
    if (category === "chapters") remember(`${scope}:chapter`, id);
  }
  function updateItem(
    change:
      | Partial<BookDataItem>
      | { name: string }
      | { description: SlateCustomElement[] },
  ) {
    if (!item) return;
    store.edit(current => ({
      ...current,
      [category]: current[category].map(entry =>
        entry.id === item.id ? { ...entry, ...change } : entry,
      ),
    }));
  }
  function addItem() {
    const entry = {
      ...getDefaultBookDataItem({ bookId: book.id, type: category }),
      id: newId(),
    };
    if ("name" in entry)
      entry.name =
        category === "chapters" ? `Chapter ${items.length + 1}` : "Untitled";
    store.edit(current => ({
      ...current,
      [category]: [...current[category], entry],
    }));
    setSearch("");
    select(entry.id);
  }
  function duplicate() {
    if (!item) return;
    const copy = {
      ...structuredClone(item),
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    // Mongo's serialized subdocument _id must not survive duplication.
    delete (copy as unknown as Record<string, unknown>)._id;
    if ("name" in copy) copy.name += " — copy";
    store.edit(current => ({
      ...current,
      [category]: [...current[category], copy],
    }));
    select(copy.id);
  }
  function move(offset: number) {
    const index = items.findIndex(entry => entry.id === selected);
    if (index + offset < 0 || index + offset >= items.length) return;
    const ordered = [...items];
    [ordered[index], ordered[index + offset]] = [
      ordered[index + offset],
      ordered[index],
    ];
    store.edit(current => ({
      ...current,
      [category]: [
        ...ordered,
        ...current[category].filter(entry => entry.isArchived),
      ],
    }));
  }
  function archive() {
    if (
      !item ||
      !window.confirm(
        `Archive “${itemName(item, items.indexOf(item))}”? You can undo this here before leaving the studio.`,
      )
    )
      return;
    setArchived(current => [...current, item]);
    updateItem({ isArchived: true });
    select(items.find(entry => entry.id !== item.id)?.id || "");
  }
  async function leave() {
    await store.flush();
    if (
      store.dirty &&
      !window.confirm(
        "Your edits are not saved online. A local recovery draft will remain if browser storage is available. Leave the studio?",
      )
    )
      return;
    navigate("/books");
  }

  return (
    <main
      className={`ws ws-studio ${dark ? "ws-dark" : ""} ${focus ? "ws-focus" : ""}`}
      style={{ "--ws-font-size": `${size}px` } as React.CSSProperties}
    >
      <header className="ws-header">
        <button
          className="ws-back"
          onClick={() => void leave()}
          aria-label="Back to library"
        >
          ← <span>Library</span>
        </button>
        <div className="ws-book-heading">
          <span className="ws-eyebrow">ROZA / WRITING STUDIO</span>
          <input
            aria-label="Book title"
            value={book.name}
            disabled={!!store.recovery}
            onChange={event =>
              store.edit(current => ({ ...current, name: event.target.value }))
            }
            onBlur={() => {
              if (!book.name.trim())
                store.edit(current => ({
                  ...current,
                  name: "Untitled manuscript",
                }));
            }}
          />
        </div>
        <button
          className={`ws-save ws-save-${store.state}`}
          onClick={() => void store.flush()}
          aria-live="polite"
        >
          {
            {
              saved: "✓ All changes saved",
              pending: "Unsaved changes",
              saving: "Saving…",
              error: "Save failed · retry",
            }[store.state]
          }
        </button>
        <button
          onClick={() => setFocus(!focus)}
          aria-pressed={focus}
          title="Focus mode (Ctrl/Cmd+Shift+F)"
        >
          {focus ? "Exit focus" : "Focus"}
        </button>
        <button onClick={() => setSettings(!settings)} aria-expanded={settings}>
          Options
        </button>
      </header>
      {store.state === "error" && (
        <div className="ws-notice ws-error" role="alert">
          {store.error}{" "}
          <button onClick={() => download(book, "json")}>
            Download draft backup
          </button>
        </div>
      )}
      {store.storageError && (
        <div className="ws-notice ws-error" role="alert">
          Browser recovery storage is unavailable or full. Keep this page open
          until saved, or download a backup.
        </div>
      )}
      {store.recovery && (
        <div className="ws-notice" role="alert">
          <strong>A local draft is waiting.</strong>{" "}
          {store.canRestore()
            ? "Restore your unsaved writing or keep the server version."
            : "The server version changed. Download your draft to compare before discarding it."}{" "}
          {store.canRestore() && (
            <button
              onClick={() => {
                store.restore();
                setRestoreKey(n => n + 1);
              }}
            >
              Restore draft
            </button>
          )}
          <button onClick={() => download(store.recovery!.book, "json")}>
            Download recovery draft
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Discard the local recovery draft and keep the server version?",
                )
              )
                store.discardRecovery();
            }}
          >
            Keep server version
          </button>
        </div>
      )}
      {settings && (
        <section className="ws-options" aria-label="Studio options">
          <label>
            Appearance{" "}
            <select
              value={dark ? "dark" : "light"}
              onChange={event => {
                setDark(event.target.value === "dark");
                remember("roza:studio:theme", event.target.value);
              }}
            >
              <option value="light">Roza light</option>
              <option value="dark">Roza dark</option>
            </select>
          </label>
          <label>
            Text size{" "}
            <select
              value={size}
              onChange={event => {
                setSize(event.target.value);
                remember("roza:studio:font", event.target.value);
              }}
            >
              <option value="18">Small</option>
              <option value="20">Comfortable</option>
              <option value="24">Large</option>
            </select>
          </label>
          <label>
            Manuscript word goal{" "}
            <input
              type="number"
              min="1"
              max="10000000"
              value={goal}
              onChange={event => {
                const value = Math.max(1, Number(event.target.value));
                setGoal(value);
                remember(`${scope}:goal`, String(value));
              }}
            />
          </label>
          <button onClick={() => download(book, "json")}>
            Download backup (.json)
          </button>
          <button onClick={() => download(book, "html")}>
            Export manuscript (.html)
          </button>
          <p>
            HTML preserves formatting and chapter order. Open it in your browser
            to print or save as PDF. Backups include planning notes.
          </p>
          <p>
            Shortcuts: Ctrl/Cmd+S save · Ctrl/Cmd+B/I/U formatting · Ctrl/Cmd+Z
            undo · Ctrl/Cmd+Shift+F focus · Esc exit focus. Browser find remains
            available.
          </p>
        </section>
      )}
      <div className="ws-layout">
        <button
          className="ws-mobile-nav"
          onClick={() => setDrawer(!drawer)}
          aria-expanded={drawer}
          aria-controls="studio-navigation"
        >
          ☰ {category === "chapters" ? "Chapters" : "Planning"}{" "}
          <span>
            {item ? itemName(item, items.indexOf(item)) : "Choose a chapter"}
          </span>
        </button>
        <aside
          id="studio-navigation"
          className={`ws-sidebar ${drawer ? "ws-drawer-open" : ""}`}
          aria-label="Manuscript navigation"
        >
          <div className="ws-sidebar-top">
            <span className="ws-eyebrow">YOUR MANUSCRIPT</span>
            <button
              className="ws-drawer-close"
              onClick={() => setDrawer(false)}
              aria-label="Close chapter navigation"
            >
              ×
            </button>
          </div>
          <select
            aria-label="Manuscript category"
            value={category}
            onChange={event => {
              const type = event.target.value as BooKDataItemType;
              setCategory(type);
              setSelected(
                book[type].find(entry => !entry.isArchived)?.id || "",
              );
              setSearch("");
              setNotes(true);
            }}
          >
            {categories.map(type => (
              <option key={type} value={type}>
                {type[0].toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Search manuscript"
            placeholder="Search titles and text…"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <nav className="ws-chapters">
            {filtered.map(entry => (
              <button
                key={entry.id}
                aria-current={entry.id === selected ? "page" : undefined}
                onClick={() => select(entry.id)}
              >
                <span className="ws-chapter-number">
                  {String(items.indexOf(entry) + 1).padStart(2, "0")}
                </span>
                <span className="ws-chapter-label">
                  <strong dir="auto">
                    {itemName(entry, items.indexOf(entry))}
                  </strong>
                  <small>
                    {words(
                      "text" in entry ? entry.text : entry.description,
                    ).toLocaleString()}{" "}
                    words
                  </small>
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="ws-muted">
                {search ? "No matching pages." : "A fresh page awaits."}
              </p>
            )}
          </nav>
          <button
            className="ws-add"
            disabled={!!store.recovery}
            onClick={addItem}
          >
            ＋ {category === "chapters" ? "Add chapter" : "Add page"}
          </button>
          <div className="ws-progress">
            <span>
              {total.toLocaleString()}{" "}
              <small>/ {goal.toLocaleString()} words</small>
            </span>
            <progress
              value={Math.min(total, goal)}
              max={goal}
              aria-label="Manuscript goal"
            />
            <small>
              {Math.round((total / goal) * 100)}% of your manuscript goal
            </small>
          </div>
        </aside>
        <section className="ws-writing" aria-label="Writing workspace">
          {item ? (
            <>
              <div className="ws-document-actions">
                <span className="ws-eyebrow">
                  {category === "chapters"
                    ? `CHAPTER ${String(items.indexOf(item) + 1).padStart(2, "0")}`
                    : category.toUpperCase()}
                </span>
                <div>
                  <button
                    onClick={() => setPreview(!preview)}
                    aria-pressed={preview}
                  >
                    {preview ? "Edit" : "Read"}
                  </button>
                  {category === "chapters" && (
                    <button type="button" onClick={() => setSummary(value => !value)} aria-expanded={summary} aria-controls="ws-chapter-summary">
                      Summary
                    </button>
                  )}
                  {category === "chapters" && (
                    <button
                      onClick={() => { setNotes(summary ? true : !notes); setSummary(false); }}
                      aria-pressed={notes}
                    >
                      Chapter notes
                    </button>
                  )}
                  <details
                    className="ws-item-menu"
                    onClick={event => {
                      if ((event.target as HTMLElement).closest("button"))
                        event.currentTarget.removeAttribute("open");
                    }}
                  >
                    <summary>More</summary>
                    <div>
                      <button
                        disabled={!!store.recovery}
                        onClick={() => move(-1)}
                      >
                        Move up
                      </button>
                      <button
                        disabled={!!store.recovery}
                        onClick={() => move(1)}
                      >
                        Move down
                      </button>
                      <button disabled={!!store.recovery} onClick={duplicate}>
                        Duplicate
                      </button>
                      <button disabled={!!store.recovery} onClick={archive}>
                        Archive page
                      </button>
                    </div>
                  </details>
                </div>
              </div>
              <article className={`ws-page ${summary && item.type === "chapters" ? "ws-summary-mode" : ""}`}>
                <input
                    dir="auto"
                    className="ws-chapter-title"
                    aria-label={category === "notes" ? "Note title" : "Chapter or page title"}
                    value={item.name || ""}
                    readOnly={preview || !!store.recovery}
                    placeholder={category === "notes" ? "Untitled note" : "Untitled"}
                    onChange={event => updateItem({ name: event.target.value })}
                  />

                {summary && item.type === "chapters" ? (
                  <section id="ws-chapter-summary" className="ws-chapter-summary" aria-label="Chapter summary">
                    <header>
                      <h2>Chapter summary</h2>
                      <button type="button" onClick={() => setSummary(false)} aria-label="Close chapter summary">Close</button>
                    </header>
                    <ManuscriptEditor
                      key={`${item.id}:summary:${restoreKey}`}
                      value={item.description}
                      label="Chapter summary"
                      placeholder="Summarize what happens in this chapter…"
                      readOnly={preview || !!store.recovery}
                      onChange={description => updateItem({ description })}
                    />
                  </section>
                ) : (
                <ManuscriptEditor
                  key={`${item.id}:${restoreKey}`}
                  value={text}
                  readOnly={preview || !!store.recovery}
                  annotations={
                    item.type === "chapters"
                      ? item.annotations || []
                      : undefined
                  }
                  showAnnotations={notes}
                  onRevealAnnotations={() => setNotes(true)}
                  onChange={(value, annotations) =>
                    updateItem(
                      item.type === "chapters"
                        ? { text: value, annotations }
                        : "text" in item
                          ? { text: value }
                          : { description: value },
                    )
                  }
                />
                )}
                <footer className="ws-page-footer">
                  <span>
                    {words(visibleText).toLocaleString()} words ·{" "}
                    {Math.max(1, Math.ceil(words(visibleText) / 200))} min read
                  </span>
                  <span>
                    {preview
                      ? "Reading preview"
                      : "Make room for your next idea."}
                  </span>
                </footer>
              </article>
            </>
          ) : (
            <div className="ws-empty">
              <span className="ws-eyebrow">A PLACE FOR YOUR STORY</span>
              <h1>
                Every book starts
                <br />
                with a blank page.
              </h1>
              <p>
                Add your first{" "}
                {category === "chapters" ? "chapter" : "planning page"}, and
                make it yours.
              </p>
              <button
                className="ws-primary"
                disabled={!!store.recovery}
                onClick={addItem}
              >
                ＋{" "}
                {category === "chapters" ? "Create a chapter" : "Create a page"}
              </button>
            </div>
          )}
          {!!archived.length && (
            <div className="ws-notice">
              Page archived.{" "}
              <button
                onClick={() => {
                  const entry = archived[archived.length - 1];
                  store.edit(current => ({
                    ...current,
                    [entry.type]: current[entry.type].map(i =>
                      i.id === entry.id ? { ...i, isArchived: false } : i,
                    ),
                  }));
                  setCategory(entry.type);
                  setSelected(entry.id);
                  setArchived(current => current.slice(0, -1));
                }}
              >
                Undo archive
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
