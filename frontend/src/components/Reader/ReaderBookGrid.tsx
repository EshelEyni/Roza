import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { ReaderBookMenu } from "./ReaderBookMenu";
import type { ReaderBook } from "../../../../shared/types/reader";
import { ReaderBookPreview } from "./ReaderBookPreview";

type GridProps = {
  books: ReaderBook[];
  archived: boolean;
  layout: "grid" | "list";
  pending: boolean;
  custom: boolean;
  onArchive: (book: ReaderBook) => void;
  onPin: (book: ReaderBook) => void;
  onMove: (id: string, anchorId: string) => void;
};

function SortableBook({
  book, archived, pending, custom, previous, next, onArchive, onPin, onMove,
}: Omit<GridProps, "books" | "layout"> & {
  book: ReaderBook;
  previous?: ReaderBook;
  next?: ReaderBook;
}) {
  const { t } = useTranslation();
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id, data: { pinned: Boolean(book.pinned) }, disabled: pending });

  return (
    <div
      className={isDragging ? "reader-book-item is-dragging" : "reader-book-item"}
      data-book-id={book.id}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <ReaderBookPreview book={book} onTouchStart={event => listeners?.onTouchStart?.(event)}
        onMouseDown={event => {
          if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            listeners?.onMouseDown?.(event);
          }
        }} />
      <ReaderBookMenu book={book} archived={archived} pending={pending} onArchive={onArchive} onPin={onPin} />
      {custom && <div className="reader-book-order-actions">
        {([previous, next] as const).map((anchor, index) => {
          const label = t(index === 0 ? "reader.moveBookUp" : "reader.moveBookDown", { title: book.title });
          return (
            <button
              key={index}
              type="button"
              className="reader-icon-button"
              aria-label={label}
              title={label}
              aria-disabled={pending || !anchor}
              onClick={() => { if (!pending && anchor) onMove(book.id, anchor.id); }}
            >
              {index === 0 ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />}
            </button>
          );
        })}
      </div>}
    </div>
  );
}

function preventDragClick(bookId: string) {
  // dnd-kit stops click propagation after a drag. Also prevent the link’s native navigation.
  const preventNavigation = (event: MouseEvent) => {
    const card = event.target instanceof Element && event.target.closest(".reader-book-card");
    if (card && card.closest<HTMLElement>("[data-book-id]")?.dataset.bookId === bookId) {
      event.preventDefault();
    }
  };
  document.addEventListener("click", preventNavigation, true);
  window.setTimeout(() => document.removeEventListener("click", preventNavigation, true), 50);
}

export function ReaderBookGrid({ books, layout, ...actions }: GridProps) {
  const activationConstraint = { delay: 250, tolerance: 8 };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint }),
    useSensor(TouchSensor, { activationConstraint }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={args => closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          container => container.data.current?.pinned === args.active.data.current?.pinned,
        ),
      })}
      onDragCancel={({ active }) => preventDragClick(String(active.id))}
      onDragEnd={({ active, over }) => {
        preventDragClick(String(active.id));
        if (over && active.id !== over.id) actions.onMove(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={books.map(book => book.id)} strategy={rectSortingStrategy}>
        <div className={layout === "list" ? "reader-book-grid reader-book-list" : "reader-book-grid"}>
          {books.map((book, index) => (
            <SortableBook
              key={book.id}
              book={book}
              previous={Boolean(books[index - 1]?.pinned) === Boolean(book.pinned) ? books[index - 1] : undefined}
              next={Boolean(books[index + 1]?.pinned) === Boolean(book.pinned) ? books[index + 1] : undefined}
              {...actions}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
