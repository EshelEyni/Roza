import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArchive, FiMoreVertical, FiRotateCcw } from "react-icons/fi";
import { ReaderArchiveDialog } from "./ReaderArchiveDialog";
import type { ReaderBook } from "../../../../shared/types/reader";

export function ReaderBookMenu({
  book,
  archived,
  pending,
  onArchive,
}: {
  book: ReaderBook;
  archived: boolean;
  pending: boolean;
  onArchive: (book: ReaderBook) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    action.current?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="reader-book-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          action.current?.focus();
        }
      }}
    >
      <button
        type="button"
        className="reader-icon-button reader-book-menu-trigger"
        ref={trigger}
        aria-label={t("reader.bookActions", { title: book.title })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <FiMoreVertical aria-hidden="true" />
      </button>
      {open && (
        <div
          className="reader-book-menu-popover"
          id={menuId}
          role="menu"
          aria-label={t("reader.bookActions", { title: book.title })}
        >
          <button
            type="button"
            role="menuitem"
            ref={action}
            disabled={pending}
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              if (archived) onArchive(book);
              else setConfirmArchive(true);
            }}
          >
            {archived ? (
              <FiRotateCcw aria-hidden="true" />
            ) : (
              <FiArchive aria-hidden="true" />
            )}
            {t(archived ? "reader.restoreBook" : "reader.archiveBook")}
          </button>
        </div>
      )}
      {confirmArchive && (
        <ReaderArchiveDialog
          title={book.title}
          onCancel={() => {
            setConfirmArchive(false);
            trigger.current?.focus();
          }}
          onConfirm={() => {
            setConfirmArchive(false);
            trigger.current?.focus();
            onArchive(book);
          }}
        />
      )}
    </div>
  );
}
