import {
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiCornerDownLeft,
  FiMoreHorizontal,
  FiTrash2,
} from "react-icons/fi";
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Editor, Node, Range } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { ChapterAnnotation } from "../../../../shared/types/books";
import { layoutAnnotations, manuscriptLines, validAnchor } from "./annotations";

type Line = { number: number; top: number; range: Range };
type Position = { x: number; y: number };

const UNDO_MS = 5000;
const DRAG_THRESHOLD = 4;

/** Lets the note text box fit its content instead of showing a resize grip. */
const fitText = (element: HTMLTextAreaElement | null) => {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 2}px`;
};

export function AnnotationMargin({
  notes,
  active,
  visible,
  readOnly,
  onChange,
  legacyNotes,
  onActive,
  onAddAtLine,
  onReveal,
  onConfirm,
}: {
  notes: ChapterAnnotation[];
  active: string | null;
  visible: boolean;
  readOnly: boolean;
  onChange: (notes: ChapterAnnotation[]) => void;
  legacyNotes?: ReactNode;
  onActive: (id: string | null) => void;
  onAddAtLine: (line: Range) => void;
  onReveal?: () => void;
  onConfirm?: (note: ChapterAnnotation) => void;
}) {
  const editor = useSlate();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ note: ChapterAnnotation; index: number } | null>(null);
  const undoTimer = useRef<number>();
  const suppressClick = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [positions, setPositions] = useState<{ id: string; top: number; height: number }[]>([]);
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
    moved: boolean;
  } | null>(null);
  const measure = useCallback(() => {
    const container = root.current?.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const prose = container.querySelector('.ws-prose');
    const rowHeight = (element: globalThis.Element | null): number => {
      if (!element) return 38;
      const style = getComputedStyle(element);
      return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.9;
    };
    const defaultHeight = rowHeight(prose);
    const next: Line[] = [];
    for (const [node, path] of manuscriptLines(editor)) {
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
        const block = ReactEditor.toDOMNode(editor, Node.get(editor, point.path.slice(0, -1)));
        const height = rowHeight(block);
        if (rect.height) return { top: rect.top - bounds.top + (rect.height - height) / 2, height };
        return { top: block.getBoundingClientRect().top - bounds.top, height };
      } catch {
        return null;
      }
    };
    let detached = Math.max(0, ...next.map(line => line.top)) + 56;
    const located = notes.filter(note => !note.general).map(note => {
      const top = topOf(note);
      if (top !== null) return { id: note.id, ...top };
      const result = { id: note.id, top: detached, height: defaultHeight };
      detached += defaultHeight + 8;
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
    const typography = new MutationObserver(schedule);
    const studio = container?.closest('.ws');
    if (studio) typography.observe(studio, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      typography.disconnect();
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
  /** Scrolls the note's paragraph to the middle of the screen and flashes it. */
  const jump = (note: ChapterAnnotation) => {
    select(note);
    if (!validAnchor(editor, note.anchor)) return;
    try {
      const point = Range.start(note.anchor);
      const block = ReactEditor.toDOMNode(
        editor,
        Node.get(editor, point.path.slice(0, -1)),
      );
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      block.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
      if (!still)
        block.animate(
          [
            { backgroundColor: "color-mix(in srgb, var(--ws-accent) 28%, transparent)" },
            { backgroundColor: "transparent" },
          ],
          { duration: 1100, easing: "ease-out" },
        );
    } catch {
      /* unmounted range */
    }
  };
  const closeNote = (note: ChapterAnnotation) => {
    setMenuFor(null);
    if (!readOnly && !note.content.trim()) {
      onChange(notes.filter(entry => entry.id !== note.id));
    }
    setActive(null);
  };
  const returnToMargin = (id: string) =>
    setFloating(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  const remove = (note: ChapterAnnotation) => {
    setMenuFor(null);
    if (active === note.id) setActive(null);
    setDeleted({ note, index: notes.findIndex(entry => entry.id === note.id) });
    onChange(notes.filter(entry => entry.id !== note.id));
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setDeleted(null), UNDO_MS);
  };
  const undoDelete = () => {
    if (!deleted) return;
    window.clearTimeout(undoTimer.current);
    const next = notes.filter(entry => entry.id !== deleted.note.id);
    next.splice(Math.min(Math.max(deleted.index, 0), next.length), 0, deleted.note);
    onChange(next);
    setDeleted(null);
  };
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  useEffect(() => {
    if (!menuFor) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        root.current
          ?.querySelector<HTMLElement>(`[data-annotation-id="${menuFor}"] .ws-note-more`)
          ?.focus();
      } else if ((event.target as HTMLElement | null)?.closest(".ws-note-menu, .ws-note-more")) {
        return;
      }
      setMenuFor(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close, true);
    };
  }, [menuFor]);
  const notesById = new Map(notes.filter(note => !note.general).map(note => [note.id, note]));
  // Measurement is committed after render; removed notes must disappear immediately.
  const layout = layoutAnnotations(
    positions.filter(position => notesById.has(position.id)),
    active,
    height,
  );
  const extent = Math.max(
    0,
    ...layout.map(note => note.top + (note.id === active ? height : (note.height || 32))),
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
      {deleted && (
        <div className="ws-note-toast" role="status">
          <span>Note deleted</span>
          <button type="button" onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
      <div className="ws-line-gutter" aria-label="Paragraph numbers and notes">
        {lines.map(line => {
          const attached = notesByLine.get(line.number) || [];
          return (
            <div
              key={line.number}
              className={`ws-line-marker ${attached.length ? "has-notes" : ""}`}
              style={{ top: line.top }}
            >
              <span
                className="ws-line-number"
                title={`Paragraph ${line.number}${attached.length ? ` · ${attached.length} notes` : ""}`}
              >
                {line.number}
                {attached.length > 0 && <span aria-hidden="true"> •</span>}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="ws-add-annotation"
                  aria-label={`Add note to line ${line.number}`}
                  title="Add note"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onAddAtLine(line.range)}
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
          {notes.every(note => note.general) && (
            <p className="ws-annotation-hint">
              Use + beside a paragraph to leave a note.
            </p>
          )}
          {layout.map(position => {
            const note = notesById.get(position.id)!;
            const expanded = active === note.id;
            const detached = !note.general && !validAnchor(editor, note.anchor);
            const line =
              !note.general && !detached &&
              lineByPath.get(
                Range.start(note.anchor!).path.slice(0, -1).join("."),
              );
            const temp = floating[note.id];
            const menuOpen = menuFor === note.id;
            const moveTo = (rect: DOMRect, x: number, y: number) =>
              setFloating(current => ({
                ...current,
                [note.id]: {
                  x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, x)),
                  y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, y)),
                },
              }));
            return (
              <section
                key={note.id}
                data-annotation-id={note.id}
                ref={expanded ? activeCard : undefined}
                className={`ws-annotation-card ${expanded ? "is-active" : ""} ${detached ? "is-detached" : ""} ${temp ? "is-floating" : ""} ${dragging === note.id ? "is-dragging" : ""}`}
                style={
                  temp
                    ? {
                        position: "fixed",
                        left: temp.x,
                        top: temp.y,
                        zIndex:
                          dragging === note.id ? 102 : expanded || menuOpen ? 101 : 100,
                      }
                    : { top: position.top, zIndex: menuOpen ? 4 : expanded ? 3 : 1 }
                }
                aria-label={
                  note.general ? "General note" : detached
                    ? "Unattached note"
                    : `Note on paragraph ${line ? line.number : ""}`
                }
              >
                <header
                  className="ws-note-head"
                  tabIndex={0}
                  aria-label="Move note"
                  title="Drag to move. Arrow keys move it, Escape returns it to the margin."
                  style={{ height: position.height ? position.height - 2 : undefined, minHeight: position.height ? position.height - 2 : undefined }}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Escape") {
                      returnToMargin(note.id);
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
                    moveTo(rect, rect.left + delta[event.key].x, rect.top + delta[event.key].y);
                  }}
                  onPointerDown={event => {
                    if (event.button !== 0) return;
                    if ((event.target as HTMLElement).closest(".ws-note-tools, .ws-note-menu")) return;
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
                      moved: false,
                    };
                  }}
                  onPointerMove={event => {
                    const start = drag.current;
                    if (!start || start.id !== note.id) return;
                    if (!start.moved) {
                      if (
                        Math.hypot(event.clientX - start.x, event.clientY - start.y) <
                        DRAG_THRESHOLD
                      )
                        return;
                      start.moved = true;
                      setMenuFor(null);
                      setDragging(note.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }
                    moveTo(
                      new DOMRect(0, 0, start.width, start.height),
                      start.left + event.clientX - start.x,
                      start.top + event.clientY - start.y,
                    );
                  }}
                  onPointerUp={() => {
                    if (drag.current?.moved) {
                      // A drag that ends over the preview must not also open the note.
                      suppressClick.current = true;
                      window.setTimeout(() => (suppressClick.current = false));
                    }
                    drag.current = null;
                    setDragging(null);
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragging(null);
                  }}
                  onClickCapture={event => {
                    if (!suppressClick.current) return;
                    suppressClick.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={event => {
                    // Clicking anywhere on a closed card's header opens it; its buttons handle themselves.
                    if (!expanded && !(event.target as HTMLElement).closest("button"))
                      select(note);
                  }}
                >
                  <span className="ws-note-anchor">
                    ¶ {detached ? "–" : line ? line.number : ""}
                  </span>
                  {!expanded && (
                    <button
                      type="button"
                      className="ws-note-preview"
                      aria-expanded={false}
                      onClick={() => select(note)}
                    >
                      {note.content || "New note"}
                    </button>
                  )}
                  <div className="ws-note-tools">
                    <button
                      type="button"
                      className="ws-note-icon"
                      aria-label={expanded ? "Close note" : "Open note"}
                      title={expanded ? "Close (Esc)" : "Open note"}
                      aria-expanded={expanded}
                      onClick={() => (expanded ? closeNote(note) : select(note))}
                    >
                      {expanded ? (
                        <FiChevronUp size={15} aria-hidden="true" />
                      ) : (
                        <FiChevronDown size={15} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="ws-note-icon ws-note-more"
                      aria-label="More actions"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuFor(menuOpen ? null : note.id)}
                    >
                      <FiMoreHorizontal size={15} aria-hidden="true" />
                    </button>
                  </div>
                </header>
                {menuOpen && (
                  <div className="ws-note-menu" role="menu" aria-label="Note actions">
                    <button
                      type="button"
                      role="menuitem"
                      autoFocus
                      onClick={() => {
                        navigator.clipboard?.writeText(note.content).catch(() => {});
                        setMenuFor(null);
                      }}
                    >
                      <FiCopy size={14} aria-hidden="true" />
                      Copy note
                    </button>
                    {temp && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          returnToMargin(note.id);
                          setMenuFor(null);
                        }}
                      >
                        <FiCornerDownLeft size={14} aria-hidden="true" />
                        Return to margin
                      </button>
                    )}
                    {!readOnly && (
                      <>
                        <hr />
                        <button
                          type="button"
                          role="menuitem"
                          className="ws-note-danger"
                          onClick={() => remove(note)}
                        >
                          <FiTrash2 size={14} aria-hidden="true" />
                          Delete note
                        </button>
                      </>
                    )}
                  </div>
                )}
                {expanded && (
                  <div className="ws-note-body">
                    {note.quote && !detached && (
                      <button
                        type="button"
                        className="ws-note-quote"
                        title="Show in text"
                        onClick={() => jump(note)}
                      >
                        {note.quote}
                      </button>
                    )}
                    {detached && (
                      <div className="ws-note-detached">
                        <strong>The original text was removed.</strong>
                        Your note is safe.
                        {!readOnly && " Select text in the chapter to pin it there."}
                        {!readOnly && (
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
                      </div>
                    )}
                    <textarea
                      ref={fitText}
                      rows={1}
                      autoFocus={!readOnly && !note.content}
                      aria-label="Annotation text"
                      placeholder="Leave a thought…"
                      readOnly={readOnly}
                      maxLength={50000}
                      value={note.content}
                      onFocus={() => setActive(note.id)}
                      onKeyDown={event => {
                        if (event.nativeEvent.isComposing) return;
                        const plainEnter = event.key === "Enter" &&
                          !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
                        if (event.key !== "Escape" && !plainEnter) return;
                        event.preventDefault();
                        event.stopPropagation();
                        closeNote(note);
                        if (plainEnter) onConfirm?.(note);
                      }}
                      onChange={event => {
                        fitText(event.target);
                        onChange(
                          notes.map(entry =>
                            entry.id === note.id
                              ? { ...entry, content: event.target.value }
                              : entry,
                          ),
                        );
                      }}
                    />
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
