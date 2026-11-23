import { useEffect, useState } from "react";
import type { ChangeView, StagedBookView } from "../../../../../shared/types/stagingRoom";
import { ago } from "./format";

type Group = { key: string; title: string; order: number; items: ChangeView[] };

/** Chapters in book order (new chapters after the one they follow), then story elements, then tasks. */
function groupsOf(changes: ChangeView[]): Group[] {
  const map = new Map<string, Group>();
  for (const c of changes) {
    const g = c.group;
    const key = g.type === "chapter" ? `ch:${g.chapterId}` : g.type;
    const title = g.type === "chapter" ? g.name : g.type === "elements" ? "Story elements" : "Tasks";
    const order = g.type === "chapter" ? g.order : g.type === "elements" ? 1e9 : 1e9 + 1;
    if (!map.has(key)) map.set(key, { key, title, order, items: [] });
    map.get(key)!.items.push(c);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

const LIVE_MS = 3 * 60_000;

export function ChangesView({
  tabs,
  book,
  busy,
  onBack,
  onRead,
  onEdit,
  onApprove,
  onDiscard,
}: {
  tabs: React.ReactNode;
  book: StagedBookView;
  busy: boolean;
  onBack: () => void;
  onRead: (id: string) => void;
  onEdit: (id: string) => void;
  onApprove: (ids: string[]) => void;
  onDiscard: (ids: string[]) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);
  const groups = groupsOf(book.changes);
  const all = book.changes.map((c) => c.id);
  const live = book.lastClaudeSave && now - Date.parse(book.lastClaudeSave.at) < LIVE_MS ? book.lastClaudeSave : undefined;

  return (
    <section className="sr-changes" aria-labelledby="sr-book-title">
      <button className="sr-back sr-mobile-only" onClick={onBack}>
        ← Books
      </button>
      <header className="sr-changes-head">
        <div>
          <h1 id="sr-book-title" className="sr-title" dir="auto">
            {book.bookName}
          </h1>
          <p className="sr-muted">
            {book.changes.length
              ? `${book.changes.length} change${book.changes.length === 1 ? "" : "s"} waiting. Your Writing Studio book stays as it is until you approve.`
              : "Nothing waiting."}
            {!book.linked && " This book is not in Writing Studio yet. Approving creates it."}
          </p>
        </div>
        {all.length > 0 && (
          <button className="sr-btn sr-btn-primary sr-approve-all" disabled={busy} onClick={() => onApprove(all)}>
            Approve all ({all.length})
          </button>
        )}
      </header>
      {tabs}

      {live && (
        <p className="sr-live" role="status">
          <span className="sr-dot" aria-hidden="true" />
          Claude is working on {live.title} · last save {ago(live.at, now)}
        </p>
      )}

      {!book.changes.length && (
        <div className="sr-empty">
          <p>Ask Claude to edit a chapter of “{book.bookName}” in Staging. Its changes show up here for you to read, edit and approve.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="sr-group" aria-label={g.title}>
          <div className="sr-group-head">
            <h2 dir="auto">{g.title}</h2>
            {g.items.length > 1 && (
              <button className="sr-btn sr-btn-quiet sm" disabled={busy} onClick={() => onApprove(g.items.map((c) => c.id))}>
                Approve {g.key.startsWith("ch:") ? "chapter" : "all"}
              </button>
            )}
          </div>
          {g.items.map((c) => (
            <div key={c.id} className="sr-change">
              <span className={`sr-tag ${c.tone}`}>{c.tag}</span>
              <div className="sr-change-body">
                {c.readable ? (
                  <button className="sr-change-title" onClick={() => onRead(c.id)} dir="auto">
                    {c.title}
                  </button>
                ) : (
                  <span className="sr-change-title" dir="auto">
                    {c.title}
                  </span>
                )}
                <span className="sr-muted small">{c.meta}</span>
                {c.warning && <span className="sr-warning small">{c.warning}</span>}
              </div>
              <div className="sr-change-actions">
                {c.readable && (
                  <button className="sr-btn sr-btn-line sm sr-desktop-only" onClick={() => onRead(c.id)}>
                    Read
                  </button>
                )}
                {c.editable && (
                  <button className="sr-btn sr-btn-line sm" onClick={() => onEdit(c.id)}>
                    Edit
                  </button>
                )}
                <button className="sr-btn sr-btn-quiet sm" disabled={busy} onClick={() => onDiscard([c.id])}>
                  Discard
                </button>
                <button className="sr-btn sr-btn-primary sm" disabled={busy} onClick={() => onApprove([c.id])}>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}

      {all.length > 0 && (
        <div className="sr-bottom-bar sr-mobile-only">
          <button className="sr-btn sr-btn-primary" disabled={busy} onClick={() => onApprove(all)}>
            Approve all ({all.length})
          </button>
        </div>
      )}
    </section>
  );
}
