import { matchesPlanning } from "./planningModel";
import {
  ChapterPlanning,
  PlanningBadges,
  PlanningFilter,
  PlanningNavigation,
} from "./ChapterPlanning";
import { ItemMenu } from "./ItemMenu";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Book, Chapter } from "../../../../shared/types/books";
import { DraftStore } from "./draftStore";
import { newId, plainText, richTextHtml, words } from "./manuscript";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { getDefaultBookDataItem } from "../../services/bookUtilService";

function PreviewSummary({
  chapter,
  store,
}: {
  chapter: Chapter;
  store: DraftStore;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="ws-preview-summary" aria-label="Chapter summary">
      <div className="ws-preview-summary-heading">
        <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span> Chapter summary
        </button>
        <span role="status" className="ws-muted">
          {store.storageError && store.dirty
            ? "Local backup unavailable · "
            : ""}
          {store.state === "error"
            ? "Not saved online"
            : store.state === "saved"
              ? "Saved"
              : "Saving…"}
        </span>
        {store.state === "error" && (
          <button onClick={() => void store.flush()}>Retry save</button>
        )}
      </div>
      {expanded &&
        (plainText(chapter.description).trim() ? (
          <div
            dir="auto"
            dangerouslySetInnerHTML={{
              __html: richTextHtml(chapter.description),
            }}
          />
        ) : (
          <p className="ws-muted">No summary yet.</p>
        ))}
    </section>
  );
}

