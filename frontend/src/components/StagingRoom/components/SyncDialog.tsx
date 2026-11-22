import { useState } from "react";
import type { ProdStatus } from "../../../../../shared/types/stagingRoom";

interface Item {
  key: string;
  title: string;
  detail: string;
  ticked: boolean;
  locked?: boolean;
  warn?: boolean;
  accepted?: boolean;
  /** who made the change, from History */
  source?: string;
  /** short report of what differs */
  summary?: string[];
}

const kindLabel = (k: string) => k.replace(/s$/, "");
/** Key for the book's own fields (name, word goal, task board, publishing, narrator); matches the main process. */
const BOOK_KEY = "book:settings";

/** Items Push would send: everything that is new or newer locally. Conflicts start unticked. */
export function pushItems(status: ProdStatus): Item[] {
  const items: Item[] = [];
  for (const c of status.chapters) {
    if (c.status === "new")
      items.push({ key: c.key, title: c.name, detail: `new chapter · ${c.localWords?.toLocaleString()} words`, ticked: true, locked: true });
    else if (c.status === "differs" && (c.direction !== "pull" || c.accepted))
      items.push({
        key: c.key,
        title: c.name,
        detail: c.direction === "push" ? "edited locally" : "changed in both places: ticking replaces Roza's version",
        ticked: c.direction === "push",
        warn: c.direction === "conflict",
        accepted: c.accepted,
        source: c.source?.name,
      summary: c.summary,
      });
  }
  for (const e of status.entityChanges || []) {
    const key = `${e.kind}:${e.name}`;
    if (e.status === "new") items.push({ key, title: e.name, detail: `new ${kindLabel(e.kind)}`, ticked: true, locked: true });
    else if (e.status === "differs" && (e.direction !== "pull" || e.accepted))
      items.push({
        key,
        title: e.name,
        detail: `${kindLabel(e.kind)} · ${e.direction === "push" ? "edited locally" : "changed in both places: ticking replaces Roza's version"}`,
        ticked: e.direction === "push",
        warn: e.direction === "conflict",
        accepted: e.accepted,
        source: e.source?.name,
      summary: e.summary,
      });
  }
  const b = status.bookChange;
  if (b && (b.direction !== "pull" || b.accepted))
    items.push({
      key: BOOK_KEY,
      title: "Book settings",
      detail: `name, word goal, task board, publishing, narrator · ${b.direction === "push" ? "edited locally" : "changed in both places: ticking replaces Roza's version"}`,
      ticked: b.direction === "push",
      warn: b.direction === "conflict",
      accepted: b.accepted,
      source: b.source?.name,
      summary: b.summary,
    });
  return items;
}

/** Items Pull would bring back: everything that is only in Roza or newer there. Conflicts start unticked. */
export function pullItems(status: ProdStatus): Item[] {
  const items: Item[] = [];
  for (const c of status.chapters) {
    if (c.status === "prod-only")
      items.push({ key: c.key, title: c.name, detail: `only in Roza · ${c.prodWords?.toLocaleString()} words`, ticked: true });
    else if (c.status === "differs" && c.direction !== "push")
      items.push({
        key: c.key,
        title: c.name,
        detail: c.direction === "pull" ? "edited in Roza" : "changed in both places: ticking replaces your local version",
        ticked: c.direction === "pull",
        warn: c.direction === "conflict",
        accepted: c.accepted,
        source: c.source?.name,
      summary: c.summary,
      });
  }
  for (const e of status.entityChanges || []) {
    const key = `${e.kind}:${e.name}`;
    if (e.status === "prod-only") items.push({ key, title: e.name, detail: `${kindLabel(e.kind)} · only in Roza`, ticked: true });
    else if (e.status === "differs" && e.direction !== "push")
      items.push({
        key,
        title: e.name,
        detail: `${kindLabel(e.kind)} · ${e.direction === "pull" ? "edited in Roza" : "changed in both places: ticking replaces your local version"}`,
        ticked: e.direction === "pull",
        warn: e.direction === "conflict",
        accepted: e.accepted,
        source: e.source?.name,
      summary: e.summary,
      });
  }
  const b = status.bookChange;
  if (b && b.direction !== "push")
    items.push({
      key: BOOK_KEY,
      title: "Book settings",
      detail: `name, word goal, task board, publishing, narrator · ${b.direction === "pull" ? "edited in Roza" : "changed in both places: ticking replaces your local version"}`,
      ticked: b.direction === "pull",
      warn: b.direction === "conflict",
      accepted: b.accepted,
      source: b.source?.name,
      summary: b.summary,
    });
  return items;
}

