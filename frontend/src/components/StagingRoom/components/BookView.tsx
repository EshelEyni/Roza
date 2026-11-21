import { useState } from "react";
import type { BookDetail, EntitySummary, ProdStatus, UploadResult } from "../../../../../shared/types/stagingRoom";
import { DiffView } from "./DiffView";
import { formatDate, statusLabel } from "./format";
import { pullItems, pushItems } from "./SyncDialog";

interface Props {
  book: BookDetail;
  status?: ProdStatus;
  busy: string;
  lastResult?: UploadResult;
  onCompare: () => void;
  onPull: () => void;
  onPush: () => void;
  onPreview: (file: string) => void;
}

export function BookView(p: Props) {
  const { book, status } = p;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const byFile = new Map((status?.chapters || []).filter((c) => c.file).map((c) => [c.file!, c]));
  const prodOnly = (status?.chapters || []).filter((c) => c.status === "prod-only");
  const hasErrors = book.errors.length > 0;
  const working = p.busy !== "";
  const pushCount = status ? pushItems(status).length + (status.edits?.length || 0) : 0;
  const pullCount = status ? pullItems(status).length : 0;
  const conflicts = status
    ? status.chapters.filter((c) => c.direction === "conflict").length +
      (status.entityChanges || []).filter((e) => e.direction === "conflict").length +
      (status.bookChange?.direction === "conflict" ? 1 : 0)
    : 0;

  return (
    <div className="book">
      <section className="book-head">
        <div>
          <div className="eyebrow">
            {book.language.toUpperCase()} · user {book.userId}
          </div>
          <h1 dir="auto">{book.bookName}</h1>
          <div className="muted">
            {book.prodBookId ? (
              <>
                Prod book <code>{book.prodBookId}</code> · last upload {formatDate(book.lastUploadAt)}
              </>
            ) : (
              "Not uploaded yet"
            )}
          </div>
        </div>
        <div className="actions">
          <button className="btn-ghost" onClick={p.onCompare} disabled={working} title="Re-read the local files and compare with Roza">
            {p.busy === "status" || p.busy === "load" ? "Comparing…" : "Compare"}
          </button>
          <button className="btn-secondary" onClick={p.onPull} disabled={working || hasErrors || !status?.bookExists}>
            {p.busy === "pull" ? "Pulling…" : "Pull"}
            {pullCount > 0 && <span className="count">{pullCount}</span>}
          </button>
          <button className="btn-primary" onClick={p.onPush} disabled={working || hasErrors}>
            {p.busy === "upload" ? "Pushing…" : "Push"}
            {pushCount > 0 && <span className="count light">{pushCount}</span>}
          </button>
        </div>
      </section>

      {hasErrors && (
        <div className="callout danger">
          <strong>Fix these before pushing</strong>
          <ul>
            {book.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {p.lastResult && (
        <div className="callout ok">
          <strong>{p.lastResult.created ? "Book created in Roza." : "Pushed to Roza."}</strong>{" "}
          {[
            ...Object.entries(p.lastResult.added)
              .filter(([, n]) => n)
              .map(([k, n]) => `${n} new ${k}`),
            p.lastResult.overwritten ? `${p.lastResult.overwritten} chapter(s) updated` : "",
            p.lastResult.updatedEntities ? `${p.lastResult.updatedEntities} story element(s) updated` : "",
            ...(p.lastResult.edits || []),
          ]
            .filter(Boolean)
            .join(", ") || "Nothing to change"}
          .{p.lastResult.backupPath && <div className="muted small">Roza backup: {p.lastResult.backupPath}</div>}
        </div>
      )}

      {status && (
        <div className={`callout ${conflicts ? "danger" : status.bookExists ? "info" : "neutral"}`}>
          {!status.bookExists ? (
            <>
              Not in <strong>{status.dbName}</strong> yet. Push creates it.
            </>
          ) : pushCount + pullCount === 0 ? (
            <>
              In sync with <strong>{status.dbName}</strong>. Roza last changed {formatDate(status.prodUpdatedAt)}.
            </>
          ) : (
            <>
              {pushCount > 0 && <>{pushCount} local change(s) to push. </>}
              {pullCount > 0 && <>{pullCount} change(s) in Roza to pull. </>}
              {conflicts > 0 && <strong>{conflicts} changed in both places: open "Show changes" and choose a side.</strong>}
            </>
          )}
        </div>
      )}

      <section className="stats">
        <Stat label="Chapters" value={book.chapterCount} />
        <Stat label="Words" value={book.words.toLocaleString()} />
        <Stat label="Characters" value={book.characters.length} />
        <Stat label="Themes" value={book.themes.length} />
        <Stat label="Plotlines" value={book.plotlines.length} />
        <Stat label="Notes" value={book.notes.length} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Chapters</h2>
          {!status && <span className="muted small">{working ? "Comparing with Roza…" : "Not compared with Roza yet."}</span>}
        </div>
        <table className="chapters">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Name</th>
              <th className="right">Words</th>
              <th>Roza</th>
              <th className="right" />
            </tr>
          </thead>
          <tbody>
            {book.chapters.map((c) => {
              const st = byFile.get(c.file);
              const label = st ? st.direction || st.status : undefined;
              return [
                <tr key={c.file} className={c.errors.length ? "has-error" : ""}>
                  <td className="num">{c.number}</td>
                  <td dir="auto">
                    <button className="link" onClick={() => p.onPreview(c.file)}>
                      {c.name}
                    </button>
                    <div className="muted small">
                      {[
                        c.file,
                        c.notes ? `${c.notes} note${c.notes === 1 ? "" : "s"}` : "",
                        c.drafts ? `${c.drafts} draft${c.drafts === 1 ? "" : "s"}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="right">
                    {c.words.toLocaleString()}
                    {st?.status === "differs" && st.prodWords !== undefined && (
                      <div className="muted small">Roza {st.prodWords.toLocaleString()}</div>
                    )}
                  </td>
                  <td>{label ? <span className={`badge ${label}`}>{statusLabel[label]}</span> : <span className="muted">—</span>}</td>
                  <td className="right">
                    {st?.diff && (
                      <button className="link small" onClick={() => toggle(c.file)}>
                        {open.has(c.file) ? "Hide changes" : "Show changes"}
                      </button>
                    )}
                  </td>
                </tr>,
                open.has(c.file) && st?.diff ? (
                  <tr key={`${c.file}-diff`} className="diff-row">
                    <td />
                    <td colSpan={4}>
                      <DiffView diff={st.diff} />
                    </td>
                  </tr>
                ) : null,
              ];
            })}
            {prodOnly.map((c) => (
              <tr key={c.key} className="prod-only">
                <td className="num">·</td>
                <td dir="auto">{c.name}</td>
                <td className="right">{c.prodWords?.toLocaleString()}</td>
                <td>
                  <span className="badge prod-only">{statusLabel["prod-only"]}</span>
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="entities">
        {(["characters", "themes", "plotlines", "notes"] as const).map((kind) => (
          <EntityGroup key={kind} kind={kind} items={book[kind]} status={status} />
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const ENTITY_BADGE: Record<string, [string, string]> = {
  new: ["new", "new"],
  "prod-only": ["prod-only", "only in Roza"],
  push: ["push", "edited here"],
  pull: ["pull", "edited in Roza"],
  conflict: ["conflict", "edited in both"],
};

function EntityGroup({ kind, items, status }: { kind: string; items: EntitySummary[]; status?: ProdStatus }) {
  const [open, setOpen] = useState<string>();
  const changes = (status?.entityChanges || []).filter((e) => e.kind === kind);
  const prodOnly = changes.filter((e) => e.status === "prod-only");
  if (!items.length && !prodOnly.length) return null;
  const openChange = changes.find((e) => e.name === open);
  return (
    <div className="panel entity-group">
      <h3>{kind}</h3>
      <ul>
        {items.map((e) => {
          const ch = changes.find((x) => x.name === e.name);
          const badge = ch ? ENTITY_BADGE[ch.status === "differs" ? ch.direction || "conflict" : ch.status] : undefined;
          return (
            <li
              key={e.name}
              className={`entity ${ch?.diff ? "clickable" : ""} ${open === e.name ? "active" : ""}`}
              title={ch?.diff ? "Show changes" : e.text}
              onClick={() => ch?.diff && setOpen((o) => (o === e.name ? undefined : e.name))}
            >
              {e.color && <span className="swatch" style={{ background: e.color }} />}
              <span dir="auto">{e.name}</span>
              {badge && <span className={`badge ${badge[0]} xs`}>{badge[1]}</span>}
            </li>
          );
        })}
        {prodOnly.map((e) => (
          <li key={`prod-${e.name}`} className="entity prod-only">
            <span dir="auto">{e.name}</span>
            <span className="badge prod-only xs">only in Roza</span>
          </li>
        ))}
      </ul>
      {openChange?.diff && <DiffView diff={openChange.diff} />}
    </div>
  );
}
