import { useState } from "react";
import { Chapter, ChapterDraft } from "../../../../shared/types/books";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { plainText } from "./manuscript";
import { wordDiff } from "./aiEditing";
import { AiEditingContext } from "./AiEdit";

export function DraftPane({
  chapter,
  draft,
  active,
  readOnly,
  onSelect,
  onClose,
  onPromote,
  onDelete,
  onChange,
  aiEditing,
}: {
  active: boolean;
  chapter: Chapter;
  draft: ChapterDraft;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPromote: () => void;
  onDelete: () => void;
  onChange: (
    change: Partial<Pick<ChapterDraft, "name" | "text" | "annotations">>,
  ) => void;
  aiEditing: AiEditingContext;
}) {
  const [name, setName] = useState(draft.name);
  const [diff, setDiff] = useState(false);
  return (
    <article
      hidden={!active}
      className="ws-draft-pane"
      aria-label="Draft writing panel"
    >
      <header className="ws-draft-header">
        <label>
          Draft{" "}
          <select
            aria-label="Select draft"
            value={draft.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {chapter.drafts?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={readOnly} onClick={onPromote}>
          Promote to Main
        </button>
        <button onClick={onClose} aria-label="Close draft">
          Close
        </button>
      </header>
      <div className="ws-draft-secondary">
        <label>
          Draft name{" "}
          <input
            aria-label="Draft name"
            value={name}
            maxLength={200}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim();
              if (next) onChange({ name: next });
              else setName(draft.name);
            }}
          />
        </label>
        <button aria-pressed={diff} onClick={() => setDiff(!diff)}>
          Compare changes
        </button>
        <button disabled={readOnly} onClick={onDelete}>
          Delete draft
        </button>
      </div>
      {diff && (
        <div className="ws-draft-diff" aria-label="Draft changes" dir="auto">
          {wordDiff(plainText(chapter.text), plainText(draft.text)).map(
            (p, i) =>
              p.type === "add" ? (
                <ins key={i}>{p.text}</ins>
              ) : p.type === "remove" ? (
                <del key={i}>{p.text}</del>
              ) : (
                p.text
              ),
          )}
        </div>
      )}
      <ManuscriptEditor
        value={draft.text}
        format={draft.format || chapter.format}
        label="Draft manuscript"
        readOnly={readOnly || !active}
        annotations={draft.annotations || []}
        showAnnotations={false}
        aiEditing={{ ...aiEditing, annotations: draft.annotations }}
        onChange={(text, annotations) => onChange({ text, annotations })}
      />
    </article>
  );
}
