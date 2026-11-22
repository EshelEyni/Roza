import { useRef, useState } from "react";
import type { BookListPrefs, BookSummary } from "../../../../../shared/types/stagingRoom";
import { formatDate } from "./format";

export function BookList({
  books,
  prefs,
  selected,
  onSelect,
  onRefresh,
  onImport,
  importing,
  onPrefsChange,
}: {
  books: BookSummary[];
  prefs: BookListPrefs;
  selected?: string;
  onSelect: (slug: string) => void;
  onRefresh: () => void;
  onImport: (files: File[]) => void;
  importing: boolean;
  onPrefsChange: (prefs: BookListPrefs) => void;
}) {
  const folderInput = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ slug: string; after: boolean }>();

  const hidden = new Set(prefs.hidden);
  const hiddenCount = books.filter((b) => hidden.has(b.slug)).length;
  const visible = prefs.showHidden ? books : books.filter((b) => !hidden.has(b.slug));

  const toggleHidden = (slug: string) =>
    onPrefsChange({
      ...prefs,
      hidden: hidden.has(slug) ? prefs.hidden.filter((s) => s !== slug) : [...prefs.hidden, slug],
    });

  // Reorder within the full list (hidden books keep their place even while not shown).
  const drop = (target: string, after: boolean) => {
    const from = dragging;
    setDragging(undefined);
    setDropTarget(undefined);
    if (!from || from === target) return;
    const order = books.map((b) => b.slug).filter((s) => s !== from);
    const at = order.indexOf(target);
    order.splice(after ? at + 1 : at, 0, from);
    onPrefsChange({ ...prefs, order });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h3>Books</h3>
        <div className="row gap-xs">
          <button className="btn-ghost sm" onClick={onRefresh} aria-label="Refresh projects" title="Refresh projects">
            ↻
          </button>
          <input
            hidden
            type="file"
            ref={element => {
              folderInput.current = element;
              element?.setAttribute("webkitdirectory", "");
            }}
            onChange={event => {
              onImport(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <button className="btn-ghost sm" disabled={importing} onClick={() => folderInput.current?.click()}>
            {importing ? "Importing…" : "Import folder"}
          </button>
        </div>
      </div>
      {hiddenCount > 0 && (
        <label className="show-hidden">
          <input
            type="checkbox"
            checked={prefs.showHidden}
            onChange={(e) => onPrefsChange({ ...prefs, showHidden: e.target.checked })}
          />
          Show hidden ({hiddenCount})
        </label>
      )}
      <ul className="book-list">
        {visible.map((b) => {
          const isHidden = hidden.has(b.slug);
          const drop_ = dropTarget?.slug === b.slug ? (dropTarget.after ? "drop-after" : "drop-before") : "";
          return (
            <li
              key={b.slug}
              className={`book-item ${dragging === b.slug ? "dragging" : ""} ${drop_}`}
              draggable
              onDragStart={(e) => {
                setDragging(b.slug);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", b.slug);
              }}
              onDragEnd={() => {
                setDragging(undefined);
                setDropTarget(undefined);
              }}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                if (dropTarget?.slug !== b.slug || dropTarget.after !== after) setDropTarget({ slug: b.slug, after });
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(b.slug, dropTarget?.slug === b.slug ? dropTarget.after : false);
              }}
            >
              <button
                className={`book-card ${b.slug === selected ? "selected" : ""} ${isHidden ? "is-hidden" : ""}`}
                onClick={() => onSelect(b.slug)}
              >
                <div className="book-card-title" dir="auto">
                  {b.bookName}
                </div>
                <div className="book-card-meta">
                  <span className="lang">{b.language.toUpperCase()}</span>
                  <span>{b.chapterCount} ch</span>
                  <span>{b.words.toLocaleString()} words</span>
                </div>
                <div className="book-card-foot">
                  {b.errors.length ? (
                    <span className="badge danger">{b.errors.length} issue(s)</span>
                  ) : b.prodBookId ? (
                    <span className="badge ok">In prod · {formatDate(b.lastUploadAt)}</span>
                  ) : (
                    <span className="badge neutral">Not uploaded</span>
                  )}
                  <span className="slug">{b.slug}</span>
                </div>
              </button>
              <button
                className="book-hide-btn"
                title={isHidden ? "Unhide this book" : "Hide this book"}
                onClick={() => toggleHidden(b.slug)}
              >
                {isHidden ? "Unhide" : "Hide"}
              </button>
            </li>
          );
        })}
        {!books.length && <li className="muted pad">No projects in Staging Room.</li>}
        {books.length > 0 && !visible.length && <li className="muted pad">All books are hidden.</li>}
      </ul>
    </aside>
  );
}