function Card({
  chapter,
  index,
  selected,
  locked,
  reorderLocked,
  onPreview,
  onEdit,
  onSummary,
  onRename,
  onDelete,
  book,
}: {
  book: Book;
  chapter: Chapter;
  index: number;
  selected: boolean;
  locked: boolean;
  reorderLocked: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onSummary: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: chapter.id, disabled: locked || reorderLocked });
  const summary = useMemo(
    () => plainText(chapter.description),
    [chapter.description],
  );
  const countWords = useMemo(() => words(chapter.text), [chapter.text]);
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(scrollTimer.current), []);
  return (
    <article
      ref={setNodeRef}
      className={`ws-board-card ${selected ? "is-selected" : ""} ${isDragging ? "is-dragging" : ""} ${isOver && !isDragging ? "is-over" : ""}`}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
    >
      <div className="ws-card-top">
        <span className="ws-eyebrow">
          CHAPTER {String(index + 1).padStart(2, "0")}
        </span>
        <button
          className="ws-drag-handle"
          disabled={locked || reorderLocked}
          aria-label={`Reorder ${chapter.name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </div>
      <button
        className="ws-card-preview"
        onClick={onPreview}
        aria-label={`Preview ${chapter.name || "Untitled chapter"}`}
      >
        <h2 dir="auto">{chapter.name || "Untitled chapter"}</h2>{chapter.format === "screenplay" && <small>Screenplay</small>}
      </button>
      <div
        className={`ws-card-summary${scrolling ? " is-scrolling" : ""}`}
        onScroll={() => {
          setScrolling(true);
          clearTimeout(scrollTimer.current);
          scrollTimer.current = setTimeout(() => setScrolling(false), 800);
        }}
        role="region"
        aria-label={`Summary for ${chapter.name || "Untitled chapter"}`}
        tabIndex={0}
        dir="auto"
      >
        {summary || "No summary yet. Give this chapter a place in your story."}
      </div>
      <PlanningBadges book={book} chapter={chapter} />
      <div className="ws-card-bottom">
        <small>{countWords.toLocaleString()} words</small>
        <button disabled={locked} onClick={onSummary}>
          {summary ? "Edit summary" : "Add summary"}
        </button>
        <button onClick={onEdit}>Edit chapter</button>
        <ItemMenu>
          <summary aria-label={`Actions for ${chapter.name}`}>More</summary>
          <div>
            <button disabled={locked} onClick={onRename}>
              Rename
            </button>
            <button disabled={locked} onClick={onDelete}>
              Delete chapter
            </button>
          </div>
        </ItemMenu>
      </div>
    </article>
  );
}

export function ChapterOverview({
  book,
  store,
  selected,
  onChapterEdited,
  onOpenChapter,
  planningNavigation,
}: {
  book: Book;
  store: DraftStore;
  planningNavigation: PlanningNavigation;
  selected: string;
  onChapterEdited: (id: string) => void;
  onOpenChapter: (id: string) => void;
}) {
  const chapters = useMemo(
    () => book.chapters.filter(c => !c.isArchived),
    [book.chapters],
  );
  const [planningFilter, setPlanningFilter] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const edited = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const preview = chapters.find(c => c.id === previewId);
  const summary = chapters.find(c => c.id === summaryId);
  const editing = chapters.find(c => c.id === editId);
  const current = editing || preview || summary;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const stats = useMemo(
    () => ({
      words: chapters.reduce((n, c) => n + words(c.text), 0),
      missing: chapters.filter(c => !plainText(c.description).trim()).length,
    }),
    [chapters],
  );
  useEffect(() => {
    if (current && !dialog.current?.open) {
      origin.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    }
    if (!current && dialog.current?.open) {
      dialog.current.close();
      origin.current?.focus();
    }
  }, [current]);
  useEffect(() => {
    if (!editId) return;
    const frame = requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLElement>('[aria-label="Chapter manuscript"]')
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [editId]);
  useEffect(() => {
    if (previewId)
      dialog.current
        ?.querySelector<HTMLElement>('[aria-label="Close chapter panel"]')
        ?.focus();
  }, [previewId]);
  function closePanel() {
    void store.flush();
    if (editId && edited.current) onChapterEdited(editId);
    edited.current = false;
    setEditId(null);
    setPreviewId(null);
    setSummaryId(null);
  }
  function update(id: string, change: Partial<Chapter>) {
    store.edit(b => ({
      ...b,
      chapters: b.chapters.map(c => (c.id === id ? { ...c, ...change } : c)),
    }));
  }
  function reorder(from: number, to: number) {
    if (from < 0 || to < 0 || to >= chapters.length || from === to) return;
    const ordered = arrayMove(chapters, from, to);
    store.edit(b => ({
      ...b,
      chapters: [...ordered, ...b.chapters.filter(c => c.isArchived)],
    }));
    setAnnouncement(`${chapters[from].name} moved to chapter ${to + 1}.`);
  }
  return (
    <section className="ws-overview" aria-label="Chapter overview">
      <header className="ws-board-heading">
        <div>
          <span className="ws-eyebrow">THE SHAPE OF YOUR STORY</span>
          <h1>Chapter overview</h1>
          <p>
            {chapters.length} chapters · {stats.words.toLocaleString()} words ·{" "}
            {stats.missing} missing summaries
          </p>
        </div>
        <div>
          <button
            className="ws-primary"
            disabled={!!store.recovery}
            onClick={() => {
              const chapter = {
                ...getDefaultBookDataItem({
                  bookId: book.id,
                  type: "chapters",
                }),
                id: newId(),
                name: `Chapter ${chapters.length + 1}`,
              } as Chapter;
              store.edit(b => ({ ...b, chapters: [...b.chapters, chapter] }));
              setSummaryId(chapter.id);
            }}
          >
            ＋ New chapter
          </button>
        </div>
      </header>
      <p className="ws-muted">
        Drag the handles to arrange your manuscript. For keyboard reordering,
        focus a handle, press Space, use the arrow keys, then press Space again.
      </p>
      <div role="status" className="ws-sr-only">
        {announcement}
      </div>
      <PlanningFilter
        book={book}
        value={planningFilter}
        onChange={setPlanningFilter}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over)
            reorder(
              chapters.findIndex(c => c.id === active.id),
              chapters.findIndex(c => c.id === over.id),
            );
        }}
      >
        <SortableContext
          items={chapters.map(c => c.id)}
          strategy={rectSortingStrategy}
        >
          <div className="ws-board">
            {chapters
              .filter(c => matchesPlanning(book, c, planningFilter))
              .map(chapter => (
                <Card
                  key={chapter.id}
                  chapter={chapter}
                  book={book}
                  index={chapters.indexOf(chapter)}
                  selected={chapter.id === selected}
                  locked={!!store.recovery}
                  reorderLocked={!!planningFilter}
                  onPreview={() => setPreviewId(chapter.id)}
                  onEdit={() => setEditId(chapter.id)}
                  onSummary={() => setSummaryId(chapter.id)}
                  onRename={() => {
                    const name = window.prompt("Chapter title", chapter.name);
                    if (name?.trim()) update(chapter.id, { name: name.trim() });
                  }}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Delete “${chapter.name}” from the manuscript? It will be archived with its content intact.`,
                      )
                    ) {
                      update(chapter.id, { isArchived: true });
                      setAnnouncement(`${chapter.name} archived.`);
                    }
                  }}
                />
              ))}
          </div>
        </SortableContext>
      </DndContext>
      {!chapters.length && (
        <p className="ws-empty">
          Your story starts here. Create a chapter to begin arranging your
          manuscript.
        </p>
      )}
      <dialog
        ref={dialog}
        className="ws-chapter-dialog"
        aria-label={
          editing
            ? "Edit chapter"
            : summary
              ? "Edit chapter summary"
              : "Chapter reading preview"
        }
        onKeyDown={event => {
          const target = event.target as HTMLElement;
          if (
            target.closest(
              'textarea, input, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
            )
          ) {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
            }
            return;
          }
          if (
            !preview ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
          )
            return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const next =
              chapters[
                chapters.indexOf(preview) + (event.key === "ArrowLeft" ? -1 : 1)
              ];
            if (next) {
              void store.flush();
              setPreviewId(next.id);
            }
          }
        }}
        onCancel={event => {
          event.preventDefault();
          closePanel();
        }}
        onClick={event => {
          if (event.target === event.currentTarget) closePanel();
        }}
      >
        {current && (
          <>
            <header>
              <div>
                {(editing || summary) && (
                  <button
                    className="ws-back-to-preview"
                    onClick={() => {
                      void store.flush();
                      if (editId && edited.current) onChapterEdited(editId);
                      edited.current = false;
                      setEditId(null);
                      setSummaryId(null);
                      setPreviewId(current.id);
                      dialog.current
                        ?.querySelector(".ws-chapter-reading")
                        ?.scrollTo({ top: 0 });
                    }}
                  >
                    ← Back to preview
                  </button>
                )}

                <span className="ws-eyebrow">
                  {editing
                    ? "EDIT CHAPTER"
                    : summary
                      ? "CHAPTER SUMMARY"
                      : `Chapter ${chapters.indexOf(current) + 1} of ${chapters.length} · Reading preview`}
                </span>
                <h2 dir="auto">{current.name || "Untitled chapter"}</h2>
              </div>
              <button aria-label="Close chapter panel" onClick={closePanel}>
                ×
              </button>
            </header>
            <div className="ws-chapter-reading" key={current.id}>
              <ChapterPlanning
                key={`planning:${current.id}`}
                store={store}
                chapter={current}
                summaryElsewhere={!!summary}
                onChapter={id => {
                  void store.flush();
                  setEditId(null);
                  setSummaryId(null);
                  setPreviewId(id);
                }}
                onEntity={(kind, id) => {
                  closePanel();
                  planningNavigation.onEntity(kind, id);
                }}
                onTask={id => {
                  closePanel();
                  planningNavigation.onTask(id);
                }}
              />
              {editing ? (
                <>
                  <p className="ws-muted">Changes save automatically.</p>
                  <ManuscriptEditor
                    key={`${editing.id}:manuscript`}
                    value={editing.text}
                    format={editing.format}
                    label="Chapter manuscript"
                    readOnly={!!store.recovery}
                    onChange={text => {
                      edited.current = true;
                      update(editing.id, { text });
                    }}
                  />
                </>
              ) : summary ? (
                <>
                  <p className="ws-muted">
                    What does this chapter contribute to your story? Changes
                    save automatically.
                  </p>
                  <ManuscriptEditor
                    key={summary.id}
                    value={summary.description}
                    label="Chapter summary"
                    readOnly={!!store.recovery}
                    onChange={description =>
                      update(summary.id, { description })
                    }
                  />
                </>
              ) : (
                <>
                  <PreviewSummary
                    key={current.id}
                    chapter={current}
                    store={store}
                  />
                  <div
                    className={`ws-prose ${current.format === "screenplay" ? "sp-page" : ""}`}
                    dir="auto"
                    dangerouslySetInnerHTML={{
                      __html: richTextHtml(current.text),
                    }}
                  />
                </>
              )}
            </div>
            <footer>
              {!editing && preview && (
                <>
                  <button
                    disabled={chapters.indexOf(preview) === 0}
                    onClick={() => {
                      void store.flush();
                      setPreviewId(chapters[chapters.indexOf(preview) - 1].id);
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={chapters.indexOf(preview) === chapters.length - 1}
                    onClick={() => {
                      void store.flush();
                      setPreviewId(chapters[chapters.indexOf(preview) + 1].id);
                    }}
                  >
                    Next →
                  </button>
                </>
              )}
              {preview && !editing && (
                <button
                  className="ws-primary"
                  disabled={!!store.recovery}
                  onClick={() => {
                    setPreviewId(null);
                    setSummaryId(current.id);
                    void store.flush();
                    dialog.current
                      ?.querySelector(".ws-chapter-reading")
                      ?.scrollTo({ top: 0 });
                  }}
                >
                  {plainText(current.description).trim()
                    ? "Edit Summary"
                    : "Add Summary"}
                </button>
              )}
              {!editing && (
                <button
                  className="ws-primary"
                  onClick={() => {
                    setPreviewId(null);
                    setSummaryId(null);
                    setEditId(current.id);
                  }}
                >
                  Edit chapter
                </button>
              )}
              {preview && !editing && (
                <a
                  className="ws-primary ws-preview-open-chapter"
                  href="?workspace=chapters"
                  onClick={event => {
                    event.preventDefault();
                    const id = current.id;
                    closePanel();
                    onOpenChapter(id);
                  }}
                >
                  Open in Chapters
                </a>
              )}
              <button className="ws-preview-done" onClick={closePanel}>
                Done
              </button>
            </footer>
          </>
        )}
      </dialog>
    </section>
  );
}
