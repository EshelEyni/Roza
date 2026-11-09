import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FiArchive } from "react-icons/fi";

export function ConfirmDialog({
  heading,
  message,
  confirmLabel,
  icon,
  onCancel,
  onConfirm,
}: {
  heading: string;
  message: string;
  confirmLabel: string;
  icon: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return createPortal(
    <dialog
      className="reader-archive-dialog"
      ref={dialog}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="reader-archive-dialog-content">
        <div className="reader-archive-dialog-icon">{icon}</div>
        <h2 id={headingId}>{heading}</h2>
        <p id={descriptionId}>{message}</p>
        <div className="reader-archive-dialog-actions">
          <button
            type="button"
            className="reader-button"
            ref={cancel}
            onClick={onCancel}
          >
            {t("btnCancel")}
          </button>
          <button
            type="button"
            className="reader-button reader-button-primary"
            onClick={onConfirm}
          >
            <FiArchive aria-hidden="true" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

export function ReaderArchiveDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      heading={t("reader.archiveDialogTitle")}
      message={t("reader.confirmArchiveBook", { title })}
      confirmLabel={t("reader.archiveBook")}
      icon={<FiArchive aria-hidden="true" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
