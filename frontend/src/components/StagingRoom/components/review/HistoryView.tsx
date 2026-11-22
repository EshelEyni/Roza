import { useEffect, useState } from "react";
import type { HistoryEvent, HistorySourceKind } from "../../../../../../shared/types/stagingRoom";
import { api, errorText } from "../../api";
import { formatDate } from "../format";

const FILTERS: { id: string; label: string; kinds: HistorySourceKind[] }[] = [
  { id: "all", label: "All", kinds: [] },
  { id: "ai", label: "AI connector", kinds: ["connector"] },
  { id: "editor", label: "Staging editor", kinds: ["editor"] },
  { id: "sync", label: "Pull / Push", kinds: ["pull", "push"] },
  { id: "import", label: "Import", kinds: ["import"] },
  { id: "undo", label: "Reject / Restore", kinds: ["reject", "restore"] },
];

const ICON: Record<HistorySourceKind, string> = {
  connector: "",
  import: "F",
  editor: "E",
  pull: "↓",
  push: "↑",
  reject: "×",
  restore: "↺",
};

/** Readable names for item keys: chapter files, "kind:name", book settings. */
export type KeyNames = (key: string) => string;

/** Every step that changed Staging, newest first, with a way back. */
export function HistoryView({
  slug,
  version,
  keyName,
  onRestored,
  busy,
}: {
  slug: string;
  /** changes whenever Staging changes, so the list reloads */
  version: number;
  keyName: KeyNames;
  onRestored: () => void;
  busy: boolean;
}) {
  const [events, setEvents] = useState<HistoryEvent[]>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirm, setConfirm] = useState<HistoryEvent>();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let alive = true;
    api.history(slug).then(
      (list) => alive && (setEvents(list), setError("")),
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [slug, version]);

  const kinds = FILTERS.find((f) => f.id === filter)?.kinds || [];
  const shown = (events || []).filter((e) => !kinds.length || kinds.includes(e.source));

  const restore = async (event: HistoryEvent) => {
    setWorking(true);
    try {
      await api.restore(slug, event.id);
      setConfirm(undefined);
      onRestored();
    } catch (e) {
      setError(errorText(e));
      setConfirm(undefined);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="history">
      <div className="history-head">
        <p className="muted">Everything that changed Staging, newest first. Each step that replaced something saved a backup first.</p>
        <div className="review-filters" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip-btn ${filter === f.id ? "on" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="callout danger" role="alert">
          {error}
        </p>
      )}
      {!events && !error && <p className="muted">Loading…</p>}
      {events && !shown.length && (
        <p className="muted">{events.length ? "No steps of this kind." : "No history yet. Changes from now on are recorded here."}</p>
      )}
      <ol className="timeline">
        {shown.map((e) => (
          <li key={e.id} className={`timeline-item src-${e.source}`}>
            <div className="timeline-when small muted">{formatDate(e.at)}</div>
            <div className="timeline-dot" aria-hidden="true">
              {ICON[e.source] || (e.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="timeline-card">
              <div className="timeline-title">
                <strong>{e.name}</strong>
                <span dir="auto">{e.summary}</span>
              </div>
              {e.keys.length > 0 && (
                <div className="timeline-keys">
                  {e.keys.slice(0, 12).map((k) => (
                    <span key={k} className="chip" dir="auto">
                      {keyName(k)}
                    </span>
                  ))}
                  {e.keys.length > 12 && <span className="muted small">+{e.keys.length - 12} more</span>}
                </div>
              )}
              {e.backupId && (
                <div className="timeline-actions">
                  <button className="link small" disabled={busy || working} onClick={() => setConfirm(e)}>
                    {e.backupScope === "item" ? "Undo this step" : "Restore Staging to before this"}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {confirm && (
        <div className="overlay" onClick={() => setConfirm(undefined)}>
          <div className="modal confirm" role="dialog" aria-labelledby="restore-title" onClick={(ev) => ev.stopPropagation()}>
            <h2 id="restore-title">{confirm.backupScope === "item" ? "Undo this step?" : "Restore Staging?"}</h2>
            <p>
              {confirm.backupScope === "item"
                ? `Puts back the item “${confirm.summary}” changed, as it was before. Later changes to that same item are undone too. Other items stay as they are.`
                : `Staging goes back to how it was right before “${confirm.summary}”. Every later change to Staging is undone too.`}
            </p>
            <p className="muted small">Writing Studio does not change. The current Staging is backed up first, so this can be undone as well.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirm(undefined)}>
                Cancel
              </button>
              <button className="btn-danger" disabled={working} onClick={() => restore(confirm)}>
                {working ? "Restoring…" : confirm.backupScope === "item" ? "Undo step" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
