import { useEffect, useId, useRef, useState } from "react";
import "../Modals/confirmDialog.css";

type Format = "prose" | "screenplay";
export function ChapterFormatDialog({
  value,
  onApply,
  onClose,
}: {
  value: Format;
  onApply: (format: Format) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState(value);
  const title = useId(),
    description = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="app-confirm-dialog ws-format-dialog"
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <h2 id={title}>Chapter Format</h2>
      <p id={description}>
        Choose how you write this chapter. Each chapter can use its own format.
      </p>
      <fieldset>
        <legend>Writing format</legend>
        <label className="ws-format-choice">
          <input
            type="radio"
            name="chapter-format"
            checked={format === "prose"}
            onChange={() => setFormat("prose")}
          />
          <span>
            <strong>Prose</strong>
            <small>
              Traditional paragraphs and rich text for novels and stories.
            </small>
          </span>
        </label>
        <label className="ws-format-choice">
          <input
            type="radio"
            name="chapter-format"
            checked={format === "screenplay"}
            onChange={() => setFormat("screenplay")}
          />
          <span>
            <strong>Screenplay</strong>
            <small>
              Scene headings, action, character cues and dialogue, with script
              layout and keyboard controls.
            </small>
          </span>
        </label>
      </fieldset>
      {format === "prose" ? (
        <p>
          Switching to Prose converts screenplay elements into normal paragraphs
          and removes their script indentation and alignment. Your text, inline
          formatting, summaries and annotations are kept. Switching to
          Screenplay enables script tools and layout; you can assign elements
          while editing.
        </p>
      ) : (
        <section
          aria-label="Screenplay shortcuts"
          className="ws-format-shortcuts"
        >
          <h3>Screenplay shortcuts</h3>
          <dl>
            <dt>Enter</dt>
            <dd>Move to the next element.</dd>
            <dt>Shift+Enter</dt>
            <dd>Insert a line break.</dd>
            <dt>Ctrl/Cmd+Enter</dt>
            <dd>Cycle the element type.</dd>
            <dt>Tab</dt>
            <dd>
              Move focus, or cycle elements when “Tab cycles elements” is
              enabled.
            </dd>
            <dt>Escape</dt>
            <dd>Turn off Tab cycling.</dd>
            <dt>Ctrl/Cmd+Z</dt>
            <dd>Undo.</dd>
            <dt>Ctrl/Cmd+Shift+Z</dt>
            <dd>Redo.</dd>
          </dl>
        </section>
      )}
      <div className="app-confirm-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="app-confirm-action"
          onClick={() => onApply(format)}
        >
          Apply format
        </button>
      </div>
    </dialog>
  );
}
