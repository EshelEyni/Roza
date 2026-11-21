import { useEffect, useState } from "react";
import type { ChapterPreview } from "../../../../../shared/types/stagingRoom";
import { api, errorText } from "../api";

export function ChapterPreviewModal({ slug, file, onClose }: { slug: string; file: string; onClose: () => void }) {
  const [chapter, setChapter] = useState<ChapterPreview>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getChapter(slug, file).then(setChapter, (e) => setError(errorText(e)));
  }, [slug, file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal reader" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="muted small">{file}</div>
          <button className="btn-ghost sm" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <div className="callout danger">{error}</div>}
        {chapter && (
          <div className="reader-body" dir="auto">
            <h1>{chapter.name}</h1>
            {chapter.description.filter(Boolean).length > 0 && (
              <div className="reader-desc">
                {chapter.description.map((d, i) => (
                  <p key={i}>{d}</p>
                ))}
              </div>
            )}
            {chapter.planning.length > 0 && (
              <div className="reader-planning">
                {chapter.planning.map((pl) => (
                  <span key={pl.kind + pl.name} className="chip" title={pl.note}>
                    {pl.name}
                  </span>
                ))}
              </div>
            )}
            <article className="paper">
              {chapter.paragraphs.map((para, i) => (
                <p key={i} style={{ textAlign: (para.align as "center") || undefined }}>
                  {para.text}
                </p>
              ))}
            </article>
            {chapter.notes.length > 0 && (
              <div className="reader-desc">
                <h3>Notes ({chapter.notes.length})</h3>
                {chapter.notes.map((n, i) => (
                  <p key={i}>
                    <span className="muted small">
                      {n.general ? "General note" : n.attached ? `On “${n.quote}”` : `Unattached (was on “${n.quote}”)`}
                    </span>
                    <br />
                    {n.content}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