export function SyncDialog({
  mode,
  status,
  onCancel,
  onConfirm,
}: {
  mode: "push" | "pull";
  status: ProdStatus;
  onCancel: () => void;
  onConfirm: (chapterKeys: string[], entityKeys: string[]) => void;
}) {
  const items = mode === "push" ? pushItems(status) : pullItems(status);
  const edits = mode === "push" ? status.edits || [] : [];
  // Once anything is accepted in Changes, Push starts with exactly the accepted items.
  const reviewed = mode === "push" && items.some((i) => i.accepted);
  const [picked, setPicked] = useState(
    () => new Set(items.filter((i) => i.locked || (reviewed ? i.accepted : i.ticked)).map((i) => i.key)),
  );
  const flip = (set: Set<string>, k: string) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  };
  const isChapter = (k: string) => k.startsWith("prod:") || k.endsWith(".json");
  const other =
    mode === "push"
      ? status.chapters.filter((c) => c.direction === "pull").map((c) => c.name)
      : status.chapters.filter((c) => c.direction === "push" || c.status === "new").map((c) => c.name);
  const count = picked.size + edits.length;
  const nothing = !items.length && !edits.length;

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal confirm wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          {mode === "push" ? "Push to" : "Pull from"} {status.dbName}
        </h2>
        <p className="muted">
          {mode === "push"
            ? "Sends your local changes to Roza. Roza's current book is backed up first."
            : "Copies selected live changes into the staged project after saving a snapshot."}
        </p>
        {reviewed && (
          <p className="small muted">
            Ticked: the changes you accepted. New items are always sent. To keep one out, reject it in Changes.
          </p>
        )}

        {!status.bookExists && mode === "push" ? (
          <p>The book isn't in Roza yet. Push creates it with every local chapter and story element.</p>
        ) : nothing ? (
          <p>{mode === "push" ? "Roza already has all your local changes." : "The staged project already has everything from Roza."}</p>
        ) : (
          <ul className="pick-list">
            {items.map((it) => (
              <li key={it.key} className={it.warn ? "warn" : ""}>
                <div className="pick">
                  <input
                    type="checkbox"
                    checked={picked.has(it.key)}
                    disabled={it.locked}
                    onChange={() => setPicked((s) => flip(s, it.key))}
                  />
                  <div className="pick-body">
                    <div className="pick-head">
                      <div dir="auto" className="pick-title">
                        <strong>{it.title}</strong> <span className="muted small">{it.detail}</span>
                      </div>
                      {it.accepted && <span className="badge ok xs">Accepted</span>}
                      {it.source && <span className="muted small pick-toggle">by {it.source}</span>}
                    </div>
                    {it.summary && it.summary.length > 0 && (
                      <ul className="pick-summary small">
                        {it.summary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {edits.map((e) => (
              <li key={e}>
                <div className="pick">
                  <input type="checkbox" checked disabled />
                  <div className="pick-body">
                    <strong>{e}</strong> <span className="muted small">from book.json</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {other.length > 0 && (
          <p className="muted small">
            {mode === "push" ? "Newer in Roza, pull these first: " : "Newer locally, push these instead: "}
            {other.join(", ")}
          </p>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={status.bookExists || mode === "pull" ? count === 0 : false}
            onClick={() =>
              onConfirm(
                [...picked].filter(isChapter),
                [...picked].filter((k) => !isChapter(k)),
              )
            }
          >
            {mode === "push" ? (status.bookExists ? `Push ${count}` : "Create book") : `Pull ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}
