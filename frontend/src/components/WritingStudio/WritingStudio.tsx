import { FiArrowLeft, FiBook, FiBookOpen, FiChevronDown, FiEdit3 } from "react-icons/fi";
import { DraftPane } from "./DraftPane";
import { createChapterDraft, changeChapterDraft, draftDisplayName, draftTimestamp, isMainBackup, matchingMainDraft, promoteChapterDraft } from "./chapterDrafts";
import { Chapter, ChapterAnnotation } from "../../../../shared/types/books";
import { ChapterPlanning } from "./ChapterPlanning";
import { ChapterFormatDialog } from "./ChapterFormatDialog";
import { proseBlocks, screenplayStart } from "./screenplay";
import { downloadScreenplayPdf } from "./screenplayPdf";
import { ItemMenu } from "./ItemMenu";
import { SaveStatus } from "./SaveStatus";
import { CategorySelect } from "./CategorySelect";
import {
  sectionLabel,
  studioSections,
  StudioSection,
} from "./studioNavigation";
import { studioItemLabels } from "./studioItemLabels";
import { useConfirmation } from "../Modals/useConfirmation";
import { ReaderColorSelect } from "../Reader/ReaderColorSelect";
import "../Modals/confirmDialog.css";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { readerMarkTextColor, readerSelectionColor, readingSentenceBackground, readingSentenceTint, readingWordTextColor } from "../../services/readerMarkColors";
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
import { DraftStore, maxWordGoal } from "./draftStore";
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
import { AppSwitcher } from "../App/AppSwitcher";
import { StudioFullscreenButton } from "./StudioFullscreenButton";
import { PublishDialog } from "./PublishDialog";
import type { BookPublishing } from "../../../../shared/types/books";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";

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
const wordColorKey = "roza:studio:word-highlight";
const sentenceColorKey = "roza:studio:sentence-highlight";
const wordTextColorKey = "roza:studio:word-highlight-text";
const sentenceTextColorKey = "roza:studio:sentence-highlight-text";
function colorPreference(key: string, fallback: string) {
  const value = preference(key, fallback);
  return /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
}

