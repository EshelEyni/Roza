import { useEffect, useRef, useState } from "react";
import type { LiveBookOption, StagedBookSummary, StagingPrefs } from "../../../../../shared/types/stagingRoom";
import { api, errorText } from "../api";
import { SidebarIcon } from "./SidebarIcon";

const FILTERS: { id: StagingPrefs["filter"]; label: string }[] = [
  { id: "pinned", label: "Pinned" },
  { id: "unpinned", label: "Unpinned" },
  { id: "all", label: "All" },
];

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" />
    </svg>
  );
}

/** The staged books, with pins and a Pinned / Unpinned / All filter. */
export function BookList({
  books,
  prefs,
  selected,
  importing,
  onSelect,
  onImport,
  onPrefs,
  onStaged,
  onClose,
}: {
  onClose: () => void;
  books: StagedBookSummary[];
  prefs: StagingPrefs;
  selected?: string;
  importing: boolean;
  onSelect: (slug: string) => void;
  onImport: (files: File[]) => void;
  onPrefs: (prefs: Partial<StagingPrefs>) => void;
  onStaged: (slug: string) => void;
}) {
  const folderInput = useRef<HTMLInputElement | null>(null);
  const [picking, setPicking] = useState(false);
  const pinned = new Set(prefs.pinned);
  const shown = books.filter((b) => (prefs.filter === "all" ? true : prefs.filter === "pinned" ? pinned.has(b.slug) : !pinned.has(b.slug)));
  const togglePin = (slug: string) =>
    onPrefs({ pinned: pinned.has(slug) ? prefs.pinned.filter((s) => s !== slug) : [...prefs.pinned, slug] });

  return (
    <aside className="sr-books" aria-label="Staged books">
      <div className="sr-books-head">
        <div className="sr-books-title">
          <h2 className="sr-eyebrow">Books</h2>
          <button className="sr-icon-btn sr-desktop-only" onClick={onClose} aria-label="Close books sidebar" title="Close books sidebar">
            <SidebarIcon open />
          </button>
        </div>
        <div className="sr-row">
          <input
            hidden
            type="file"
            ref={(element) => {
              folderInput.current = element;
              element?.setAttribute("webkitdirectory", "");
            }}
            onChange={(event) => {
              onImport(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <button className="sr-btn sr-btn-quiet sm" disabled={importing} onClick={() => folderInput.current?.click()}>
            {importing ? "Importing…" : "Import folder"}
          </button>
          <button className="sr-btn sr-btn-quiet sm" onClick={() => setPicking(true)}>
            + Stage a book
          </button>
        </div>
      </div>
      <div className="sr-chips" role="group" aria-label="Show books">
        {FILTERS.map((f) => (
          <button key={f.id} className={`sr-chip ${prefs.filter === f.id ? "on" : ""}`} aria-pressed={prefs.filter === f.id} onClick={() => onPrefs({ filter: f.id })}>
            {f.label}
          </button>
        ))}
      </div>
      <ul className="sr-book-list">
        {shown.map((b) => (
          <li key={b.slug} className={`sr-book ${b.slug === selected ? "selected" : ""}`}>
            <button className="sr-book-main" onClick={() => onSelect(b.slug)} aria-current={b.slug === selected ? "true" : undefined}>
              <span className="sr-book-name" dir="auto">
                {b.bookName}
              </span>
              <span className="sr-muted small">
                {b.language.toUpperCase()} · {b.linked ? `${b.chapters} chapters · ${b.words.toLocaleString()} words` : "not in Writing Studio yet"}
              </span>
              {b.pending > 0 && <span className="sr-count">{b.pending} waiting</span>}
            </button>
            <button
              className={`sr-pin ${pinned.has(b.slug) ? "on" : ""}`}
              aria-label={pinned.has(b.slug) ? `Unpin ${b.bookName}` : `Pin ${b.bookName}`}
              aria-pressed={pinned.has(b.slug)}
              onClick={() => togglePin(b.slug)}
            >
              <PinIcon filled={pinned.has(b.slug)} />
            </button>
          </li>
        ))}
        {!books.length && <li className="sr-muted sr-pad">No books yet. Use “Stage a book” to add one.</li>}
        {books.length > 0 && !shown.length && <li className="sr-muted sr-pad">No {prefs.filter} books.</li>}
      </ul>
      {picking && (
        <StageBookDialog
          onClose={() => setPicking(false)}
          onStaged={(slug) => {
            setPicking(false);
            onStaged(slug);
          }}
        />
      )}
    </aside>
  );
}

function StageBookDialog({ onClose, onStaged }: { onClose: () => void; onStaged: (slug: string) => void }) {
  const [books, setBooks] = useState<LiveBookOption[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.liveBooks().then(setBooks, (e) => setError(errorText(e)));
  }, []);
  const stage = async (id: string) => {
    setBusy(true);
    try {
      onStaged((await api.stageBook(id)).slug);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="sr-overlay" onClick={onClose}>
      <div className="sr-modal" role="dialog" aria-modal="true" aria-labelledby="stage-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="stage-title">Stage a book</h2>
        <p className="sr-muted">Choose a Writing Studio book. Claude can then add changes to it here, and nothing reaches the book until you approve.</p>
        {error && <p className="sr-callout danger">{error}</p>}
        {!books && !error && <p className="sr-muted">Loading…</p>}
        <ul className="sr-pick">
          {books?.map((b) => (
            <li key={b.id}>
              <button className="sr-pick-item" disabled={busy || b.staged} onClick={() => stage(b.id)}>
                <span dir="auto">{b.name}</span>
                {b.staged && <span className="sr-muted small">already staged</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="sr-modal-actions">
          <button className="sr-btn sr-btn-quiet" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
