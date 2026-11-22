import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterAnnotation, SlateCustomElement } from "../../../../../shared/types/books";
import type { ChapterDraftView, ChapterSaveInput } from "../../../../../shared/types/stagingRoom";
import { ManuscriptEditor } from "../../WritingStudio/ManuscriptEditor";
import "../../WritingStudio/writingStudio.css";
import { api, errorText, stagingAiEditUrl } from "../api";
import { formatDate } from "./format";

type Save = { state: "saved" | "dirty" | "saving" | "error"; at?: string; error?: string };
const SAVE_DELAY_MS = 1200;

/**
 * Writing Studio's editor (with its AI Edit), working on the staged copy of a chapter.
 * Saves go to Staging only. The banner keeps that clear.
 */
export function StagingEditor({
  slug,
  file,
  changedFiles,
  onOpen,
  onClose,
  onReview,
}: {
  slug: string;
  file: string;
  /** staged chapter files that differ from Writing Studio */
  changedFiles: Set<string>;
  onOpen: (file: string) => void;
  onClose: () => void;
  onReview: () => void;
}) {
  const [view, setView] = useState<ChapterDraftView>();
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<Save>({ state: "saved" });
  const revision = useRef(0);
  const pending = useRef<Omit<ChapterSaveInput, "revision">>();
  const timer = useRef<number>();
  const saving = useRef<Promise<void>>();

  const load = useCallback(async () => {
    setView(undefined);
    setLoadError("");
    try {
      const next = await api.getChapterDraft(slug, file);
      revision.current = next.revision;
      setView(next);
      setSave({ state: "saved" });
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [slug, file]);

  useEffect(() => {
    load();
  }, [load]);

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (saving.current) await saving.current;
    const input = pending.current;
    if (!input) return true;
    pending.current = undefined;
    setSave({ state: "saving" });
    let ok = true;
    saving.current = api
      .saveChapterDraft(slug, file, { ...input, revision: revision.current })
      .then((r) => {
        revision.current = r.revision;
        setSave(pending.current ? { state: "dirty" } : { state: "saved", at: new Date().toISOString() });
      })
      .catch((e) => {
        ok = false;
        // Keep the unsaved text so the next try sends it.
        pending.current ??= input;
        setSave({ state: "error", error: errorText(e) });
      })
      .finally(() => {
        saving.current = undefined;
      });
    await saving.current;
    return ok;
  }, [slug, file]);

  // Save what is left when the editor closes.
  useEffect(() => () => void flush(), [flush]);

  const onChange = (text: SlateCustomElement[], annotations?: ChapterAnnotation[]) => {
    pending.current = {
      text: text as ChapterSaveInput["text"],
      annotations: (annotations ?? pending.current?.annotations ?? view?.annotations) as ChapterSaveInput["annotations"],
    };
    setSave((s) => (s.state === "error" ? s : { state: "dirty" }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const leave = async (then: () => void) => {
    if (await flush()) then();
  };

  const saveText =
    save.state === "saving"
      ? "Saving to Staging…"
      : save.state === "dirty"
        ? "Unsaved changes"
        : save.state === "error"
          ? `Not saved: ${save.error}`
          : save.at
            ? `Saved in Staging · ${formatDate(save.at)}`
            : "Saved in Staging";

  return (
    <div className="staging-editor">
      <div className="staging-banner" role="status">
        <strong className="staging-banner-tag">STAGING COPY</strong>
        <span>You are editing Staging, not the live book. Writing Studio and readers see nothing until you push.</span>
        <div className="staging-banner-actions">
          <button className="banner-btn" onClick={() => leave(onReview)}>
            Review changes
          </button>
          <button className="banner-btn solid" onClick={() => leave(onClose)}>
            Done
          </button>
        </div>
      </div>

      <div className="staging-editor-body">
        <aside className="staging-editor-chapters" aria-label="Chapters">
          <div className="eyebrow">{view?.bookName || "Chapters"}</div>
          {(view?.chapters || []).map((c) => (
            <button
              key={c.file}
              className={`staging-editor-chapter ${c.file === file ? "selected" : ""}`}
              onClick={() => c.file !== file && leave(() => onOpen(c.file))}
              aria-current={c.file === file ? "page" : undefined}
            >
              <span className="muted">{c.number}</span>
              <span className="grow" dir="auto">
                {c.name}
              </span>
              {changedFiles.has(c.file) && <span className="changed-dot" title="Differs from Writing Studio" />}
            </button>
          ))}
          <div className="small muted staging-editor-legend">
            <span className="changed-dot" /> differs from Writing Studio
          </div>
        </aside>

        <div className="ws staging-editor-ws">
          <div className="staging-editor-status">
            <span className="staging-chip">STAGING</span>
            <span className={`small ${save.state === "error" ? "danger-text" : "muted"}`} role={save.state === "error" ? "alert" : undefined}>
              {saveText}
            </span>
            {save.state === "error" && (
              <button className="link small" onClick={() => (save.error?.includes("Reload") ? load() : flush())}>
                {save.error?.includes("Reload") ? "Reload chapter" : "Try again"}
              </button>
            )}
          </div>
          <div className="ws-writing">
            {loadError ? (
              <p className="callout danger" role="alert">
                {loadError}
              </p>
            ) : !view ? (
              <p className="muted staging-editor-loading">Loading…</p>
            ) : (
              <article className="ws-page ws-main-pane">
                <h2 className="ws-chapter-title" dir="auto">
                  {view.name}
                </h2>
                <ManuscriptEditor
                  key={`${view.file}:${view.revision}`}
                  format={view.format}
                  value={view.text as SlateCustomElement[]}
                  annotations={(view.annotations || []) as ChapterAnnotation[]}
                  aiEditing={{
                    bookId: "",
                    chapterId: "",
                    endpoint: stagingAiEditUrl(slug),
                    annotations: (view.annotations || []) as ChapterAnnotation[],
                  }}
                  label={`${view.name} (Staging)`}
                  onChange={onChange}
                />
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
