import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import type { SlateCustomElement } from "../../../../../shared/types/books";
import type { ChangeTextView, SlateElement } from "../../../../../shared/types/stagingRoom";
import { ManuscriptEditor } from "../../WritingStudio/ManuscriptEditor";
import "../../WritingStudio/writingStudio.css";
import { api, errorText, stagingAiEditUrl } from "../api";
import { ago } from "./format";

type Save = { state: "saved" | "dirty" | "saving" | "error"; at?: string; error?: string };
const SAVE_DELAY_MS = 1200;
const POLL_MS = 3000;

/**
 * Writing Studio's editor (with AI Edit) on a pending text change. Saves go to Staging only.
 * Claude's saves show up live; if you are typing when Claude saves, you choose which to keep.
 * Notes are not shown here.
 */
export function StagingEditor({
  slug,
  id,
  busy,
  onClose,
  onApprove,
}: {
  slug: string;
  id: string;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
}) {
  const [view, setView] = useState<ChangeTextView>();
  const [editorKey, setEditorKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<Save>({ state: "saved" });
  const [newer, setNewer] = useState<ChangeTextView>();
  const [now, setNow] = useState(Date.now());
  const base = useRef("");
  const pending = useRef<SlateElement[]>();
  const lastText = useRef<SlateElement[]>();
  const timer = useRef<number>();
  const saving = useRef<Promise<void>>();

  const show = useCallback((v: ChangeTextView) => {
    base.current = v.updatedAt;
    lastText.current = v.text;
    setView(v);
    setEditorKey((k) => k + 1);
    setNewer(undefined);
    setSave({ state: "saved", at: v.updatedAt });
  }, []);

  useEffect(() => {
    setView(undefined);
    setLoadError("");
    api.getText(slug, id).then(show, (e) => setLoadError(errorText(e)));
  }, [slug, id, show]);

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (saving.current) await saving.current;
    const text = pending.current;
    if (!text) return true;
    pending.current = undefined;
    setSave({ state: "saving" });
    let ok = true;
    saving.current = api
      .saveText(slug, id, text, base.current)
      .then((r) => {
        base.current = r.updatedAt;
        setSave(pending.current ? { state: "dirty" } : { state: "saved", at: r.updatedAt });
      })
      .catch((e) => {
        ok = false;
        pending.current ??= text; // keep it for the next try
        setSave({ state: "error", error: errorText(e) });
      })
      .finally(() => {
        saving.current = undefined;
      });
    await saving.current;
    return ok;
  }, [slug, id]);

  // Save what is left when the editor closes.
  useEffect(() => () => void flush(), [flush]);

  // Watch for Claude's saves.
  useEffect(() => {
    const t = window.setInterval(async () => {
      setNow(Date.now());
      if (saving.current) return;
      try {
        const v = await api.getText(slug, id);
        // Same or older than what we have (a poll that crossed our own save): nothing new.
        if (v.updatedAt <= base.current) return;
        if (pending.current || saving.current) setNewer(v);
        else show(v);
      } catch {
        /* the next poll tries again */
      }
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [slug, id, show]);

  const onChange = (text: SlateCustomElement[]) => {
    pending.current = text as SlateElement[];
    lastText.current = pending.current;
    setSave((s) => (s.state === "error" ? s : { state: "dirty" }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const keepMine = () => {
    if (!newer) return;
    base.current = newer.updatedAt;
    pending.current ??= lastText.current;
    setNewer(undefined);
    void flush();
  };

  const leave = async (then: () => void) => {
    if (newer || (await flush())) then();
  };

  const saveText =
    save.state === "saving"
      ? "Saving to Staging…"
      : save.state === "dirty"
        ? "Unsaved changes"
        : save.state === "error"
          ? `Not saved: ${save.error}`
          : save.at
            ? `Saved ${ago(save.at, now)}`
            : "Saved";

  return (
    <div className="sr-editor">
      <div className="sr-editor-banner" role="note">
        STAGING COPY · edits here are not in Writing Studio until you approve
      </div>
      <header className="sr-editor-head">
        <div className="sr-head-bar">
          <button className="sr-icon-btn sm sr-head-back" onClick={() => leave(onClose)} aria-label="Back" title="Back">
            <FiArrowLeft aria-hidden="true" />
          </button>
          <div className="sr-read-actions">
            <span className="sr-live-chip">
              <span className="sr-dot" aria-hidden="true" /> Live with Claude
            </span>
            <button className="sr-btn sr-btn-primary sm" disabled={busy} onClick={() => leave(onApprove)}>
              Approve
            </button>
          </div>
        </div>
        <strong className="sr-head-title" dir="auto" title={view?.title}>
          {view?.title ?? "…"}
        </strong>
        <p className={`sr-head-meta ${save.state === "error" ? "sr-danger" : "sr-muted"}`} role={save.state === "error" ? "alert" : undefined}>
          {view?.subtitle} · {saveText}
        </p>
      </header>
      {newer && (
        <div className="sr-editor-newer" role="alert">
          <span>Claude saved a newer version of this text while you were typing.</span>
          <button className="sr-btn sr-btn-primary sm" onClick={() => show(newer)}>
            Load Claude’s version
          </button>
          <button className="sr-btn sr-btn-line sm" onClick={keepMine}>
            Keep mine
          </button>
        </div>
      )}
      {save.state === "error" && !newer && (
        <div className="sr-editor-newer">
          <span>{save.error}</span>
          <button className="sr-btn sr-btn-line sm" onClick={() => void flush()}>
            Try again
          </button>
        </div>
      )}
      <div className="ws sr-editor-ws">
        <div className="ws-writing">
          {loadError ? (
            <p className="sr-callout danger" role="alert">
              {loadError}
            </p>
          ) : !view ? (
            <p className="sr-muted sr-pad">Loading…</p>
          ) : (
            <article className="ws-page ws-main-pane">
              <h2 className="ws-chapter-title" dir="auto">
                {view.title}
              </h2>
              <ManuscriptEditor
                key={`${view.id}:${editorKey}`}
                format={view.format}
                value={view.text as SlateCustomElement[]}
                annotations={[]}
                aiEditing={{ bookId: "", chapterId: "", endpoint: stagingAiEditUrl(slug), annotations: [] }}
                label={`${view.title} (Staging)`}
                primaryFindTarget
                onChange={onChange}
              />
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
