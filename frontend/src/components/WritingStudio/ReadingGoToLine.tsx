import { useEffect, useId, useRef, useState } from "react";
import "../Modals/confirmDialog.css";
import { parseGoToLine } from "./goToLineInput";

/** Compact Read Mode dialog that asks for a line number in the gutter's numbering. */
export function ReadingGoToLine({
  total,
  onGo,
  onCancel,
}: {
  total: number;
  onGo: (line: number) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const range = `1–${total}`;
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    input.current?.focus();
    return () => element.close();
  }, []);
  const go = () => {
    const line = parseGoToLine(value, total);
    if (line) return onGo(line);
    setError(total ? `Enter a whole line number from ${range}.` : "This text has no lines yet.");
    input.current?.focus();
    input.current?.select();
  };
  return (
    <dialog
      ref={dialog}
      className="app-confirm-dialog ws-go-to-line-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={event => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={event => event.stopPropagation()}
    >
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault();
          go();
        }}
      >
        <h2 id={`${id}-title`}>Go to line</h2>
        <label htmlFor={id}>Line number</label>
        <input
          ref={input}
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={total}
          step={1}
          value={value}
          aria-invalid={!!error}
          aria-describedby={`${id}-range`}
          onChange={event => {
            setValue(event.target.value);
            setError("");
          }}
        />
        <p id={`${id}-range`} className="ws-go-to-line-range">
          {error ? <span role="alert">{error}</span> : `Lines ${range}`}
        </p>
        <div className="app-confirm-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="app-confirm-action">
            Go
          </button>
        </div>
      </form>
    </dialog>
  );
}
