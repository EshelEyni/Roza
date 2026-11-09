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
    .filter((c) => c.data.current?.kind === "list");
  const current = containers.findIndex(
    (c) => c.id === (args.context.over?.id || args.context.active?.id),
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
  } = useSortable({ id, data: { kind } });
  return (
    <div
      ref={setNodeRef}
      className={`tb-sortable tb-${kind} ${isDragging ? "tb-dragging" : ""}`}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        transition,
      }}
    >
      <button
        className="tb-grip"
        aria-label={`Drag ${kind}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {children}
    </div>
  );
}
export function TaskBoardView({ store }: { store: DraftStore }) {
  const [initial] = useState(emptyBoard);
  const board = store.book.taskBoard || initial;
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
    store.edit((book) => ({ ...book, taskBoard: next }));
  const editList = (id: string, update: (list: TaskList) => TaskList) =>
    change({ lists: board.lists.map((l) => (l.id === id ? update(l) : l)) });
  const list = board.lists.find((l) => l.cards.some((c) => c.id === selected));
  const card = list?.cards.find((c) => c.id === selected);
  const updateCard = (patch: Partial<TaskCard>) => {
    if (list && card)
      editList(list.id, (l) => ({
        ...l,
        cards: l.cards.map((c) =>
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
          collisionDetection={(args) =>
            closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) =>
                  args.active.data.current?.kind !== "list" ||
                  container.data.current?.kind === "list",
              ),
            })
          }
          onDragEnd={drop}
        >
          <div className="tb-columns">
            <SortableContext
              items={board.lists.map((l) => l.id)}
              strategy={horizontalListSortingStrategy}
            >
              {board.lists.map((l, index) => (
                <Sortable key={l.id} id={l.id} kind="list">
                  <header>
                    <input
                      aria-label="List title"
                      maxLength={500}
                      value={l.title}
                      onChange={(e) =>
                        editList(l.id, (x) => ({
                          ...x,
                          title: e.target.value || "Untitled list",
                        }))
                      }
                    />
                    <span>{l.cards.length}</span>
                  </header>
                  <div className="tb-list-actions">
                    <button
                      aria-label="Move list left"
                      disabled={!index}
                      onClick={() =>
                        change(moveTask(board, l.id, board.lists[index - 1].id))
                      }
                    >
                      ←
                    </button>
                    <button
                      aria-label="Move list right"
                      disabled={index === board.lists.length - 1}
                      onClick={() =>
                        change(moveTask(board, l.id, board.lists[index + 1].id))
                      }
                    >
                      →
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete “${l.title}” and its ${l.cards.length} tasks? This cannot be undone.`,
                          )
                        )
                          change({
                            lists: board.lists.filter((x) => x.id !== l.id),
                          });
                      }}
                    >
                      Delete list
                    </button>
                  </div>
                  <SortableContext
                    items={l.cards.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="tb-cards">
                      {l.cards.map((c) => (
                        <Sortable key={c.id} id={c.id} kind="card">
                          <button
                            className="tb-card-open"
                            onClick={() => setSelected(c.id)}
                          >
                            <div className="tb-tags">
                              {c.labels.map((tag) => (
                                <span
                                  key={tag.id}
                                  style={{ borderColor: tag.color }}
                                >
                                  {tag.title}
                                </span>
                              ))}
                            </div>
                            <strong dir="auto">{c.title}</strong>
                            <div className="tb-meta">
                              {c.dueDate && (
                                <time dateTime={c.dueDate}>◷ {c.dueDate}</time>
                              )}
                              {!!c.checklist.length && (
                                <span>
                                  ☑ {c.checklist.filter((i) => i.done).length}/
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
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const title = String(
                        new FormData(form).get("title") || "",
                      ).trim();
                      if (!title) return;
                      const now = new Date().toISOString();
                      editList(l.id, (x) => ({
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
                    }}
                  >
                    <input
                      name="title"
                      aria-label={`New task in ${l.title}`}
                      placeholder="What needs doing?"
                      required
                      maxLength={500}
                    />
                    <button type="submit">＋ Add Card</button>
                  </form>
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
          board={board}
          update={updateCard}
          close={() => setSelected(null)}
          move={(id) => change(moveTask(board, card.id, id))}
          remove={() => {
            if (confirm(`Delete “${card.title}”? This cannot be undone.`)) {
              editList(list.id, (l) => ({
                ...l,
                cards: l.cards.filter((c) => c.id !== card.id),
              }));
              setSelected(null);
            }
          }}
          disabled={!!store.recovery}
        />
      )}
    </section>
  );
}
function CardDialog({
  card,
  list,
  board,
  update,
  close,
  move,
  remove,
  disabled,
}: {
  card: TaskCard;
  list: TaskList;
  board: TaskBoard;
  update: (patch: Partial<TaskCard>) => void;
  close: () => void;
  move: (id: string) => void;
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
      onCancel={close}
      onClick={(e) => {
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
            onChange={(e) => {
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
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
        <label>
          Due date
          <input
            type="date"
            value={card.dueDate}
            onChange={(e) => update({ dueDate: e.target.value })}
          />
        </label>
        <label>
          Move to list
          <select
            aria-label="Move to list"
            value={list.id}
            onChange={(e) => move(e.target.value)}
          >
            {board.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        <div className="tb-position">
          <button
            disabled={list.cards[0]?.id === card.id}
            onClick={() =>
              move(
                list.cards[list.cards.findIndex((c) => c.id === card.id) - 1]
                  .id,
              )
            }
          >
            Move up
          </button>
          <button
            disabled={list.cards.at(-1)?.id === card.id}
            onClick={() => {
              const i = list.cards.findIndex((c) => c.id === card.id);
              move(list.cards[i + 1].id);
            }}
          >
            Move down
          </button>
        </div>
        <h2>
          Checklist{" "}
          <small>
            {card.checklist.filter((i) => i.done).length}/
            {card.checklist.length}
          </small>
        </h2>
        <progress
          max={card.checklist.length || 1}
          value={card.checklist.filter((i) => i.done).length}
        />
        {card.checklist.map((item) => (
          <div className="tb-check" key={item.id}>
            <input
              type="checkbox"
              aria-label={`Complete ${item.title}`}
              checked={item.done}
              onChange={(e) =>
                update({
                  checklist: card.checklist.map((i) =>
                    i.id === item.id ? { ...i, done: e.target.checked } : i,
                  ),
                })
              }
            />
            <input
              aria-label="Checklist item"
              maxLength={500}
              value={item.title}
              onChange={(e) =>
                update({
                  checklist: card.checklist.map((i) =>
                    i.id === item.id
                      ? { ...i, title: e.target.value || "Untitled" }
                      : i,
                  ),
                })
              }
            />
            <button
              aria-label="Remove checklist item"
              onClick={() =>
                update({
                  checklist: card.checklist.filter((i) => i.id !== item.id),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            update({
              checklist: [
                ...card.checklist,
                { id: uid(), title: "New subtask", done: false },
              ],
            })
          }
        >
          ＋ Add subtask
        </button>
        <h2>Labels</h2>
        {card.labels.map((tag) => (
          <div className="tb-check" key={tag.id}>
            <input
              type="color"
              aria-label="Label color"
              value={tag.color}
              onChange={(e) =>
                update({
                  labels: card.labels.map((t) =>
                    t.id === tag.id ? { ...t, color: e.target.value } : t,
                  ),
                })
              }
            />
            <input
              aria-label="Label name"
              maxLength={500}
              value={tag.title}
              onChange={(e) =>
                update({
                  labels: card.labels.map((t) =>
                    t.id === tag.id
                      ? { ...t, title: e.target.value || "Label" }
                      : t,
                  ),
                })
              }
            />
            <button
              aria-label="Remove label"
              onClick={() =>
                update({ labels: card.labels.filter((t) => t.id !== tag.id) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            update({
              labels: [
                ...card.labels,
                { id: uid(), title: "Label", color: "#9f6a70" },
              ],
            })
          }
        >
          ＋ Add label
        </button>
        <footer>
          <small>
            Created {new Date(card.createdAt).toLocaleString()}
            <br />
            Updated {new Date(card.updatedAt).toLocaleString()}
          </small>
          <button className="tb-delete" onClick={remove}>
            Delete task
          </button>
        </footer>
      </fieldset>
      <button className="ws-primary" onClick={close}>
        Done
      </button>
    </dialog>
  );
}