function markForeground(color: string) {
  const [red, green, blue] = [1, 3, 5].map(start => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 0.23
    ? "#ffffff"
    : readerMarkTextColor;
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
  const readerAccess = useFeatureAccess("reader");
  const publishingAccess = useFeatureAccess("studioPublishing");
  const canPublish = readerAccess && publishingAccess;
  const { loggedInUser } = useLoginWithToken();
  // The EPUB settings and cover live outside the draft store. The store copies
  // the manuscript into browser storage on every edit, and a cover is large.
  const [publishing, setPublishing] = useState<BookPublishing | undefined>(initialBook.publishing);
  const [publishOpen, setPublishOpen] = useState(false);
  const [store] = useState(
    () =>
      new DraftStore({ ...initialBook, publishing: undefined }, bookApi.update, {
        getItem: key => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: key => localStorage.removeItem(key),
      }),
  );
  const [, render] = useReducer(n => n + 1, 0);
  const book = store.book;
  const scope = `roza:studio:${book.userId}:${book.id}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const urlParams = useRef(searchParams);
  urlParams.current = searchParams;
  function updateStudioUrl(changes: Record<string, string | undefined>, replace = false) {
    const next = new URLSearchParams(urlParams.current);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    if (next.toString() === urlParams.current.toString()) return;
    urlParams.current = next;
    setSearchParams(next, { replace, preventScrollReset: true });
  }
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
  const [taskChapterTarget, setTaskChapterTarget] = useState<string>();
  const planningNavigation = {
    onChapter: (id: string) => {
      setSelection(current => ({ ...current, chapters: id }));
      changeSection("chapters", id);
    },
    onEntity: (
      kind: import("../../../../shared/types/books").StoryKind,
      id: string,
    ) => {
      setSelection(current => ({ ...current, [kind]: id }));
      changeSection(kind, id);
    },
    onTask: (id: string) => {
      changeSection("tasks");
      setTaskChapterTarget(book.chapters.find(c => c.taskBoard?.lists.some(l => l.cards.some(card => card.id === id)))?.id);
      setTaskTarget(id);
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
  const requestedItem = searchParams.get("studioItem");
  const selected = available.find(entry => entry.id === requestedItem)?.id ||
    available.find(entry => entry.id === selection[category])?.id || available[0]?.id || "";
  function setSelected(id: string) {
    setSelection(current => ({ ...current, [category]: id }));
    if (id !== selected) updateStudioUrl({
      studioItem: id, draft: undefined, audiobook: undefined, line: undefined, word: undefined,
      tab: view === "bible" ? "write" : view,
    });
  }
  function changeSection(next: StudioSection, itemId?: string) {
    setTaskChapterTarget(undefined);
    if (next !== section || itemId) updateStudioUrl({
      workspace: next, studioItem: itemId, tab: "write", draft: undefined,
      audiobook: undefined, line: undefined, word: undefined,
    });
    setDrawer(false);
    setSearch("");
  }
  const draftId = searchParams.get("draft") || "";
  const [visitedDrafts, setVisitedDrafts] = useState<string[]>([]);
  const [mobilePane, setMobilePane] = useState("draft");
  const [audiobookHeader, setAudiobookHeader] = useState<HTMLDivElement | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [showInlineNotes, setShowInlineNotes] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(
    () => preference("roza:studio:theme", "light") === "dark",
  );
  const [goalInput, setGoalInput] = useState<string | null>(null);
  const goal = store.wordGoal;
  const [size, setSize] = useState(() => preference("roza:studio:font", "20"));
  const optionsDialog = useRef<HTMLDialogElement>(null);
  const optionsTitle = useId();
  const [wordColor, setWordColor] = useState(() => colorPreference(wordColorKey, readerSelectionColor));
  const [sentenceColor, setSentenceColor] = useState(() => colorPreference(sentenceColorKey, readingSentenceTint));
  const [wordTextColor, setWordTextColor] = useState(() => colorPreference(wordTextColorKey, readingWordTextColor));
  const [sentenceTextColor, setSentenceTextColor] = useState(() => colorPreference(sentenceTextColorKey, "#302923"));
  const wordForeground = wordTextColor || markForeground(wordColor);
  const sentenceForeground = sentenceTextColor || markForeground(sentenceColor);
  const [formatChapter, setFormatChapter] = useState<string | null>(null);
  const [restoreKey, setRestoreKey] = useState(0);
  const [removed, setRemoved] = useState<BookDataItem[]>([]);
  const labels = studioItemLabels(category);
  const lastRemoved = removed[removed.length - 1];
  const items = book[category].filter(item => !item.isArchived);
  const item = items.find(item => item.id === selected);
  const filtered = items.filter((item, index) =>
    `${itemName(item, index)} ${plainText("text" in item ? item.text : item.description)}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const chapter = !overview && !tasks && item?.type === "chapters" ? item : undefined;
  const activeDraft = chapter?.drafts?.find(d => d.id === draftId);
  const drafts = chapter?.drafts?.filter(draft => !isMainBackup(draft)) ?? [];
  const mainBackups = chapter?.drafts?.filter(isMainBackup).reverse() ?? [];
  const mainSourceDraft = chapter?.drafts?.find(draft => draft.id === chapter.mainSourceDraftId);
  const matchingDraft = chapter && !chapter.mainSourceDraftId && mainBackups.length > 0
    ? matchingMainDraft(chapter, drafts)
    : undefined;
  const mainSourceLabel = mainSourceDraft
    ? isMainBackup(mainSourceDraft) ? "Restored from backup" : `Promoted from ${mainSourceDraft.name}`
    : matchingDraft ? `Matches ${matchingDraft.name}` : undefined;
  function openDraft(id: string, reading = preview) {
    setVisitedDrafts(ids => ids.includes(id) ? ids : [...ids, id]);
    updateStudioUrl({ studioItem: selected, draft: id, tab: reading ? "read" : "write",
      audiobook: undefined, line: undefined, word: undefined });
    setDrawer(false); setMobilePane("draft");
  }
  function closeDraft() {
    if (!draftId) return;
    updateStudioUrl({ draft: undefined, audiobook: undefined, line: undefined, word: undefined });
  }
  function editChapter(change: (chapter: Chapter) => Chapter, chapterId = chapter?.id) {
    if (!chapterId) return;
    store.edit(current => ({ ...current, chapters: current.chapters.map(c => c.id === chapterId ? change(c) : c) }));
  }
  function addDraft(blank = false) {
    if (!chapter || store.recovery) return;
    let number = drafts.length + 1;
    while (drafts.some(draft => draft.name === `Draft ${number}`)) number++;
    const draft = createChapterDraft(chapter, `Draft ${number}`, blank);
    editChapter(c => ({ ...c, drafts: [...(c.drafts || []), draft] }));
    openDraft(draft.id, false);
  }
  function aiDraft(text: SlateCustomElement[], annotations: ChapterAnnotation[], name: string) {
    if (!chapter || store.recovery) return;
    const draft = { ...createChapterDraft(chapter, name), text, annotations, format: activeDraft?.format || chapter.format };
    editChapter(c => ({ ...c, drafts: [...(c.drafts || []), draft] })); openDraft(draft.id);
  }
  async function promoteDraft() {
    if (!chapter || !activeDraft) return;
    const chapterId = chapter.id, id = activeDraft.id;
    const restoring = isMainBackup(activeDraft);
    const action = restoring ? "Restore to Main" : "Promote to Main";
    const message = restoring
      ? "Restore this backup to Main? The current Main will be saved under Main backups."
      : `Replace Main with “${activeDraft.name}”? The current Main will be saved under Main backups.`;
    if (await confirm({ title: `${action}?`, message, confirmLabel: action })) {
      editChapter(c => c.drafts?.some(d => d.id === id) ? promoteChapterDraft(c, id) : c, chapterId);
      setRestoreKey(n => n + 1);
      closeDraft();
    }
  }
  async function deleteDraft() {
    if (!chapter || !activeDraft) return;
    const chapterId = chapter.id, id = activeDraft.id;
    const action = isMainBackup(activeDraft) ? "Delete backup" : "Delete draft";
    if (await confirm({ title: `${action}?`, message: `Permanently delete “${draftDisplayName(activeDraft)}”? Main will be preserved.`, confirmLabel: action })) {
      editChapter(c => ({
        ...c,
        mainSourceDraftId: c.mainSourceDraftId === id ? undefined : c.mainSourceDraftId,
        drafts: c.drafts?.filter(d => d.id !== id),
      }), chapterId);
      closeDraft();
    }
  }
  const total = useMemo(() => manuscriptWords(book), [book]);
  const text = item ? ("text" in item ? item.text : item.description) : [];
  const chapterText = category === "chapters" ? plainText(text).trim() : "";
  const chapterLineCount = chapterText ? chapterText.split(/\r\n?|\n/).length : 0;
  const pageControls = !!item && !overview && !tasks;
  const isChapter = item?.type === "chapters";
  const tab = searchParams.get("tab");
  const view = tab === "read" ? "read" : isChapter && (tab === "summary" || tab === "bible") ? "bible" : "write";
  const preview = view === "read";
  const chapterBible = view === "bible";
  const line = searchParams.get("line");
  const word = searchParams.get("word");
  const readingPosition = {
    value: line ? `${line}:${word || "0"}` : null,
    onChange: (number: number, index: number) => updateStudioUrl({
      studioItem: selected, line: String(number), word: index ? String(index) : undefined,
    }, true),
  };
  const audiobookState = {
    open: searchParams.get("audiobook") === "open",
    onChange: (open: boolean) => updateStudioUrl({
      studioItem: selected, audiobook: open ? "open" : undefined,
    }, true),
  };
  const pageContext = item
    ? category === "chapters"
      ? `CHAPTER ${String(items.indexOf(item) + 1).padStart(2, "0")} · ${words(text).toLocaleString()} WORDS · ${chapterLineCount.toLocaleString()} LINES`
      : category.toUpperCase()
    : "WRITING STUDIO";
  function showView(next: typeof view) {
    if (next === view) return;
    if (next === "read") {
      setDrawer(false);
      if (activeDraft) setMobilePane("draft");
    }
    updateStudioUrl({
      tab: next, studioItem: selected, draft: next === "bible" ? undefined : draftId || undefined,
      audiobook: undefined,
      ...(next === "bible" && draftId ? { line: undefined, word: undefined } : {}),
    });
  }

  useEffect(() => store.subscribe(render), [store]);
  const recovery = store.recovery;
  useEffect(() => {
    if (recovery) return;
    const migration = setTimeout(store.migrateWordGoal, 0);
    return () => clearTimeout(migration);
  }, [store, recovery]);
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
      if (event.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [store]);

  useEffect(() => {
    setVisitedDrafts([]);
  }, [selected, category]);

  function select(id: string) {
    if (overview || tasks) changeSection("chapters", id);
    else setSelected(id);
    setDrawer(false);
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
  async function removeItem() {
    if (
      !item ||
      !(await confirm({
        title: labels.removeTitle,
        message: labels.removeMessage(itemName(item, items.indexOf(item))),
        confirmLabel: "Delete",
      }))
    )
      return;
    // A soft delete: the item is archived, so links to it stay valid.
    setRemoved(current => [...current, item]);
    updateItem({ isArchived: true });
    select(items.find(entry => entry.id !== item.id)?.id || "");
  }
  function undoRemove() {
    const entry = lastRemoved;
    if (!entry) return;
    store.edit(current => ({
      ...current,
      [entry.type]: current[entry.type].map(i =>
        i.id === entry.id ? { ...i, isArchived: false } : i,
      ),
    }));
    setSelection(current => ({ ...current, [entry.type]: entry.id }));
    changeSection(entry.type, entry.id);
    setRemoved(current => current.slice(0, -1));
  }
  async function archiveBook() {
    if (
      !(await confirm({
        title: "Archive this book?",
        message: `Archive “${book.name}”? It will be removed from your library. Its data is retained, but restoring a whole book currently requires support.`,
        confirmLabel: "Archive",
      }))
    )
      return;
    await store.flush();
    try {
      await bookApi.archive(book.id);
    } catch (error) {
      await confirm({
        title: "Book not archived",
        message: error instanceof Error ? error.message : "Unable to archive the manuscript. Please try again.",
        confirmLabel: "OK",
        cancelLabel: "Close",
      });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["books"] });
    navigate("/books");
  }
  async function prepareForPublishing() {
    await store.flush();
    return !store.dirty && store.state !== "error" && !store.recovery;
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
      className={`ws ws-studio ${tasks ? "ws-tasks-open" : ""} ${dark ? "ws-dark" : ""} ${activeDraft ? "ws-draft-mode" : ""}`}
      style={{
        "--ws-font-size": `${size}px`,
        "--ws-word-highlight": wordColor,
        "--ws-word-highlight-text": wordForeground,
        "--ws-sentence-highlight": sentenceColor,
        "--ws-sentence-focus": readingSentenceBackground(sentenceColor),
        "--ws-sentence-highlight-text": sentenceForeground,
      } as React.CSSProperties}
    >
      {confirmationDialog}
      {publishOpen && canPublish && (
        <PublishDialog
          book={{ ...book, publishing }}
          author={loggedInUser?.fullname || ""}
          prepare={prepareForPublishing}
          onPublished={result => {
            setPublishing(result);
            void queryClient.invalidateQueries({ queryKey: ["books"] });
            void queryClient.invalidateQueries({ queryKey: ["readerBooks"] });
          }}
          onOpenReader={id => {
            setPublishOpen(false);
            void leave(`/reader/${id}`);
          }}
          onClose={() => setPublishOpen(false)}
        />
      )}
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
          <FiArrowLeft aria-hidden="true" /> <span>Library</span>
        </button>
        <div className="ws-book-heading">
          <span className="ws-eyebrow">{pageContext}</span>
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
        {pageControls && (
          <div className="ws-header-views">
            <div className="ws-segmented" data-view={view} role="group" aria-label="Page view">
              <button aria-pressed={view === "write"} onClick={() => showView("write")}>
                <FiEdit3 aria-hidden="true" />
                Write
              </button>
              <button
                aria-pressed={view === "read"}
                onClick={() => showView("read")}
              >
                <FiBookOpen aria-hidden="true" />
                Read
              </button>
            </div>
          </div>
        )}
        <div className="ws-header-end">
          <div className="ws-header-audiobook" ref={setAudiobookHeader} />
          <SaveStatus
            state={store.state}
            savedAt={store.savedAt}
            onSave={() => void store.flush()}
          />
          {pageControls && isChapter && (
            <button
              type="button"
              className="ws-bible-button"
              aria-pressed={chapterBible}
              aria-controls={chapterBible ? "ws-chapter-bible" : undefined}
              aria-label="Chapter Bible"
              onClick={() => showView("bible")}
            >
              <FiBook aria-hidden="true" />
              Bible
            </button>
          )}
          {chapter && (
            <ItemMenu>
              <summary className="ws-version" title="Chapter versions">
                <span className="ws-version-label">{activeDraft ? draftDisplayName(activeDraft) : "Main"}</span>
                <small> · {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}</small>
                <FiChevronDown aria-hidden="true" />
              </summary>
              <div className="ws-version-menu">
                <span className="ws-eyebrow">VERSIONS</span>
                {drafts.map(d => (
                  <button
                    key={d.id}
                    aria-current={d.id === activeDraft?.id || undefined}
                    onClick={() => openDraft(d.id)}
                  >
                    <span className="ws-version-name" title={d.name}>{draftDisplayName(d)}</span>
                    {(d.id === mainSourceDraft?.id || d.id === matchingDraft?.id) && (
                      <span className="ws-version-source">
                        {d.id === mainSourceDraft?.id ? "Promoted to Main" : "Matches Main"}
                      </span>
                    )}
                    <small className="ws-version-meta">{draftTimestamp(d)}</small>
                    {d.summary?.trim() && (
                      <span className="ws-version-summary" dir="auto">{d.summary.trim()}</span>
                    )}
                  </button>
                ))}
                <hr />
                <button disabled={!!store.recovery} onClick={() => addDraft()}>
                  Create draft from Main
                </button>
                <button disabled={!!store.recovery} onClick={() => addDraft(true)}>
                  Create blank draft
                </button>
                {mainBackups.length > 0 && (
                  <details className="ws-main-backups">
                    <summary>Main backups ({mainBackups.length})</summary>
                    {mainBackups.map(backup => (
                      <button key={backup.id} aria-current={backup.id === activeDraft?.id || undefined}
                        onClick={() => openDraft(backup.id, false)}>
                        {draftTimestamp(backup) || "Main backup"}
                        {backup.id === mainSourceDraft?.id && <small className="ws-version-meta">Restored to Main</small>}
                      </button>
                    ))}
                  </details>
                )}
              </div>
            </ItemMenu>
          )}
          <ItemMenu>
            <summary className="ws-more" aria-label="More" title="More">
              •••
            </summary>
            <div className="ws-more-menu">
              {pageControls && item && (
                <>
                  <span className="ws-eyebrow">
                    {labels.menuHeading}
                  </span>
                  {item.type === "chapters" && !preview && (
                    <button
                      type="button"
                      disabled={!!store.recovery || !!activeDraft}
                      onClick={() => setFormatChapter(item.id)}
                    >
                      Chapter Format
                    </button>
                  )}
                  <button disabled={!!store.recovery} onClick={removeItem}>
                    {labels.remove}
                  </button>
                  <hr />
                </>
              )}
              <span className="ws-eyebrow">STUDIO</span>
              <StudioFullscreenButton />
              {canPublish && (
                <button
                  type="button"
                  disabled={!!store.recovery}
                  onClick={() => setPublishOpen(true)}
                  aria-haspopup="dialog"
                >
                  Publish EPUB
                </button>
              )}
              <button
                type="button"
                onClick={() => optionsDialog.current?.showModal()}
                aria-haspopup="dialog"
              >
                Options
              </button>
              <button
                type="button"
                className="ws-menu-danger"
                disabled={!!store.recovery}
                onClick={() => void archiveBook()}
              >
                Archive book
              </button>
            </div>
          </ItemMenu>
          <AppSwitcher
            triggerClassName="ws-app-switcher"
            onNavigate={path => void leave(path)}
          />
        </div>
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
      <dialog
        ref={optionsDialog}
        className="app-confirm-dialog ws-options-dialog"
        aria-labelledby={optionsTitle}
        onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
      >
        <header>
          <h2 id={optionsTitle}>Studio options</h2>
          <button type="button" onClick={() => optionsDialog.current?.close()}>Close</button>
        </header>
        <div className="ws-options">
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
              max={maxWordGoal}
              value={goalInput ?? goal}
              disabled={!!store.recovery}
              onBlur={() => setGoalInput(null)}
              onChange={event => {
                setGoalInput(event.target.value);
                store.setWordGoal(event.target.valueAsNumber);
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
            undo. Browser find remains
            available.
          </p>
          {([
            ["Word highlight color", "highlight", wordColorKey, wordColor, setWordColor],
            ["Word text color", "text", wordTextColorKey, wordForeground, setWordTextColor],
            ["Sentence highlight color", "highlight", sentenceColorKey, sentenceColor, setSentenceColor],
            ["Sentence text color", "text", sentenceTextColorKey, sentenceForeground, setSentenceTextColor],
          ] as const).map(([label, kind, key, value, setColor]) => {
            const labelId = `${optionsTitle}-${key}`;
            return (
              <div className="ws-option-color" key={key}>
                <span id={labelId}>{label}</span>
                <ReaderColorSelect labelId={labelId} label={label} kind={kind} value={value} onChange={color => {
                  setColor(color);
                  remember(key, color);
                }} />
              </div>
            );
          })}
        </div>
      </dialog>
      <div className={`ws-layout ${preview && item && !overview && !tasks ? "ws-reading" : ""}`}>
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
                    {search ? labels.noMatches : labels.emptyList}
                  </p>
                )}
              </nav>
              <button
                className="ws-add"
                disabled={!!store.recovery}
                onClick={addItem}
              >
                ＋ {labels.add}
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
              changeSection("chapters", chapterId);
            }}
            onChapterEdited={chapterId => {
              if (chapterId === selected) setRestoreKey(n => n + 1);
            }}
          />
        )}
        {tasks && (
          <div className="ws-task-surface">
            <TaskBoardView key={`${taskChapterTarget || "book"}:${taskTarget}`} store={store} initialTaskId={taskTarget} chapterId={taskChapterTarget} />
          </div>
        )}
        <section
          className="ws-writing"
          aria-label="Writing workspace"
          style={overview || tasks ? { display: "none" } : undefined}
        >
          {item ? (
            <>
              {activeDraft && <nav className="ws-draft-mobile-switch" aria-label="Writing panel"><button aria-pressed={mobilePane === "main"} onClick={() => setMobilePane("main")}>Main</button><button aria-pressed={mobilePane === "draft"} onClick={() => setMobilePane("draft")}>Draft</button></nav>}
              <div className={`ws-draft-layout ws-show-${mobilePane}`}>
              <article
                className={`ws-page ws-main-pane ${chapterBible && item.type === "chapters" ? "ws-chapter-bible-page" : ""}`}
              >
                {activeDraft && (
                  <h2 className="ws-main-label">
                    Main{mainSourceLabel && ` · ${mainSourceLabel}`}
                  </h2>
                )}
                {!(chapterBible && item.type === "chapters") && (
                  <input
                    dir="auto"
                    className="ws-chapter-title"
                    aria-label={labels.titleField}
                    value={item.name || ""}
                    readOnly={preview || !!store.recovery || !!activeDraft}
                    placeholder={labels.untitled}
                    onChange={event => updateItem({ name: event.target.value })}
                  />
                )}

                {chapterBible && item.type === "chapters" ? (
                  <div id="ws-chapter-bible">
                    <ChapterPlanning
                      key={`bible:${item.id}:${restoreKey}`}
                      page
                      showInlineNotes={showInlineNotes}
                      onShowInlineNotesChange={setShowInlineNotes}
                      store={store}
                      chapter={item}
                      {...planningNavigation}
                    />
                  </div>
                ) : (
                  <>
                    <ManuscriptEditor
                      primaryFindTarget={!activeDraft}
                      key={`${item.id}:${restoreKey}`}
                      format={
                        item.type === "chapters" ? item.format : "prose"
                      }
                      value={text}
                      aiEditing={chapter ? { bookId: book.id, chapterId: chapter.id, annotations: chapter.annotations, onDraft: aiDraft } : undefined}
                      readOnly={preview || !!store.recovery || !!activeDraft}
                      annotationsReadOnly={!!store.recovery || !!activeDraft}
                      reading={preview && !activeDraft}
                      readingPosition={pageControls ? readingPosition : undefined}
                      audiobookState={audiobookState}
                      audiobookHeader={audiobookHeader}
                      audiobook={chapter && view === "read" && pageControls && !activeDraft ? { id: chapter.id, title: chapter.name, manuscriptId: book.id } : undefined}
                      annotations={
                        item.type === "chapters"
                          ? item.annotations || []
                          : undefined
                      }
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
                    <footer className="ws-page-footer">
                      <span>
                        {words(text).toLocaleString()} words ·{" "}
                        {Math.max(1, Math.ceil(words(text) / 200))} min
                        read
                      </span>
                      <span className={preview ? undefined : "ws-writing-prompt"}>
                        {preview
                          ? "Reading preview"
                          : "Make room for your next idea."}
                      </span>
                    </footer>
                  </>
                )}
              </article>
              {chapter && chapter.drafts?.filter(d => d.id === draftId || visitedDrafts.includes(d.id)).map(draft => <DraftPane key={`${chapter.id}:${draft.id}:${restoreKey}`} chapter={chapter} draft={draft} active={draft.id === activeDraft?.id} readOnly={!!store.recovery || preview}
                manuscriptId={book.id}
                matchingMain={draft.id === matchingDraft?.id}
                reading={draft.id === activeDraft?.id && view === "read" && pageControls} audiobookKey={mobilePane} audiobookHeader={audiobookHeader}
                readingPosition={mobilePane === "draft" ? readingPosition : undefined} audiobookState={audiobookState}
                onSelect={openDraft} onClose={closeDraft} onPromote={() => void promoteDraft()} onDelete={() => void deleteDraft()}
                onChange={change => editChapter(c => changeChapterDraft(c, draft.id, change))}
                aiEditing={{ bookId: book.id, chapterId: chapter.id, onDraft: aiDraft }} />)}
              </div>
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
                Add your first {labels.noun}, and make it yours.
              </p>
              <button
                className="ws-primary"
                disabled={!!store.recovery}
                onClick={addItem}
              >
                ＋ {labels.create}
              </button>
            </div>
          )}
          {lastRemoved && (
            <div className="ws-notice">
              {studioItemLabels(lastRemoved.type).removedNotice}{" "}
              <button onClick={undoRemove}>Undo delete</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
