import type { ReactNode } from "react";
import type { BookDetail, EntitySummary, ProdStatus, UploadResult } from "../../../../../shared/types/stagingRoom";
import { formatDate, statusLabel } from "./format";
import { needsReview, ReviewEntry } from "./review/reviewModel";
import { pullItems, pushItems } from "./SyncDialog";

export type BookTab = "overview" | "changes" | "history";

interface Props {
  book: BookDetail;
  status?: ProdStatus;
  entries: ReviewEntry[];
  busy: string;
  lastResult?: UploadResult;
  tab: BookTab;
  onTab: (tab: BookTab) => void;
  onCompare: () => void;
  onPull: () => void;
  onPush: () => void;
  onPreview: (file: string) => void;
  onReview: (key: string) => void;
  onEdit: (file: string) => void;
  /** the Changes and History tabs */
  children?: ReactNode;
}

export function BookView(p: Props) {
  const { book, status, entries } = p;
  const byFile = new Map((status?.chapters || []).filter((c) => c.file).map((c) => [c.file!, c]));
  const prodOnly = (status?.chapters || []).filter((c) => c.status === "prod-only");
  const hasErrors = book.errors.length > 0;
  const working = p.busy !== "";
  const pushCount = status ? pushItems(status).length + (status.edits?.length || 0) : 0;
  const pullCount = status ? pullItems(status).length : 0;
  const accepted = entries.filter((e) => e.accepted).length;
  const toReview = entries.filter(needsReview).length;
  const conflicts = entries.filter((e) => e.direction === "conflict").length;
  const sources = new Map<string, number>();
  for (const e of entries) {
    const name = e.source?.name || "No record";
    sources.set(name, (sources.get(name) || 0) + 1);
  }

  return (
    <div className={`book ${p.tab !== "overview" ? "wide" : ""}`}>
      <section className="book-head">
        <div>
          <div className="eyebrow">
            {book.language.toUpperCase()} · user {book.userId}
          </div>
          <h1 dir="auto">{book.bookName}</h1>
          <div className="muted">
            {book.prodBookId ? (
              <>
                Live book <code>{book.prodBookId}</code> · last upload {formatDate(book.lastUploadAt)}
              </>
            ) : (
              "Not uploaded yet"
            )}
          </div>
        </div>
        <div className="actions">
          <button className="btn-ghost" onClick={p.onCompare} disabled={working} title="Compare this staged project with the live manuscript">
            {p.busy === "status" || p.busy === "load" ? "Comparing…" : "Compare"}
          </button>
          <button className="btn-secondary" onClick={p.onPull} disabled={working || hasErrors || !status?.bookExists}>
            {p.busy === "pull" ? "Pulling…" : "Pull"}
            {pullCount > 0 && <span className="count">{pullCount}</span>}
          </button>
          <button className="btn-primary" onClick={p.onPush} disabled={working || hasErrors}>
            {p.busy === "upload" ? "Pushing…" : accepted ? "Push accepted" : "Push"}
            {(accepted || pushCount) > 0 && <span className="count light">{accepted || pushCount}</span>}
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

      {status && p.tab === "overview" && (
        <div className={`callout review-callout ${conflicts ? "danger" : status.bookExists ? "info" : "neutral"}`}>
          {!status.bookExists ? (
            <span>
              Not in <strong>{status.dbName}</strong> yet. Push creates it.
            </span>
          ) : !entries.length ? (
            <span>
              In sync with <strong>{status.dbName}</strong>. Writing Studio last changed {formatDate(status.prodUpdatedAt)}.
            </span>
          ) : (
            <>
              <div className="grow">
                <strong>
                  {entries.length} difference{entries.length === 1 ? "" : "s"} between Staging and Writing Studio
                </strong>
                <div className="small">
                  {accepted} accepted · {toReview} to review{conflicts ? ` · ${conflicts} changed in both places` : ""}
                </div>
                <div className="small muted">
                  From: {[...sources].map(([name, n]) => `${name} (${n})`).join(" · ")}
                </div>
              </div>
              <button className="btn-primary" onClick={() => p.onTab("changes")}>
                Review changes
              </button>
            </>
          )}
        </div>
      )}

      <nav className="book-tabs" aria-label="Book sections">
        {(["overview", "changes", "history"] as BookTab[]).map((t) => (
          <button key={t} className={`book-tab ${p.tab === t ? "active" : ""}`} aria-pressed={p.tab === t} onClick={() => p.onTab(t)}>
            {t === "overview" ? "Overview" : t === "changes" ? "Changes" : "History"}
            {t === "changes" && entries.length > 0 && <span className="count">{entries.length}</span>}
          </button>
        ))}
      </nav>

      {p.tab !== "overview" ? (
        p.children
      ) : (
        <>
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
                  <th>Writing Studio</th>
                  <th className="right" />
                </tr>
              </thead>
              <tbody>
                {book.chapters.map((c) => {
                  const st = byFile.get(c.file);
                  const label = st ? st.direction || st.status : undefined;
                  const entry = entries.find((e) => e.key === c.file);
                  return (
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
                            entry?.source ? `changed by ${entry.source.name}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>
                      <td className="right">
                        {c.words.toLocaleString()}
                        {st?.status === "differs" && st.prodWords !== undefined && (
                          <div className="muted small">Studio {st.prodWords.toLocaleString()}</div>
                        )}
                      </td>
                      <td>
                        {label ? <span className={`badge ${label}`}>{statusLabel[label]}</span> : <span className="muted">—</span>}
                        {entry?.accepted && <span className="badge ok xs accepted-badge">Accepted</span>}
                      </td>
                      <td className="right row-actions">
                        <button className="link small" onClick={() => p.onEdit(c.file)}>
                          Edit
                        </button>
                        {entry && (
                          <button className="link small" onClick={() => p.onReview(entry.key)}>
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {prodOnly.map((c) => (
                  <tr key={c.key} className="prod-only">
                    <td className="num">·</td>
                    <td dir="auto">{c.name}</td>
                    <td className="right">{c.prodWords?.toLocaleString()}</td>
                    <td>
                      <span className="badge prod-only">{statusLabel["prod-only"]}</span>
                    </td>
                    <td className="right">
                      <button className="link small" onClick={() => p.onReview(c.key)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="entities">
            {(["characters", "themes", "plotlines", "notes"] as const).map((kind) => (
              <EntityGroup key={kind} kind={kind} items={book[kind]} status={status} onReview={p.onReview} />
            ))}
          </section>
        </>
      )}
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
  "prod-only": ["prod-only", "only in Writing Studio"],
  push: ["push", "edited in Staging"],
  pull: ["pull", "edited in Writing Studio"],
  conflict: ["conflict", "edited in both"],
};

function EntityGroup({
  kind,
  items,
  status,
  onReview,
}: {
  kind: string;
  items: EntitySummary[];
  status?: ProdStatus;
  onReview: (key: string) => void;
}) {
  const changes = (status?.entityChanges || []).filter((e) => e.kind === kind);
  const prodOnly = changes.filter((e) => e.status === "prod-only");
  if (!items.length && !prodOnly.length) return null;
  return (
    <div className="panel entity-group">
      <h3>{kind}</h3>
      <ul>
        {items.map((e) => {
          const ch = changes.find((x) => x.name === e.name);
          const badge = ch ? ENTITY_BADGE[ch.status === "differs" ? ch.direction || "conflict" : ch.status] : undefined;
          const body = (
            <>
              {e.color && <span className="swatch" style={{ background: e.color }} />}
              <span dir="auto">{e.name}</span>
              {badge && <span className={`badge ${badge[0]} xs`}>{badge[1]}</span>}
            </>
          );
          return (
            <li key={e.name}>
              {ch ? (
                <button className="entity clickable" title="Review this change" onClick={() => onReview(`${kind}:${e.name}`)}>
                  {body}
                </button>
              ) : (
                <span className="entity" title={e.text}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
        {prodOnly.map((e) => (
          <li key={`prod-${e.name}`}>
            <button className="entity prod-only clickable" onClick={() => onReview(`${kind}:${e.name}`)}>
              <span dir="auto">{e.name}</span>
              <span className="badge prod-only xs">only in Writing Studio</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
