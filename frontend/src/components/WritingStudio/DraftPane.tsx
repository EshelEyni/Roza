import { useMemo, useRef, useState } from "react";
import { FiArrowUp, FiChevronDown, FiColumns, FiEdit2, FiMoreHorizontal, FiTrash2, FiX } from "react-icons/fi";
import { Chapter, ChapterDraft } from "../../../../shared/types/books";
import type { ManuscriptReadingPosition } from "./useManuscriptReadingMarks";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { plainText } from "./manuscript";
import { compareDraftText } from "./draftComparison";
import { AiEditingContext } from "./AiEdit";
import { draftDisplayName, draftTimestamp, isMainBackup } from "./chapterDrafts";
import { ItemMenu } from "./ItemMenu";

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
  const titleRef = useRef<HTMLInputElement>(null);
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
  const drafts = chapter.drafts?.filter(item => !isMainBackup(item)) ?? [];
  return (
    <article
      hidden={!active}
      className="ws-draft-pane"
      aria-label={backup ? "Main backup preview" : "Draft writing panel"}
    >
      <header className="ws-draft-header">
        <div className="ws-draft-heading">
          <div className="ws-draft-identity">
            {backup ? (
              <strong className="ws-draft-title">{draftDisplayName(draft)}</strong>
            ) : (
              <input
                ref={titleRef}
                className="ws-draft-title"
                aria-label="Draft name"
                title="Rename draft"
                value={name}
                maxLength={200}
                disabled={readOnly}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setName(draft.name);
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  const next = name.trim();
                  if (next && next !== draft.name) onChange({ name: next });
                  else setName(draft.name);
                }}
              />
            )}
            {!backup && drafts.length > 1 && (
              <ItemMenu>
                <summary className="ws-draft-icon" aria-label="Switch draft" title="Switch draft">
                  <FiChevronDown aria-hidden="true" />
                </summary>
                <div className="ws-version-menu ws-draft-menu ws-draft-switch-menu">
                  {drafts.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={item.id === draft.id || undefined}
                      onClick={() => onSelect(item.id)}
                    >
                      <span className="ws-version-name">{item.name}</span>
                      <span className="ws-version-meta">{draftTimestamp(item)}</span>
                    </button>
                  ))}
                </div>
              </ItemMenu>
            )}
          </div>
          <div className="ws-draft-actions">
            <button
              type="button"
              className="ws-draft-button"
              disabled={!hasChanges}
              aria-pressed={!!comparison}
              aria-label="Compare changes"
              title={hasChanges ? "Highlight changes against Main" : "No text changes compared with Main"}
              onClick={() => setDiff(show => !show)}
            >
              <FiColumns aria-hidden="true" />
              <span className="ws-draft-button-label">Compare</span>
            </button>
            <button
              type="button"
              className="ws-draft-button ws-draft-primary"
              disabled={readOnly}
              title={backup ? "Replace Main with this backup" : "Replace Main with this draft"}
              onClick={onPromote}
            >
              <FiArrowUp aria-hidden="true" />
              {backup ? "Restore to Main" : "Promote to Main"}
            </button>
            <ItemMenu>
              <summary className="ws-draft-icon" aria-label="More draft actions" title="More">
                <FiMoreHorizontal aria-hidden="true" />
              </summary>
              <div className="ws-draft-menu">
                {!backup && (
                  <button type="button" disabled={readOnly} onClick={() => titleRef.current?.select()}>
                    <FiEdit2 aria-hidden="true" /> Rename
                  </button>
                )}
                <button type="button" className="ws-draft-danger" disabled={readOnly} onClick={onDelete}>
                  <FiTrash2 aria-hidden="true" /> {backup ? "Delete backup" : "Delete draft"}
                </button>
              </div>
            </ItemMenu>
            <button type="button" className="ws-draft-icon" onClick={onClose} aria-label="Close draft" title="Close draft">
              <FiX aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="ws-draft-meta">
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
        </div>
        {!backup && (
          <textarea
            className="ws-draft-summary"
            aria-label="Draft summary"
            dir="auto"
            rows={1}
            maxLength={1000}
            placeholder="Add a note: what changed in this draft?"
            value={draft.summary ?? ""}
            readOnly={readOnly}
            onChange={event => onChange({ summary: event.target.value })}
          />
        )}
      </header>
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
