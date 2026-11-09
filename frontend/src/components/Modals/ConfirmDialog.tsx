import { useEffect, useId, useRef } from "react";
import "./confirmDialog.css";

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmationOptions & { onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const headingId = useId(),
    descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="app-confirm-dialog"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={event => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={event => event.stopPropagation()}
    >
      <h2 id={headingId}>{title}</h2>
      <p id={descriptionId}>{message}</p>
      <div className="app-confirm-actions">
        <button type="button" ref={cancel} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className="app-confirm-action"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
