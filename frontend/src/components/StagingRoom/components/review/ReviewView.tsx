import { useEffect, useMemo, useState } from "react";
import type { ReviewPart, RevertTarget } from "../../../../../../shared/types/stagingRoom";
import { formatDate } from "../format";
import { ChangeCards } from "./ChangeCards";
import { DiffBlocks, DiffLayout } from "./DiffBlocks";
import { RejectChoice, RejectDialog } from "./RejectDialog";
import {
  changeCount,
  groupOrder,
  letterOf,
  markOf,
  needsReview,
  rejectWords,
  ReviewEntry,
  sourceInitial,
  stateOf,
  wholeTarget,
} from "./reviewModel";

type Filter = "all" | "review" | "accepted";
const LAYOUT_KEY = "roza.stagingRoom.diffLayout";

function storedLayout(): DiffLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "unified" ? "unified" : "split";
  } catch {
    return "split";
  }
}

interface RejectContext {
  part?: ReviewPart;
  hunk?: number;
  itemId?: string;
  itemTitle?: string;
}

function rejectChoices(entry: ReviewEntry, entries: ReviewEntry[], ctx: RejectContext): RejectChoice[] {
  const out: RejectChoice[] = [];
  if (ctx.hunk !== undefined)
    out.push({
      id: "hunk",
      label: "Only this change",
      detail: `Change ${ctx.hunk + 1} in the text of “${entry.title}”`,
      targets: [{ key: entry.key, part: "text", hunk: ctx.hunk }],
    });
  if (ctx.itemId && ctx.part)
    out.push({
      id: "item",
      label: `Only this ${ctx.part.id === "drafts" ? "draft" : "note"}`,
      detail: ctx.itemTitle || "",
      targets: [{ key: entry.key, part: ctx.part.id, itemId: ctx.itemId }],
    });
  if (ctx.part && entry.partReject && entry.parts.length > 1)
    out.push({
      id: "part",
      label: `All ${ctx.part.label.toLowerCase()} changes in this chapter`,
      detail: `${ctx.part.changes} change${ctx.part.changes === 1 ? "" : "s"}. The rest of the chapter stays as it is in Staging.`,
      targets: [{ key: entry.key, part: ctx.part.id }],
    });
  out.push({
    id: "whole",
    label: entry.kind === "chapter" ? "The whole chapter" : entry.kind === "book" ? "All book settings" : "The whole item",
    detail: rejectWords(entry),
    targets: [wholeTarget(entry)],
  });
  const source = entry.source;
  if (source) {
    const same = entries.filter((e) => e.source?.name === source.name && e.source.kind === source.kind);
    if (same.length > 1)
      out.push({
        id: "source",
        label: `Everything from ${source.name}`,
        detail: `${same.length} items: ${same.slice(0, 4).map((e) => e.title).join(", ")}${same.length > 4 ? ", …" : ""}`,
        targets: same.map(wholeTarget),
      });
  }
  if (entries.length > 1)
    out.push({
      id: "all",
      label: "Reset all of Staging",
      detail: `Throw away all ${entries.length} differences. Staging becomes a copy of Writing Studio.`,
      targets: entries.map(wholeTarget),
      danger: true,
    });
  return out;
}

