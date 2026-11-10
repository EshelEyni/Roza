import { ChapterPlanning } from "./ChapterPlanning";
import { ChapterFormatDialog } from "./ChapterFormatDialog";
import { proseBlocks, screenplayStart } from "./screenplay";
import { downloadScreenplayPdf } from "./screenplayPdf";
import { ItemMenu } from "./ItemMenu";
import { CategorySelect } from "./CategorySelect";
import {
  sectionLabel,
  studioSections,
  StudioSection,
} from "./studioNavigation";
import { useConfirmation } from "../Modals/useConfirmation";
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
import { ChapterOverview } from "./ChapterOverview";
import "./writingStudio.css";
import { TaskBoardView } from "./TaskBoard";

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
  item.name?.trim() ||
  (item.type === "notes"
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
  const { confirm, confirmationDialog } = useConfirmation();
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requested =
    searchParams.get("workspace") || params.dataItemType || "chapters";
  const section: StudioSection = studioSections.includes(
    requested as StudioSection,
  )
    ? (requested as StudioSection)
    : "chapters";
  const overview = section === "overview";
  const tasks = section === "tasks";
  const [taskTarget, setTaskTarget] = useState("");
  const planningNavigation = {
    onChapter: (id: string) => {
      setSelection(current => ({ ...current, chapters: id }));
      changeSection("chapters");
    },
    onEntity: (
      kind: import("../../../../shared/types/books").StoryKind,
      id: string,
    ) => {
      setSelection(current => ({ ...current, [kind]: id }));
      changeSection(kind);
    },
    onTask: (id: string) => {
      setTaskTarget(id);
      changeSection("tasks");
    },
  };
  const category: BooKDataItemType =
    overview || tasks ? "chapters" : (section as BooKDataItemType);
  const [selection, setSelection] = useState<
    Partial<Record<BooKDataItemType, string>>
  >(() => {
    const entries = (
      [
        "chapters",
        "characters",
        "plotlines",
        "themes",
        "notes",
      ] as BooKDataItemType[]
    ).map(type => {
      const candidate =
        params.dataItemType === type
          ? params.dataItemId
          : type === "chapters"
            ? preference(`${scope}:chapter`, "")
            : "";
      const pages = book[type].filter(entry => !entry.isArchived);
      return [
        type,
        pages.find(entry => entry.id === candidate)?.id || pages[0]?.id || "",
      ];
    });
    return Object.fromEntries(entries);
  });
  const available = book[category].filter(entry => !entry.isArchived);
  const selected = available.some(entry => entry.id === selection[category])
    ? selection[category]!
    : available[0]?.id || "";
  function setSelected(id: string) {
    setSelection(current => ({ ...current, [category]: id }));
  }
  function changeSection(next: StudioSection) {
    if (next !== section)
      setSearchParams(current => {
        const nextParams = new URLSearchParams(current);
        nextParams.set("workspace", next);
        return nextParams;
      });
    setDrawer(false);
    setFocus(false);
    setSearch("");
    setNotes(true);
    setSummary(false);
    setChapterBible(false);
  }
  const [drawer, setDrawer] = useState(false);
  const [focus, setFocus] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notes, setNotes] = useState(true);
  const [summary, setSummary] = useState(false);
  const [chapterBible, setChapterBible] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(
    () => preference("roza:studio:theme", "light") === "dark",
  );
  const [goal, setGoal] = useState(
    () => Number(preference(`${scope}:goal`, "50000")) || 50000,
  );
  const [size, setSize] = useState(() => preference("roza:studio:font", "20"));
  const [settings, setSettings] = useState(false);
  const [formatChapter, setFormatChapter] = useState<string | null>(null);
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
  const visibleText =
    summary && item?.type === "chapters" ? item.description : text;

  useEffect(() => store.subscribe(render), [store]);
  useEffect(() => {
    if (category === "chapters" && selected)
      remember(`${scope}:chapter`, selected);
  }, [category, scope, selected]);
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

  useEffect(() => {
    setSummary(false);
    setChapterBible(false);
  }, [selected, category]);

  function select(id: string) {
    setSummary(false);
    setSelected(id);
    if (overview || tasks) changeSection("chapters");
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
  async function archive() {
    if (
      !item ||
      !(await confirm({
        title: "Archive this page?",
        message: `Archive “${itemName(item, items.indexOf(item))}”? You can undo this here before leaving the studio.`,
        confirmLabel: "Archive",
      }))
    )
      return;
    setArchived(current => [...current, item]);
    updateItem({ isArchived: true });
    select(items.find(entry => entry.id !== item.id)?.id || "");
  }
  async function leave(destination = "/books") {
    await store.flush();
    if (
      store.dirty &&
      !(await confirm({
        title: "Leave with unsaved edits?",
        message:
          "Your edits are not saved online. A local recovery draft will remain if browser storage is available. Leave the studio?",
        confirmLabel: "Leave studio",
        cancelLabel: "Keep writing",
      }))
    )
      return;
    navigate(destination);
  }

  return (
    <main
      className={`ws ws-studio ${tasks ? "ws-tasks-open" : ""} ${dark ? "ws-dark" : ""} ${focus ? "ws-focus" : ""}`}
      style={{ "--ws-font-size": `${size}px` } as React.CSSProperties}
    >
      {confirmationDialog}
      {formatChapter &&
        item?.type === "chapters" &&
        item.id === formatChapter && (
          <ChapterFormatDialog
            key={item.id}
            value={item.format || "prose"}
            onClose={() => setFormatChapter(null)}
            onApply={format => {
              if (!store.recovery) {
                const text =
                  format === "prose"
                    ? proseBlocks(item.text)
                    : screenplayStart(item.text);
                updateItem({ format, text });
                if (text !== item.text) setRestoreKey(key => key + 1);
              }
              setFormatChapter(null);
            }}
          />
        )}
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
              store.edit(current => ({
                ...current,
                name: event.target.value,
              }))
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
            onClick={async () => {
              if (
                await confirm({
                  title: "Discard recovery draft?",
                  message:
                    "Discard the local recovery draft and keep the server version?",
                  confirmLabel: "Discard draft",
                })
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
          <button onClick={() => downloadScreenplayPdf(book)}>
            Export screenplay (.pdf)
          </button>
          <button onClick={() => download(book, "fountain")}>
            Export screenplay (.fountain)
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
          ☰ {sectionLabel(section)}{" "}
          <span>
            {!overview && !tasks && item
              ? itemName(item, items.indexOf(item))
              : "Choose a workspace"}
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
          <CategorySelect
            value={section}
            options={studioSections}
            onChange={changeSection}
          />
          {!overview && !tasks && (
            <>
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
            </>
          )}
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
        {overview && (
          <ChapterOverview
            book={book}
            store={store}
            planningNavigation={planningNavigation}
            selected={selected}
            onOpenChapter={chapterId => {
              setSelection(current => ({ ...current, chapters: chapterId }));
              changeSection("chapters");
            }}
            onChapterEdited={chapterId => {
              if (chapterId === selected) setRestoreKey(n => n + 1);
            }}
          />
        )}
        {tasks && (
          <div className="ws-task-surface">
            <TaskBoardView store={store} initialTaskId={taskTarget} />
          </div>
        )}
        <section
          className="ws-writing"
          aria-label="Writing workspace"
          style={overview || tasks ? { display: "none" } : undefined}
        >
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
                    onClick={() => {
                      setChapterBible(false);
                      setPreview(!preview);
                    }}
                    aria-pressed={preview}
                  >
                    {preview ? "Edit" : "Read"}
                  </button>
                  {category === "chapters" && (
                    <button
                      type="button"
                      onClick={() => {
                        setChapterBible(false);
                        setSummary(value => !value);
                      }}
                      aria-expanded={summary}
                      aria-controls="ws-chapter-summary"
                    >
                      {summary ? "Text" : "Summary"}
                    </button>
                  )}
                  {category === "chapters" && (
                    <button
                      onClick={() => {
                        setChapterBible(false);
                        setNotes(summary ? true : !notes);
                        setSummary(false);
                      }}
                      aria-pressed={notes}
                    >
                      Annotations
                    </button>
                  )}
                  <ItemMenu>
                    <summary>More</summary>
                    <div>
                      {item.type === "chapters" && !preview && (
                        <button
                          type="button"
                          disabled={!!store.recovery}
                          onClick={() => setFormatChapter(item.id)}
                        >
                          Chapter Format
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void leave(`/book/${book.id}`)}
                      >
                        Go to details
                      </button>
                      <button disabled={!!store.recovery} onClick={archive}>
                        Archive page
                      </button>
                    </div>
                  </ItemMenu>
                  {item.type === "chapters" && (
                    <button
                      aria-pressed={chapterBible}
                      aria-controls="ws-chapter-bible"
                      onClick={() => {
                        setChapterBible(value => !value);
                        setSummary(false);
                      }}
                    >
                      Chapter Bible
                    </button>
                  )}
                </div>
              </div>
              <article
                className={`ws-page ${chapterBible && item.type === "chapters" ? "ws-chapter-bible-page" : ""} ${summary && item.type === "chapters" ? "ws-summary-mode" : ""}`}
              >
                {!(chapterBible && item.type === "chapters") && (
                  <input
                    dir="auto"
                    className="ws-chapter-title"
                    aria-label={
                      category === "notes"
                        ? "Note title"
                        : "Chapter or page title"
                    }
                    value={item.name || ""}
                    readOnly={preview || !!store.recovery}
                    placeholder={
                      category === "notes" ? "Untitled note" : "Untitled"
                    }
                    onChange={event => updateItem({ name: event.target.value })}
                  />
                )}

                {chapterBible && item.type === "chapters" ? (
                  <div id="ws-chapter-bible">
                    <ChapterPlanning
                      key={`bible:${item.id}`}
                      page
                      store={store}
                      chapter={item}
                      {...planningNavigation}
                    />
                  </div>
                ) : (
                  <>
                    {summary && item.type === "chapters" ? (
                      <section
                        id="ws-chapter-summary"
                        className="ws-chapter-summary"
                        aria-label="Chapter summary"
                      >
                        <header>
                          <h2>Chapter summary</h2>
                          <button
                            type="button"
                            onClick={() => setSummary(false)}
                            aria-label="Close chapter summary"
                          >
                            Close
                          </button>
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
                        format={
                          item.type === "chapters" ? item.format : "prose"
                        }
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
                        {Math.max(1, Math.ceil(words(visibleText) / 200))} min
                        read
                      </span>
                      <span>
                        {preview
                          ? "Reading preview"
                          : "Make room for your next idea."}
                      </span>
                    </footer>
                  </>
                )}
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
                  setSelection(current => ({
                    ...current,
                    [entry.type]: entry.id,
                  }));
                  changeSection(entry.type);
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
