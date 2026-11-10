import { ConfirmDialog } from "../Reader/ReaderArchiveDialog";
import { FiTrash2 } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
  KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskBoard, TaskCard, TaskList } from "../../../../shared/types/books";
import { DraftStore } from "./draftStore";
import "./taskBoard.css";
import { emptyBoard, moveTask, uid } from "./taskBoardModel";
const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (args.context.active?.data.current?.kind !== "list")
    return sortableKeyboardCoordinates(event, args);
  if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return undefined;
  event.preventDefault();
  const containers = args.context.droppableContainers
    .getEnabled()
    .filter(c => c.data.current?.kind === "list");
  const current = containers.findIndex(
    c => c.id === (args.context.over?.id || args.context.active?.id),
  );
  const target = containers[current + (event.code === "ArrowRight" ? 1 : -1)];
  const rect = target && args.context.droppableRects.get(target.id);
  return rect ? { x: rect.left, y: rect.top } : undefined;
};
function Sortable({
  id,
  children,
  kind,
}: {
  id: string;
  children: React.ReactNode;
  kind: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, data: { kind } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      aria-label={kind === "list" ? "Reorder list" : "Reorder task"}
      onPointerDown={event => {
        if (event.pointerType === "touch") return;
        const target = event.target as HTMLElement;
        if (target.closest(".tb-sortable") !== event.currentTarget) return;
        if (
          kind === "list" &&
          target.closest("input, textarea, select, button, a")
        )
          return;
        listeners?.onPointerDown?.(event);
      }}
      onTouchStart={event => {
        const target = event.target as HTMLElement;
        if (target.closest(".tb-sortable") !== event.currentTarget) return;
        if (
          kind === "list" &&
          target.closest("input, textarea, select, button, a")
        )
          return;
        listeners?.onTouchStart?.(event);
      }}
      onKeyDown={event => {
        if (event.target === event.currentTarget) listeners?.onKeyDown?.(event);
      }}
      className={`tb-sortable tb-${kind} ${isDragging ? "tb-dragging" : ""} ${isOver ? "tb-over" : ""}`}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        transition,
      }}
    >
      {children}
    </div>
  );
}
export function TaskBoardView({ store }: { store: DraftStore }) {
  const [confirmation, setConfirmation] = useState<{
    message: string;
    action: () => void;
  } | null>(null);
  const [initial] = useState(emptyBoard);
  const board = store.book.taskBoard || initial;
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
    }),
  );
  const change = (next: TaskBoard) =>
    store.edit(book => ({ ...book, taskBoard: next }));
  const editList = (id: string, update: (list: TaskList) => TaskList) =>
    change({ lists: board.lists.map(l => (l.id === id ? update(l) : l)) });
  const list = board.lists.find(l => l.cards.some(c => c.id === selected));
  const card = list?.cards.find(c => c.id === selected);
  const updateCard = (patch: Partial<TaskCard>) => {
    if (list && card)
      editList(list.id, l => ({
        ...l,
        cards: l.cards.map(c =>
          c.id === card.id
            ? { ...c, ...patch, updatedAt: new Date().toISOString() }
            : c,
        ),
      }));
  };
  const drop = ({ active, over }: DragEndEvent) => {
    if (over) change(moveTask(board, String(active.id), String(over.id)));
  };
  return (
    <section className="tb" aria-label="Book task board">
      <div className="tb-heading">
        <div>
          <span className="ws-eyebrow">MAKE SPACE FOR PROGRESS</span>
          <h1>Your writing, in motion.</h1>
          <p>Small steps toward your next chapter.</p>
        </div>
        <span>{board.lists.reduce((n, l) => n + l.cards.length, 0)} tasks</span>
      </div>
      <fieldset disabled={!!store.recovery}>
        <DndContext
          sensors={sensors}
          collisionDetection={args =>
            closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                container =>
                  args.active.data.current?.kind !== "list" ||
                  container.data.current?.kind === "list",
              ),
            })
          }
          onDragEnd={drop}
        >
          <div className="tb-columns">
            <SortableContext
              items={board.lists.map(l => l.id)}
              strategy={horizontalListSortingStrategy}
            >
              {board.lists.map(l => (
                <Sortable key={l.id} id={l.id} kind="list">
                  <header>
                    <input
                      aria-label="List title"
                      maxLength={500}
                      value={l.title}
                      onChange={e =>
                        editList(l.id, x => ({
                          ...x,
                          title: e.target.value || "Untitled list",
                        }))
                      }
                    />
                    <button
                      className="tb-delete-list"
                      aria-label={`Delete list ${l.title}`}
                      title="Delete list"
                      onClick={() => {
                        setConfirmation({
                          message: `Delete “${l.title}” and its ${l.cards.length} tasks? This cannot be undone.`,
                          action: () =>
                            change({
                              lists: board.lists.filter(x => x.id !== l.id),
                            }),
                        });
                      }}
                    >
                      <FiTrash2 aria-hidden="true" size={16} />
                    </button>
                  </header>
                  <SortableContext
                    items={l.cards.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="tb-cards">
                      {l.cards.map(c => (
                        <Sortable key={c.id} id={c.id} kind="card">
                          <button
                            className="tb-card-open"
                            onClick={() => setSelected(c.id)}
                          >
                            <div className="tb-tags">
                              {c.labels.map(tag => (
                                <span
                                  key={tag.id}
                                  style={{ borderColor: tag.color }}
                                >
                                  {tag.title}
                                </span>
                              ))}
                            </div>
                            <span className="tb-card-title" dir="auto">
                              {c.title}
                            </span>
                            <div className="tb-meta">
                              {c.dueDate && (
                                <time dateTime={c.dueDate}>◷ {c.dueDate}</time>
                              )}
                              {!!c.checklist.length && (
                                <span>
                                  ☑ {c.checklist.filter(i => i.done).length}/
                                  {c.checklist.length}
                                </span>
                              )}
                              {c.description && (
                                <span aria-label="Has description">≡</span>
                              )}
                            </div>
                          </button>
                        </Sortable>
                      ))}
                      {!l.cards.length && (
                        <p className="tb-empty">
                          A little room for your next idea.
                        </p>
                      )}
                    </div>
                  </SortableContext>
                  {creatingIn === l.id ? (
                    <form
                      onBlur={event => {
                        if (
                          !event.currentTarget.contains(
                            event.relatedTarget as Node | null,
                          )
                        )
                          setCreatingIn(null);
                      }}
                      onKeyDown={event => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setCreatingIn(null);
                        }
                      }}
                      onSubmit={e => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const title = String(
                          new FormData(form).get("title") || "",
                        ).trim();
                        if (!title) return;
                        const now = new Date().toISOString();
                        editList(l.id, x => ({
                          ...x,
                          cards: [
                            ...x.cards,
                            {
                              id: uid(),
                              title,
                              description: "",
                              dueDate: "",
                              checklist: [],
                              labels: [],
                              createdAt: now,
                              updatedAt: now,
                            },
                          ],
                        }));
                        form.reset();
                        form
                          .querySelector<HTMLInputElement>(
                            'input[name="title"]',
                          )
                          ?.focus();
                      }}
                    >
                      <input
                        autoFocus
                        name="title"
                        aria-label={`New task in ${l.title}`}
                        placeholder="What needs doing?"
                        required
                        maxLength={500}
                      />
                      <button type="submit">Add card</button>
                    </form>
                  ) : (
                    <button
                      className="tb-add-card"
                      onClick={() => setCreatingIn(l.id)}
                    >
                      ＋ Add Card
                    </button>
                  )}
                </Sortable>
              ))}
            </SortableContext>
            <button
              className="tb-add-list"
              onClick={() =>
                change({
                  lists: [
                    ...board.lists,
                    { id: uid(), title: "New list", cards: [] },
                  ],
                })
              }
            >
              ＋ Add List
            </button>
          </div>
        </DndContext>
      </fieldset>
      {card && list && (
        <CardDialog
          card={card}
          list={list}
          update={updateCard}
          close={() => setSelected(null)}
          remove={() => {
            setConfirmation({
              message: `Delete “${card.title}”? This cannot be undone.`,
              action: () => {
                editList(list.id, l => ({
                  ...l,
                  cards: l.cards.filter(c => c.id !== card.id),
                }));
                setSelected(null);
              },
            });
          }}
          disabled={!!store.recovery}
        />
      )}
      {confirmation && (
        <ConfirmDialog
          heading="Delete permanently?"
          message={confirmation.message}
          confirmLabel="Delete"
          icon={<FiTrash2 aria-hidden="true" />}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.action();
            setConfirmation(null);
          }}
        />
      )}
    </section>
  );
}
function CardDialog({
  card,
  list,
  update,
  close,
  remove,
  disabled,
}: {
  card: TaskCard;
  list: TaskList;
  update: (patch: Partial<TaskCard>) => void;
  close: () => void;
  remove: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="tb-dialog"
      aria-label="Task details"
      onCancel={close}
      onClick={e => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button className="tb-close" onClick={close} aria-label="Close task">
        ×
      </button>
      <span className="ws-eyebrow">IN {list.title}</span>
      <fieldset disabled={disabled}>
        <label>
          Title
          <input
            autoFocus
            value={card.title}
            maxLength={500}
            onChange={e => {
              if (e.target.value.trim()) update({ title: e.target.value });
            }}
          />
        </label>
        <label>
          Description
          <textarea
            rows={5}
            value={card.description}
            maxLength={100000}
            placeholder="Give this idea a little context…"
            onChange={e => update({ description: e.target.value })}
          />
        </label>
        <footer>
          <small>
            Created {new Date(card.createdAt).toLocaleString()}
            <br />
            Updated {new Date(card.updatedAt).toLocaleString()}
          </small>
          <button
            className="tb-delete"
            onClick={remove}
            aria-label="Delete task"
            title="Delete task"
          >
            <FiTrash2 size={18} aria-hidden="true" />
          </button>
        </footer>
      </fieldset>
      <button className="ws-primary" onClick={close}>
        Done
      </button>
    </dialog>
  );
}