export function ReviewView({
  entries,
  selectedKey,
  busy,
  onSelect,
  onAccept,
  onReject,
  onEdit,
  onHistory,
}: {
  entries: ReviewEntry[];
  selectedKey?: string;
  busy: boolean;
  onSelect: (key: string) => void;
  onAccept: (entry: ReviewEntry, accepted: boolean) => Promise<void>;
  onReject: (targets: RevertTarget[]) => void;
  onEdit: (file: string) => void;
  onHistory: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [layout, setLayoutState] = useState<DiffLayout>(storedLayout);
  const [partId, setPartId] = useState<string>();
  const [hunkIndex, setHunkIndex] = useState(0);
  const [reject, setReject] = useState<{ choices: RejectChoice[]; initial: string }>();

  const setLayout = (next: DiffLayout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* the choice is only a convenience */
    }
  };

  const counts = {
    all: entries.length,
    review: entries.filter(needsReview).length,
    accepted: entries.filter((e) => e.accepted).length,
  };
  const shown = entries.filter(
    (e) =>
      (filter === "all" || (filter === "review" ? needsReview(e) : e.accepted)) &&
      (!query.trim() || `${e.title} ${e.meta} ${e.source?.name || ""}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const entry = entries.find((e) => e.key === selectedKey) ?? shown[0] ?? entries[0];
  const part = entry?.parts.find((p) => p.id === partId) ?? entry?.parts[0];
  const hunks = useMemo(
    () => (part?.blocks || []).flatMap((b) => (b.kind === "change" ? [b.hunk] : [])),
    [part],
  );

  useEffect(() => {
    setHunkIndex(0);
  }, [entry?.key, part?.id]);
  useEffect(() => {
    if (entry && entry.key !== selectedKey) onSelect(entry.key);
  }, [entry, selectedKey, onSelect]);

  if (!entries.length)
    return (
      <div className="empty review-empty">
        <h2>Nothing to review</h2>
        <p>Staging and Writing Studio match.</p>
      </div>
    );

  const jump = (index: number) => {
    const next = Math.max(0, Math.min(hunks.length - 1, index));
    setHunkIndex(next);
    document.getElementById(`hunk-${hunks[next]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const openReject = (ctx: RejectContext) => {
    if (!entry) return;
    const choices = rejectChoices(entry, entries, ctx);
    setReject({ choices, initial: choices[0].id });
  };

  const accept = async (value: boolean) => {
    if (!entry) return;
    await onAccept(entry, value);
    if (value) {
      const next = entries.find((e) => e.key !== entry.key && needsReview(e));
      if (next) onSelect(next.key);
    }
  };

  const state = entry ? stateOf(entry) : undefined;
  const textHunkReject = entry?.partReject && part?.id === "text";

  return (
    <div className="review">
      <aside className="review-tree" aria-label="Changed items">
        <label className="review-search">
          <span className="sr-only">Filter changes</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter changes" />
        </label>
        <div className="review-filters" role="group" aria-label="Show">
          {(["all", "review", "accepted"] as Filter[]).map((f) => (
            <button key={f} className={`chip-btn ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "review" ? "To review" : "Accepted"} {counts[f]}
            </button>
          ))}
        </div>
        {groupOrder.map((group) => {
          const items = shown.filter((e) => e.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="review-group">
              <div className="eyebrow">{group}</div>
              {items.map((e) => (
                <button key={e.key} className={`review-item ${e.key === entry?.key ? "selected" : ""}`} onClick={() => onSelect(e.key)}>
                  <span className={`letter l-${letterOf(e) === "!" ? "c" : letterOf(e).toLowerCase()}`} aria-hidden="true">
                    {letterOf(e)}
                  </span>
                  <span className="review-item-body">
                    <span className="review-item-title" dir="auto">
                      {e.number !== undefined ? `${e.number} · ` : ""}
                      {e.title}
                    </span>
                    <span className="muted small">
                      {[stateOf(e).label, e.source?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`review-mark ${e.accepted ? "ok" : ""}`}>{markOf(e)}</span>
                </button>
              ))}
            </div>
          );
        })}
        <div className="review-legend small muted">
          <span><b className="l-a">A</b> new in Staging</span>
          <span><b className="l-m">M</b> changed</span>
          <span><b className="l-d">D</b> missing in Staging</span>
          <span><b className="l-c">!</b> changed in both</span>
        </div>
      </aside>

      {entry && state && (
        <section className="review-main">
          <div className="review-card">
            <div className="review-head">
              <div className="review-title">
                <div className="eyebrow">
                  {entry.group} · {entry.meta}
                </div>
                <h2 dir="auto">{entry.title}</h2>
              </div>
              <span className={`badge ${state.tone}`}>{state.label}</span>
              <div className="review-actions">
                {entry.kind === "chapter" && entry.file && entry.change !== "removed" && (
                  <button className="btn-ghost" onClick={() => onEdit(entry.file!)}>
                    Edit in Staging
                  </button>
                )}
                <button className="btn-secondary reject-btn" disabled={busy} onClick={() => openReject({ part })}>
                  {entry.change === "removed" ? "Copy into Staging…" : "Reject…"}
                </button>
                {entry.change !== "removed" &&
                  (entry.accepted ? (
                    <button className="btn-secondary" disabled={busy} onClick={() => accept(false)}>
                      ✓ Accepted · undo
                    </button>
                  ) : (
                    <button className="btn-primary" disabled={busy || !entry.print} onClick={() => accept(true)}>
                      Accept
                    </button>
                  ))}
              </div>
            </div>

            <div className="review-source">
              <span className="avatar" aria-hidden="true">
                {sourceInitial(entry.source)}
              </span>
              {entry.source ? (
                <span>
                  <strong>{entry.source.name}</strong> · {formatDate(entry.source.at)} · <span className="muted">{entry.source.summary}</span>
                </span>
              ) : (
                <span className="muted">No record of who made this change. It happened before Staging kept a history.</span>
              )}
              <button className="link small" onClick={onHistory}>
                History
              </button>
            </div>

            {entry.direction === "pull" && (
              <p className="callout neutral small">
                Only Writing Studio changed this since the last sync. If you accept it, Push puts the Staging version over Writing
                Studio's newer one. To keep Writing Studio's version, reject it.
              </p>
            )}
            {entry.direction === "conflict" && (
              <p className="callout danger small">
                Both Staging and Writing Studio changed this since the last sync. Accept keeps Staging's version (Push overwrites
                Writing Studio). Reject keeps Writing Studio's version. You can also edit the Staging copy first.
              </p>
            )}
            {entry.change === "added" && (
              <p className="callout info small">This only exists in Staging. Push adds it to Writing Studio. Reject removes it from Staging.</p>
            )}
            {entry.change === "removed" && (
              <p className="callout neutral small">
                This is in Writing Studio but not in Staging. Push leaves Writing Studio's copy alone. Copy it into Staging to work on it here.
              </p>
            )}

            {entry.parts.length > 0 && (
              <div className="review-toolbar">
                <nav className="segmented" aria-label="Parts">
                  {entry.parts.map((p) => (
                    <button key={p.id} className={p.id === part?.id ? "on" : ""} aria-pressed={p.id === part?.id} onClick={() => setPartId(p.id)}>
                      {p.label} <span className="muted">{p.changes}</span>
                    </button>
                  ))}
                </nav>
                <div className="segmented" role="group" aria-label="Layout">
                  <button className={layout === "split" ? "on" : ""} aria-pressed={layout === "split"} onClick={() => setLayout("split")}>
                    Side by side
                  </button>
                  <button className={layout === "unified" ? "on" : ""} aria-pressed={layout === "unified"} onClick={() => setLayout("unified")}>
                    Inline
                  </button>
                </div>
                {hunks.length > 1 && (
                  <div className="hunk-nav">
                    <button className="btn-ghost sm" aria-label="Previous change" onClick={() => jump(hunkIndex - 1)} disabled={hunkIndex === 0}>
                      ↑
                    </button>
                    <span className="small">
                      Change <strong>{hunkIndex + 1}</strong> of {hunks.length}
                    </span>
                    <button className="btn-ghost sm" aria-label="Next change" onClick={() => jump(hunkIndex + 1)} disabled={hunkIndex >= hunks.length - 1}>
                      ↓
                    </button>
                  </div>
                )}
              </div>
            )}
            {entry.summary.length > 0 && (
              <ul className="pick-summary small review-summary">
                {entry.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>

          {!part ? (
            <p className="muted review-none">
              Only fields that Staging does not track differ ({changeCount(entry)} shown). Push keeps Writing Studio's version of them.
            </p>
          ) : part.items ? (
            <ChangeCards
              part={part.id}
              items={part.items}
              layout={layout}
              busy={busy}
              onReject={
                entry.partReject
                  ? (itemId) => openReject({ part, itemId, itemTitle: part.items!.find((i) => i.id === itemId)?.title })
                  : undefined
              }
            />
          ) : (
            <DiffBlocks
              blocks={part.blocks || []}
              layout={layout}
              numbered={part.id === "text"}
              idPrefix="hunk"
              headerFor={(hunk) => (
                <>
                  <strong>Change {hunk + 1}</strong>
                  {textHunkReject && (
                    <button className="btn-secondary sm reject-btn" disabled={busy} onClick={() => openReject({ part, hunk })}>
                      Reject · keep Studio's
                    </button>
                  )}
                </>
              )}
            />
          )}
        </section>
      )}

      {reject && (
        <RejectDialog
          choices={reject.choices}
          initial={reject.initial}
          onCancel={() => setReject(undefined)}
          onConfirm={(targets) => {
            setReject(undefined);
            onReject(targets);
          }}
        />
      )}
    </div>
  );
}
