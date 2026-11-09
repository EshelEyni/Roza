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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Book, Chapter } from "../../../../shared/types/books";
import { DraftStore } from "./draftStore";
import { newId, plainText, richTextHtml, words } from "./manuscript";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { getDefaultBookDataItem } from "../../services/bookUtilService";

function Card({
  chapter,
  index,
  count,
  selected,
  locked,
  onPreview,
  onEdit,
  onSummary,
  onMove,
  onRename,
  onDuplicate,
  onDelete,
}: {
  chapter: Chapter;
  index: number;
  count: number;
  selected: boolean;
  locked: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onSummary: () => void;
  onMove: (offset: number) => void;
  onRename: () => void;
  onDuplicate: () => void;
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
  } = useSortable({ id: chapter.id, disabled: locked });
  const summary = useMemo(
    () => plainText(chapter.description),
    [chapter.description],
  );
  const countWords = useMemo(() => words(chapter.text), [chapter.text]);
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
          disabled={locked}
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
        <h2 dir="auto">{chapter.name || "Untitled chapter"}</h2>
        <p dir="auto">
          {summary ||
            "No summary yet. Give this chapter a place in your story."}
        </p>
      </button>
      <div className="ws-card-bottom">
        <small>{countWords.toLocaleString()} words</small>
        <button disabled={locked} onClick={onSummary}>
          {summary ? "Edit summary" : "Add summary"}
        </button>
        <button onClick={onEdit}>Edit chapter</button>
        <details
          className="ws-item-menu"
          onClick={event => {
            if ((event.target as HTMLElement).closest("button"))
              event.currentTarget.removeAttribute("open");
          }}
        >
          <summary aria-label={`Actions for ${chapter.name}`}>More</summary>
          <div>
            <button disabled={locked || index === 0} onClick={() => onMove(-1)}>
              Move up
            </button>
            <button
              disabled={locked || index === count - 1}
              onClick={() => onMove(1)}
            >
              Move down
            </button>
            <button disabled={locked} onClick={onRename}>
              Rename
            </button>
            <button disabled={locked} onClick={onDuplicate}>
              Duplicate
            </button>
            <button disabled={locked} onClick={onDelete}>
              Delete chapter
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}

export function ChapterOverview({
  book,
  store,
  selected,
  onEdit,
  onClose,
}: {
  book: Book;
  store: DraftStore;
  selected: string;
  onEdit: (id: string) => void;
  onClose: () => void;
}) {
  const chapters = useMemo(
    () => book.chapters.filter(c => !c.isArchived),
    [book.chapters],
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const preview = chapters.find(c => c.id === previewId);
  const summary = chapters.find(c => c.id === summaryId);
  const current = preview || summary;
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
  function closePanel() {
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
      <header className="ws-overview-heading">
        <div>
          <span className="ws-eyebrow">THE SHAPE OF YOUR STORY</span>
          <h1>Chapter overview</h1>
          <p>
            {chapters.length} chapters · {stats.words.toLocaleString()} words ·{" "}
            {stats.missing} missing summaries
          </p>
        </div>
        <div>
          <button onClick={onClose}>← Back to writing</button>
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
        Arrange your manuscript with the handles, or use Move up / down in each
        chapter’s menu.
      </p>
      <div role="status" className="ws-sr-only">
        {announcement}
      </div>
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
          strategy={verticalListSortingStrategy}
        >
          <div className="ws-board">
            {chapters.map((chapter, index) => (
              <Card
                key={chapter.id}
                chapter={chapter}
                index={index}
                count={chapters.length}
                selected={chapter.id === selected}
                locked={!!store.recovery}
                onPreview={() => setPreviewId(chapter.id)}
                onEdit={() => onEdit(chapter.id)}
                onSummary={() => setSummaryId(chapter.id)}
                onMove={offset => reorder(index, index + offset)}
                onRename={() => {
                  const name = window.prompt("Chapter title", chapter.name);
                  if (name?.trim()) update(chapter.id, { name: name.trim() });
                }}
                onDuplicate={() => {
                  const copy = {
                    ...structuredClone(chapter),
                    id: newId(),
                    name: `${chapter.name} — copy`,
                    createdAt: new Date().toISOString(),
                  };
                  delete (copy as unknown as Record<string, unknown>)._id;
                  store.edit(b => ({
                    ...b,
                    chapters: [
                      ...b.chapters.slice(0, b.chapters.indexOf(chapter) + 1),
                      copy,
                      ...b.chapters.slice(b.chapters.indexOf(chapter) + 1),
                    ],
                  }));
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
          summary ? "Edit chapter summary" : "Chapter reading preview"
        }
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
                <span className="ws-eyebrow">
                  {summary
                    ? "CHAPTER SUMMARY"
                    : `CHAPTER ${chapters.indexOf(current) + 1} · READING PREVIEW`}
                </span>
                <h2 dir="auto">{current.name || "Untitled chapter"}</h2>
              </div>
              <button aria-label="Close chapter panel" onClick={closePanel}>
                ×
              </button>
            </header>
            <div className="ws-chapter-reading" key={current.id}>
              {summary ? (
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
                  <div
                    className="ws-preview-summary"
                    dir="auto"
                    dangerouslySetInnerHTML={{
                      __html: richTextHtml(current.description),
                    }}
                  />
                  <div
                    className="ws-prose"
                    dir="auto"
                    dangerouslySetInnerHTML={{
                      __html: richTextHtml(current.text),
                    }}
                  />
                </>
              )}
            </div>
            <footer>
              {preview && (
                <>
                  <button
                    disabled={chapters.indexOf(preview) === 0}
                    onClick={() =>
                      setPreviewId(chapters[chapters.indexOf(preview) - 1].id)
                    }
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={chapters.indexOf(preview) === chapters.length - 1}
                    onClick={() =>
                      setPreviewId(chapters[chapters.indexOf(preview) + 1].id)
                    }
                  >
                    Next →
                  </button>
                </>
              )}
              <button
                className="ws-primary"
                onClick={() => {
                  closePanel();
                  onEdit(current.id);
                }}
              >
                Edit chapter
              </button>
              <button onClick={closePanel}>Done</button>
            </footer>
          </>
        )}
      </dialog>
    </section>
  );
}
