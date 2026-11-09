import {
  ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Editor, Element, Node, Range, Transforms } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { ChapterAnnotation } from "../../../../shared/types/books";
import { layoutAnnotations, validAnchor } from "./annotations";

type Line = { number: number; top: number; range: Range };
type Position = { x: number; y: number };

export function AnnotationMargin({
  notes,
  active,
  hoveredPath,
  visible,
  readOnly,
  onChange,
  legacyNotes,
  onActive,
  onReveal,
}: {
  notes: ChapterAnnotation[];
  active: string | null;
  hoveredPath: string | null;
  visible: boolean;
  readOnly: boolean;
  onChange: (notes: ChapterAnnotation[]) => void;
  legacyNotes?: ReactNode;
  onActive: (id: string | null) => void;
  onReveal?: () => void;
}) {
  const editor = useSlate();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const dialogTitle = useId();
  useLayoutEffect(() => {
    if (pendingDelete) {
      deleteDialog.current?.showModal();
      cancelDelete.current?.focus();
    } else deleteDialog.current?.close();
  }, [pendingDelete]);
  const root = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [positions, setPositions] = useState<{ id: string; top: number }[]>([]);
  const setActive = (id: string | null) => {
    onActive(id);
  };
  const legacy = useRef<HTMLDivElement>(null);
  const [legacyHeight, setLegacyHeight] = useState(60);
  const [floating, setFloating] = useState<Record<string, Position>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [height, setHeight] = useState(210);
  const activeCard = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const measure = useCallback(() => {
    const container = root.current?.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const next: Line[] = [];
    for (const [node, path] of Editor.nodes(editor, {
      at: [],
      match: node =>
        Element.isElement(node) &&
        Editor.isBlock(editor, node) &&
        !["bulleted-list", "numbered-list"].includes(node.type),
    })) {
      try {
        const element = ReactEditor.toDOMNode(editor, node);
        next.push({
          number: next.length + 1,
          top: element.getBoundingClientRect().top - bounds.top,
          range: Editor.range(editor, path),
        });
      } catch {
        /* Slate may not have committed this node yet. */
      }
    }
    const topOf = (note: ChapterAnnotation) => {
      if (!validAnchor(editor, note.anchor)) return null;
      try {
        const point = Range.start(note.anchor);
        const rect = ReactEditor.toDOMRange(editor, {
          anchor: point,
          focus: point,
        }).getBoundingClientRect();
        if (rect.height) return rect.top - bounds.top;
        return (
          ReactEditor.toDOMNode(
            editor,
            Node.get(editor, point.path.slice(0, -1)),
          ).getBoundingClientRect().top - bounds.top
        );
      } catch {
        return null;
      }
    };
    let detached = Math.max(0, ...next.map(line => line.top)) + 56;
    const located = notes.map(note => {
      const top = topOf(note);
      if (top !== null) return { id: note.id, top };
      const result = { id: note.id, top: detached };
      detached += 52;
      return result;
    });
    setLines(previous =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
    setPositions(previous =>
      JSON.stringify(previous) === JSON.stringify(located) ? previous : located,
    );
  }, [editor, notes]);

  useLayoutEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    const container = root.current?.parentElement;
    if (container) observer.observe(container);
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [measure]);
  useLayoutEffect(() => {
    if (!activeCard.current) return;
    const observer = new ResizeObserver(entries =>
      setHeight(
        entries[0].borderBoxSize?.[0]?.blockSize ||
          entries[0].contentRect.height,
      ),
    );
    observer.observe(activeCard.current);
    return () => observer.disconnect();
  }, [active, visible]);

  useLayoutEffect(() => {
    if (!legacy.current) return;
    const observer = new ResizeObserver(entries =>
      setLegacyHeight(
        entries[0].borderBoxSize?.[0]?.blockSize ||
          entries[0].contentRect.height,
      ),
    );
    observer.observe(legacy.current);
    return () => observer.disconnect();
  }, [visible, legacyNotes]);

  useLayoutEffect(() => {
    const clamp = () =>
      setFloating(current => {
        const next = { ...current };
        for (const element of root.current?.querySelectorAll<HTMLElement>(
          "[data-annotation-id]",
        ) || []) {
          const id = element.dataset.annotationId!;
          if (!current[id]) continue;
          const rect = element.getBoundingClientRect();
          next[id] = {
            x: Math.max(
              8,
              Math.min(window.innerWidth - rect.width - 8, current[id].x),
            ),
            y: Math.max(
              8,
              Math.min(window.innerHeight - rect.height - 8, current[id].y),
            ),
          };
        }
        return next;
      });
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const select = (note: ChapterAnnotation) => {
    onReveal?.();
    setActive(note.id);
    if (validAnchor(editor, note.anchor)) {
      Transforms.select(editor, note.anchor);
      try {
        ReactEditor.toDOMRange(
          editor,
          note.anchor,
        ).startContainer.parentElement?.scrollIntoView({ block: "nearest" });
      } catch {
        /* unmounted range */
      }
    }
  };
  const add = (line: Line) => {
    onReveal?.();
    const note: ChapterAnnotation = {
      id: crypto.randomUUID(),
      content: "",
      anchor: line.range,
      quote: Editor.string(editor, line.range).slice(0, 500),
    };
    onChange([...notes, note]);
    setActive(note.id);
  };
  const notesById = new Map(notes.map(note => [note.id, note]));
  // Measurement is committed after render; removed notes must disappear immediately.
  const layout = layoutAnnotations(
    positions.filter(position => notesById.has(position.id)),
    active,
    height,
  );
  const extent = Math.max(
    0,
    ...layout.map(note => note.top + (note.id === active ? height : 44)),
  );
  const lineByPath = new Map(
    lines.map(line => [
      Range.start(line.range).path.slice(0, -1).join("."),
      line,
    ]),
  );
  const notesByLine = new Map<number, ChapterAnnotation[]>();
  for (const note of notes) {
    if (!validAnchor(editor, note.anchor)) continue;
    const line = lineByPath.get(
      Range.start(note.anchor).path.slice(0, -1).join("."),
    );
    if (line)
      notesByLine.set(line.number, [
        ...(notesByLine.get(line.number) || []),
        note,
      ]);
  }
  return (
    <div
      ref={root}
      className="ws-annotation-layer"
      style={{
        minHeight: visible
          ? extent + (legacyNotes ? legacyHeight + 80 : 0)
          : undefined,
      }}
    >
      <dialog
        ref={deleteDialog}
        className="ws-delete-note-dialog"
        aria-labelledby={dialogTitle}
        onCancel={() => setPendingDelete(null)}
        onClose={() => setPendingDelete(null)}
      >
        <h2 id={dialogTitle}>Delete this note?</h2>
        <p>
          This will permanently remove the note. Your manuscript text will stay
          unchanged.
        </p>
        <div className="ws-delete-note-actions">
          <button
            ref={cancelDelete}
            type="button"
            onClick={() => setPendingDelete(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ws-delete-note-confirm"
            onClick={() => {
              onChange(notes.filter(note => note.id !== pendingDelete));
              setPendingDelete(null);
              setActive(null);
            }}
          >
            Delete note
          </button>
        </div>
      </dialog>
      <div className="ws-line-gutter" aria-label="Paragraph numbers and notes">
        {lines.map(line => {
          const attached = notesByLine.get(line.number) || [];
          return (
            <div
              key={line.number}
              className={`ws-line-marker ${attached.length ? "has-notes" : ""} ${Range.start(line.range).path.slice(0, -1).join(".") === hoveredPath ? "is-hovered" : ""}`}
              style={{ top: line.top }}
            >
              <button
                type="button"
                className="ws-line-number"
                title={`Paragraph ${line.number}${attached.length ? ` · ${attached.length} notes` : ""}`}
                aria-label={`Paragraph ${line.number}${attached.length ? ", focus note" : ""}`}
                onClick={() =>
                  attached.length ? select(attached[0]) : !readOnly && add(line)
                }
              >
                {line.number}
                {attached.length > 0 && <span aria-hidden="true"> •</span>}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="ws-add-annotation"
                  aria-label={`Add note to paragraph ${line.number}`}
                  title="Add note"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => add(line)}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
      {visible && (
        <aside className="ws-annotation-rail" aria-label="Chapter annotations">
          {notes.length === 0 && (
            <p className="ws-annotation-hint">
              Use + beside a paragraph to leave a note.
            </p>
          )}
          {layout.map(position => {
            const note = notesById.get(position.id)!;
            const expanded = active === note.id;
            const detached = !validAnchor(editor, note.anchor);
            const line =
              !detached &&
              lineByPath.get(
                Range.start(note.anchor!).path.slice(0, -1).join("."),
              );
            const temp = floating[note.id];
            return (
              <section
                key={note.id}
                data-annotation-id={note.id}
                ref={expanded ? activeCard : undefined}
                className={`ws-annotation-card ${expanded ? "is-active" : ""} ${temp ? "is-floating" : ""} ${dragging === note.id ? "is-dragging" : ""}`}
                style={
                  temp
                    ? {
                        position: "fixed",
                        left: temp.x,
                        top: temp.y,
                        zIndex:
                          dragging === note.id ? 102 : expanded ? 101 : 100,
                      }
                    : { top: position.top, zIndex: expanded ? 3 : 1 }
                }
                aria-label={
                  detached
                    ? "Unattached note"
                    : `Note on paragraph ${line ? line.number : ""}`
                }
              >
                <header>
                  <button
                    type="button"
                    className="ws-note-select"
                    aria-expanded={expanded}
                    onClick={() => (expanded ? setActive(null) : select(note))}
                  >
                    <span>
                      {detached ? "Unattached · text removed" : "Note"}
                    </span>
                    {!expanded && (
                      <span className="ws-note-preview">
                        {note.content || "New note"}
                      </span>
                    )}
                    <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                  </button>
                  {expanded && !readOnly && <button type="button" className="ws-note-delete" onClick={() => setPendingDelete(note.id)}>Delete</button>}
                  <button
                    type="button"
                    className="ws-note-drag"
                    aria-label="Drag note"
                    title="Drag note; use arrow keys to move, Escape to return to margin"
                    onKeyDown={event => {
                      if (event.key === "Escape") {
                        setFloating(current => {
                          const next = { ...current };
                          delete next[note.id];
                          return next;
                        });
                        return;
                      }
                      const delta: Record<string, Position> = {
                        ArrowLeft: { x: -16, y: 0 },
                        ArrowRight: { x: 16, y: 0 },
                        ArrowUp: { x: 0, y: -16 },
                        ArrowDown: { x: 0, y: 16 },
                      };
                      if (!delta[event.key]) return;
                      event.preventDefault();
                      const rect = event.currentTarget
                        .closest("section")!
                        .getBoundingClientRect();
                      setFloating(current => ({
                        ...current,
                        [note.id]: {
                          x: Math.max(
                            8,
                            Math.min(
                              window.innerWidth - rect.width - 8,
                              rect.left + delta[event.key].x,
                            ),
                          ),
                          y: Math.max(
                            8,
                            Math.min(
                              window.innerHeight - rect.height - 8,
                              rect.top + delta[event.key].y,
                            ),
                          ),
                        },
                      }));
                    }}
                    onPointerDown={event => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      const rect = event.currentTarget
                        .closest("section")!
                        .getBoundingClientRect();
                      drag.current = {
                        id: note.id,
                        x: event.clientX,
                        y: event.clientY,
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                      };
                      setDragging(note.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={event => {
                      const start = drag.current;
                      if (!start || start.id !== note.id) return;
                      setFloating(current => ({
                        ...current,
                        [note.id]: {
                          x: Math.max(
                            8,
                            Math.min(
                              window.innerWidth - start.width - 8,
                              start.left + event.clientX - start.x,
                            ),
                          ),
                          y: Math.max(
                            8,
                            Math.min(
                              window.innerHeight - start.height - 8,
                              start.top + event.clientY - start.y,
                            ),
                          ),
                        },
                      }));
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                      setDragging(null);
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      setDragging(null);
                    }}
                  >
                    ⠿
                  </button>
                </header>
                {expanded && (
                  <div className="ws-note-body">
                    {note.quote && (
                      <blockquote title={note.quote}>{note.quote}</blockquote>
                    )}
                    {detached && (
                      <p>The original text was removed. Your note is safe.</p>
                    )}
                    {detached && !readOnly && (
                      <button
                        type="button"
                        disabled={
                          !editor.selection ||
                          Range.isCollapsed(editor.selection)
                        }
                        onClick={() => {
                          if (
                            !editor.selection ||
                            Range.isCollapsed(editor.selection)
                          )
                            return;
                          const anchor = structuredClone(editor.selection);
                          onChange(
                            notes.map(entry =>
                              entry.id === note.id
                                ? {
                                    ...entry,
                                    anchor,
                                    quote: Editor.string(editor, anchor).slice(
                                      0,
                                      500,
                                    ),
                                  }
                                : entry,
                            ),
                          );
                        }}
                      >
                        Attach to selected text
                      </button>
                    )}
                    <textarea
                      autoFocus={!readOnly && !note.content}
                      aria-label="Annotation text"
                      placeholder="Leave a thought…"
                      readOnly={readOnly}
                      maxLength={50000}
                      value={note.content}
                      onFocus={() => setActive(note.id)}
                      onChange={event =>
                        onChange(
                          notes.map(entry =>
                            entry.id === note.id
                              ? { ...entry, content: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                    <footer>
                      {temp && (
                        <button
                          type="button"
                          onClick={() =>
                            setFloating(current => {
                              const next = { ...current };
                              delete next[note.id];
                              return next;
                            })
                          }
                        >
                          Return to margin
                        </button>
                      )}
                      <span>Saves automatically with manuscript</span>
                    </footer>
                  </div>
                )}
              </section>
            );
          })}
          {legacyNotes && (
            <div
              ref={legacy}
              className="ws-previous-notes"
              style={{ top: extent + 64 }}
            >
              {legacyNotes}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
