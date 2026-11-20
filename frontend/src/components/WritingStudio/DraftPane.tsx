import { useMemo, useState } from "react";
import { Chapter, ChapterDraft } from "../../../../shared/types/books";
import type { ManuscriptReadingPosition } from "./useManuscriptReadingMarks";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { plainText } from "./manuscript";
import { compareDraftText } from "./draftComparison";
import { AiEditingContext } from "./AiEdit";
import { draftDisplayName, draftTimestamp, isMainBackup } from "./chapterDrafts";

export function DraftPane({
  chapter,
  manuscriptId,
  draft,
  matchingMain,
  active,
  readOnly,
  reading,
  audiobookKey,
  audiobookHeader,
  audiobookState,
  readingPosition,
  onSelect,
  onClose,
  onPromote,
  onDelete,
  onChange,
  aiEditing,
}: {
  active: boolean;
  chapter: Chapter;
  manuscriptId: string;
  draft: ChapterDraft;
  matchingMain: boolean;
  readOnly: boolean;
  reading: boolean;
  audiobookKey: string;
  audiobookHeader: HTMLDivElement | null;
  audiobookState: { open: boolean; onChange: (open: boolean) => void };
  readingPosition?: ManuscriptReadingPosition;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPromote: () => void;
  onDelete: () => void;
  onChange: (
    change: Partial<Pick<ChapterDraft, "name" | "summary" | "text" | "annotations">>,
  ) => void;
  aiEditing: AiEditingContext;
}) {
  const [name, setName] = useState(draft.name);
  const [diff, setDiff] = useState(false);
  const mainText = useMemo(() => active ? plainText(chapter.text) : "", [active, chapter.text]);
  const draftText = useMemo(() => active ? plainText(draft.text) : "", [active, draft.text]);
  const hasChanges = mainText !== draftText;
  const comparison = useMemo(
    () => diff && hasChanges ? compareDraftText(mainText, draftText, draft.text) : undefined,
    [diff, hasChanges, mainText, draftText, draft.text],
  );
  const timestamp = draftTimestamp(draft);
  const backup = isMainBackup(draft);
  const promoted = draft.id === chapter.mainSourceDraftId;
  return (
    <article
      hidden={!active}
      className="ws-draft-pane"
      aria-label={backup ? "Main backup preview" : "Draft writing panel"}
    >
      <header className="ws-draft-header">
        {backup ? <strong>{draftDisplayName(draft)}</strong> : (
          <label>
            Draft{" "}
            <select aria-label="Select draft" value={draft.id} title={draft.name}
              onChange={event => onSelect(event.target.value)}>
              {chapter.drafts?.filter(item => !isMainBackup(item)).map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
        {(promoted || matchingMain) && (
          <span className="ws-version-source">
            {promoted ? backup ? "Restored to Main" : "Promoted to Main" : "Matches Main"}
          </span>
        )}
        {timestamp && <span className="ws-draft-timestamp">{timestamp}</span>}
        {comparison && (
          <span className="ws-draft-change-count" role="status">
            {comparison.count} {comparison.count === 1 ? "change" : "changes"}
          </span>
        )}
        <button disabled={readOnly} onClick={onPromote}>
          {backup ? "Restore to Main" : "Promote to Main"}
        </button>
        <button onClick={onClose} aria-label="Close draft">
          Close
        </button>
      </header>
      <div className="ws-draft-secondary">
        {!backup && <label>
          Name{" "}
          <input
            aria-label="Draft name"
            value={name}
            maxLength={200}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim();
              if (next && next !== draft.name) onChange({ name: next });
              else setName(draft.name);
            }}
          />
        </label>}
        <button disabled={!hasChanges} aria-pressed={!!comparison}
          title={hasChanges ? undefined : "No text changes compared with Main"}
          onClick={() => setDiff(show => !show)}>
          Compare changes
        </button>
        <button disabled={readOnly} onClick={onDelete}>
          {backup ? "Delete backup" : "Delete draft"}
        </button>
      </div>
      {!backup && (
        <label className="ws-draft-summary">
          Draft summary
          <textarea
            dir="auto"
            rows={2}
            maxLength={1000}
            placeholder="What changed in this draft?"
            value={draft.summary ?? ""}
            readOnly={readOnly}
            onChange={event => onChange({ summary: event.target.value })}
          />
        </label>
      )}
      <ManuscriptEditor
        primaryFindTarget={active}
        reading={reading}
        audiobook={reading ? { id: draft.id, manuscriptId, title: `${chapter.name} · ${draft.name}` } : undefined}
        audiobookKey={audiobookKey}
        audiobookHeader={audiobookHeader}
        audiobookState={audiobookState}
        readingPosition={readingPosition}
        value={draft.text}
        draftComparison={comparison?.marks}
        format={draft.format || chapter.format}
        label="Draft manuscript"
        readOnly={readOnly || !active || backup}
        annotations={draft.annotations || []}
        showAnnotations={false}
        aiEditing={{ ...aiEditing, annotations: draft.annotations }}
        onChange={(text, annotations) => onChange({ text, annotations })}
      />
    </article>
  );
}
