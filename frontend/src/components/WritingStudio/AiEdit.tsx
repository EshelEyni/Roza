import { useEffect, useRef, useState } from "react";
import { createEditor, Editor, Range } from "slate";
import { useSlate } from "slate-react";
import axios from "axios";
import {
  ChapterAnnotation,
  SlateCustomElement,
} from "../../../../shared/types/books";
import {
  captureEdit,
  EditSnapshot,
  isCurrentEdit,
  replaceEditedText,
  wordDiff,
} from "./aiEditing";
import { transformAnnotations } from "./annotations";

export type AiEditingContext = {
  bookId: string;
  chapterId: string;
  summary?: boolean;
  annotations?: ChapterAnnotation[];
  onDraft?: (
    text: SlateCustomElement[],
    annotations: ChapterAnnotation[],
    name: string,
  ) => void;
};
const actions = {
  grammar: "Fix Grammar & Syntax",
  clarity: "Improve Clarity",
  flow: "Improve Flow",
  concise: "Make More Concise",
  custom: "Custom Instruction",
};
export function AiEdit({ context }: { context: AiEditingContext }) {
  const editor = useSlate();
  const latestContext = useRef(context);
  latestContext.current = context;
  const [opened, setOpened] = useState(false);
  const [scope, setScope] = useState("paragraph");
  const [action, setAction] = useState<keyof typeof actions>("grammar");
  const [instruction, setInstruction] = useState("");
  const [snapshot, setSnapshot] = useState<EditSnapshot>();
  const [revision, setRevision] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [asDraft, setAsDraft] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController>();
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  const expanded = !!editor.selection && Range.isExpanded(editor.selection);
  const stale = snapshot && !isCurrentEdit(editor, snapshot);
  function close() {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setOpened(false);
    setRevision(undefined);
    setSnapshot(undefined);
    setError("");
  }
  function capture(nextScope: string) {
    const range =
      nextScope === "selection" && editor.selection
        ? editor.selection
        : nextScope === "chapter"
          ? Editor.range(editor, [])
          : Editor.range(
              editor,
              editor.selection?.anchor.path.slice(0, -1) || [0],
            );
    setSnapshot(captureEdit(editor, range));
  }
  function open() {
    const next = expanded ? "selection" : "paragraph";
    setScope(next);
    capture(next);
    setOpened(true);
    setAsDraft(false);
  }
  function draftResult(source: EditSnapshot, revised: string) {
    const copy = createEditor();
    copy.children = structuredClone(editor.children);
    let notes = structuredClone(latestContext.current.annotations || []);
    const apply = copy.apply;
    copy.apply = (op) => {
      notes = transformAnnotations(notes, op);
      apply(op);
    };
    replaceEditedText(copy, source, revised);
    latestContext.current.onDraft?.(
      copy.children as SlateCustomElement[],
      notes,
      `AI · ${actions[action]}`,
    );
  }
  async function generate() {
    if (!snapshot || busy) return;
    if (!isCurrentEdit(editor, snapshot)) {
      setError(
        "The source text changed. Close this review and select the text again.",
      );
      return;
    }
    const token = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setRevision(undefined);
    try {
      const result = await axios.post(
        `/api/book/${context.bookId}/chapters/${context.chapterId}/ai-edit`,
        {
          text: snapshot.original,
          action,
          ...(action === "custom" ? { instruction } : {}),
        },
        { withCredentials: true, signal: controller.signal, timeout: 130000 },
      );
      if (token !== generation.current) return;
      const revised = result.data?.data?.text;
      if (typeof revised !== "string" || !revised.trim())
        throw new Error("No revised text was returned.");
      if (
        !context.summary &&
        scope === "chapter" &&
        context.onDraft &&
        isCurrentEdit(editor, snapshot)
      ) {
        draftResult(snapshot, revised);
        close();
      } else setRevision(revised);
    } catch (err) {
      if (token === generation.current)
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message || "AI editing failed. Please retry."
            : (err as Error).message,
        );
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  const changes =
    revision === undefined || !snapshot
      ? []
      : wordDiff(snapshot.original, revision);
  return (
    <div className="ws-ai-control">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (opened ? close() : open())}
        aria-expanded={opened}
      >
        AI Edit{expanded ? " selection" : ""}
      </button>
      {opened && (
        <section
          className="ws-ai-review"
          aria-label="AI editing review"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <header>
            <strong>
              AI Edit ·{" "}
              {context.summary
                ? "Chapter summary"
                : scope === "chapter"
                  ? "Entire chapter → new draft"
                  : scope === "selection"
                    ? "Selected text"
                    : "Current paragraph"}
            </strong>
            <button onClick={close} aria-label="Close AI editing">
              ×
            </button>
          </header>
          {revision === undefined && (
            <>
              {scope !== "selection" && (
                <label>
                  Text to edit{" "}
                  <select
                    disabled={busy}
                    value={scope}
                    onChange={(e) => {
                      setScope(e.target.value);
                      capture(e.target.value);
                    }}
                  >
                    <option value="paragraph">Current paragraph</option>
                    <option value="chapter">
                      {context.summary
                        ? "Entire summary"
                        : "Entire chapter (creates a draft)"}
                    </option>
                  </select>
                </label>
              )}
              <label>
                Action{" "}
                <select
                  disabled={busy}
                  value={action}
                  onChange={(e) =>
                    setAction(e.target.value as keyof typeof actions)
                  }
                >
                  {Object.entries(actions).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {action === "custom" && (
                <label>
                  Instruction{" "}
                  <textarea
                    maxLength={2000}
                    disabled={busy}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                  />
                </label>
              )}
              <details>
                <summary>
                  Original · {snapshot?.original.length || 0} characters
                </summary>
                <p dir="auto">{snapshot?.original}</p>
              </details>
              {context.onDraft &&
                !context.summary &&
                scope === "selection" &&
                (snapshot?.original.length || 0) >= 500 && (
                  <label>
                    <input
                      type="checkbox"
                      checked={asDraft}
                      onChange={(e) => setAsDraft(e.target.checked)}
                    />{" "}
                    Save revision as a chapter draft
                  </label>
                )}
              <button
                disabled={
                  busy ||
                  !snapshot?.original.trim() ||
                  (action === "custom" && !instruction.trim()) ||
                  !!stale
                }
                onClick={() => void generate()}
              >
                {busy ? "Editing…" : "Generate suggestion"}
              </button>
            </>
          )}
          {revision !== undefined && snapshot && (
            <>
              <div className="ws-ai-comparison">
                <div>
                  <strong>Original</strong>
                  <p dir="auto">
                    {changes
                      .filter((p) => p.type !== "add")
                      .map((p, i) =>
                        p.type === "remove" ? (
                          <del key={i}>{p.text}</del>
                        ) : (
                          p.text
                        ),
                      )}
                  </p>
                </div>
                <div>
                  <strong>Proposed revision</strong>
                  <p dir="auto">
                    {changes
                      .filter((p) => p.type !== "remove")
                      .map((p, i) =>
                        p.type === "add" ? <ins key={i}>{p.text}</ins> : p.text,
                      )}
                  </p>
                </div>
              </div>
              {revision === snapshot.original && <p>No changes needed.</p>}
              <button
                disabled={!!stale || busy}
                onClick={() => {
                  if (!isCurrentEdit(editor, snapshot)) return;
                  if (
                    (asDraft || scope === "chapter") &&
                    context.onDraft &&
                    !context.summary
                  )
                    draftResult(snapshot, revision);
                  else replaceEditedText(editor, snapshot, revision);
                  close();
                }}
              >
                {asDraft || (!context.summary && scope === "chapter")
                  ? "Create draft"
                  : "Accept"}
              </button>
              <button onClick={close}>Reject</button>
              <button
                disabled={busy || !!stale}
                onClick={() => void generate()}
              >
                Regenerate
              </button>
              {stale && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(revision);
                      setError("Revision copied. Paste it where you choose.");
                    } catch {
                      setError("Select and copy the proposed revision above.");
                    }
                  }}
                >
                  Copy revision
                </button>
              )}
            </>
          )}
          {stale && (
            <p role="alert">
              The source document changed. Applying this suggestion is blocked.
              Copy the revision or close and request a fresh edit.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}
