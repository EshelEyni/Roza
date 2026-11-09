import { ItemMenu } from "./ItemMenu";
import {
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDndContext,
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

function SummaryTooltip({
  text,
  children,
  disabled = false,
}: {
  disabled?: boolean;
  text: string;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);
  function show() {
    clearTimeout(hideTimer.current);
    if (disabled || !text.trim() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const top = rect.bottom + 6;
    const below = window.innerHeight - top - 12;
    setPosition({
      left: Math.max(
        12,
        Math.min(
          rect.left,
          window.innerWidth - Math.min(420, window.innerWidth - 24) - 12,
        ),
      ),
      top: below >= 160 ? top : 12,
      maxHeight: below >= 160 ? below : Math.max(100, rect.top - 18),
    });
  }
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const scroll = (event: Event) => {
      if (!(event.target as HTMLElement)?.closest?.('[role="tooltip"]'))
        close();
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", escape);
    };
  }, [position]);
  return (
    <div
      ref={ref}
      className="ws-summary-hover"
      onMouseEnter={show}
      onMouseLeave={() => {
        hideTimer.current = setTimeout(() => setPosition(null), 150);
      }}
      onFocus={show}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setPosition(null);
      }}
    >
      <div onClick={() => setPosition(null)}>
        {cloneElement(children, {
          "aria-describedby": position ? id : undefined,
        })}
      </div>
      {position && !disabled && (
        <div
          id={id}
          role="tooltip"
          className="ws-summary-tooltip"
          dir="auto"
          style={position}
        >
          {text}
        </div>
      )}
    </div>
  );
}

function Card({
  chapter,
  index,
  selected,
  locked,
  onPreview,
  onEdit,
  onSummary,
  onRename,
  onDelete,
}: {
  chapter: Chapter;
  index: number;
  selected: boolean;
  locked: boolean;
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
  } = useSortable({ id: chapter.id, disabled: locked });
  const { active } = useDndContext();
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
      <SummaryTooltip text={summary} disabled={!!active}>
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
      </SummaryTooltip>
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
  onClose,
}: {
  book: Book;
  store: DraftStore;
  selected: string;
  onChapterEdited: (id: string) => void;
  onClose: () => void;
}) {
  const chapters = useMemo(
    () => book.chapters.filter(c => !c.isArchived),
    [book.chapters],
  );
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
  function closePanel() {
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
        Drag the handles to arrange your manuscript. For keyboard reordering,
        focus a handle, press Space, use the arrow keys, then press Space again.
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
          strategy={rectSortingStrategy}
        >
          <div className="ws-board">
            {chapters.map((chapter, index) => (
              <Card
                key={chapter.id}
                chapter={chapter}
                index={index}
                selected={chapter.id === selected}
                locked={!!store.recovery}
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
                  {editing
                    ? "EDIT CHAPTER"
                    : summary
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
              {editing ? (
                <>
                  <p className="ws-muted">Changes save automatically.</p>
                  <ManuscriptEditor
                    key={`${editing.id}:manuscript`}
                    value={editing.text}
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
              {!editing && preview && (
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
              <button onClick={closePanel}>Done</button>
            </footer>
          </>
        )}
      </dialog>
    </section>
  );
}
