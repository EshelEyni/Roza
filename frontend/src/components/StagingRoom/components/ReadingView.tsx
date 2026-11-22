import { useEffect, useState } from "react";
import type { ReadView } from "../../../../../shared/types/stagingRoom";
import { api, errorText } from "../api";

const REFRESH_MS = 4000;

/** Reads one change in full. New text is marked green. Removed text is not shown. */
export function ReadingView({
  slug,
  id,
  bookName,
  busy,
  onBack,
  onEdit,
  onApprove,
  onDiscard,
}: {
  slug: string;
  id: string;
  bookName: string;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const [view, setView] = useState<ReadView>();
  const [error, setError] = useState("");

  // Reload now and then, so Claude's saves show while you read.
  useEffect(() => {
    let stop = false;
    const load = () =>
      api.readChange(slug, id).then(
        (v) => !stop && (setView(v), setError("")),
        (e) => !stop && setError(errorText(e)),
      );
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [slug, id]);

  const marks = view?.paragraphs.some((p) => p.segments.some((s) => s.isNew));

  return (
    <section className="sr-read" aria-labelledby="sr-read-title">
      <header className="sr-read-head">
        <button className="sr-back" onClick={onBack}>
          ← <span className="sr-desktop-only">{bookName} · </span>Changes
        </button>
        <div className="sr-read-title">
          <h1 id="sr-read-title" dir="auto">
            {view?.title ?? "…"}
          </h1>
          {view && (
            <span className="sr-muted small">
              {view.subtitle}
              {view.words ? ` · ${view.words.toLocaleString()} words` : ""}
              {marks && (
                <>
                  {" · "}
                  <mark>green</mark> = new compared with Writing Studio
                </>
              )}
            </span>
          )}
        </div>
        <div className="sr-read-actions sr-desktop-only">
          {view?.editable && (
            <button className="sr-btn sr-btn-line" onClick={onEdit}>
              Edit
            </button>
          )}
          <button className="sr-btn sr-btn-quiet" disabled={busy} onClick={onDiscard}>
            Discard
          </button>
          <button className="sr-btn sr-btn-primary" disabled={busy} onClick={onApprove}>
            Approve
          </button>
        </div>
      </header>
      {error && (
        <p className="sr-callout danger" role="alert">
          {error}
        </p>
      )}
      <article className="sr-page" dir="auto">
        {view?.paragraphs.map((p, i) => (
          <p key={i} style={p.align ? { textAlign: p.align as "left" } : undefined}>
            {p.segments.map((s, j) => (s.isNew ? <mark key={j}>{s.text}</mark> : <span key={j}>{s.text}</span>))}
            {!p.segments.some((s) => s.text) && <br />}
          </p>
        ))}
      </article>
    </section>
  );
}
