import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArchive,
  FiMoreVertical,
  FiRotateCcw,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import { useQueryClient } from "@tanstack/react-query";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import readerApiService from "../../services/readerApiService";
import { ConfirmDialog, ReaderArchiveDialog } from "./ReaderArchiveDialog";
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
  const queryClient = useQueryClient();
  const { loggedInUser } = useLoginWithToken();
  const userId = loggedInUser?.id;
  const [management, setManagement] = useState<"rename" | "delete" | null>(
    null,
  );
  const [title, setTitle] = useState(book.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function closeManagement() {
    if (saving) return;
    setManagement(null);
    trigger.current?.focus();
  }
  async function saveManagement() {
    if (saving || (management === "rename" && !title.trim())) return;
    setSaving(true);
    setError("");
    try {
      if (management === "rename") {
        const updated = await readerApiService.rename(book.id, title.trim());
        queryClient.setQueriesData<ReaderBook[]>(
          { queryKey: ["readerBooks", userId] },
          (data) => data?.map((item) => (item.id === book.id ? updated : item)),
        );
        queryClient.setQueryData<ReaderBook>(
          ["readerBook", userId, book.id],
          (data) => (data ? { ...data, title: updated.title } : undefined),
        );
      } else {
        await readerApiService.deletePermanently(book.id);
        queryClient.setQueriesData<ReaderBook[]>(
          { queryKey: ["readerBooks", userId] },
          (data) => data?.filter((item) => item.id !== book.id),
        );
        queryClient.removeQueries({
          queryKey: ["readerBook", userId, book.id],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["readerBooks", userId] });
      setManagement(null);
      trigger.current?.focus();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("reader.bookManagementError"),
      );
    } finally {
      setSaving(false);
    }
  }
  function openManagement(mode: "rename" | "delete") {
    setOpen(false);
    setTitle(book.title);
    setError("");
    setManagement(mode);
  }
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
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          const items = Array.from(
            root.current?.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]',
            ) || [],
          );
          const current = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "ArrowDown"
              ? (current + 1) % items.length
              : (current - 1 + items.length) % items.length;
          items[next]?.focus();
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
        disabled={pending || saving}
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
            disabled={pending || saving}
            onClick={() => openManagement("rename")}
          >
            <FiEdit2 aria-hidden="true" />
            {t("reader.renameBook")}
          </button>
          {archived && (
            <button
              type="button"
              role="menuitem"
              disabled={pending || saving}
              onClick={() => openManagement("delete")}
            >
              <FiTrash2 aria-hidden="true" />
              {t("reader.deletePermanently")}
            </button>
          )}
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
      {management && (
        <ConfirmDialog
          heading={t(
            management === "rename"
              ? "reader.renameBook"
              : "reader.deletePermanently",
          )}
          message={
            management === "delete"
              ? t("reader.confirmPermanentDelete", { title: book.title })
              : ""
          }
          confirmLabel={t(
            saving
              ? "reader.bookSaving"
              : management === "rename"
                ? "reader.saveTitle"
                : "reader.deletePermanently",
          )}
          icon={
            management === "rename" ? (
              <FiEdit2 aria-hidden="true" />
            ) : (
              <FiTrash2 aria-hidden="true" />
            )
          }
          pending={saving}
          confirmDisabled={management === "rename" && !title.trim()}
          onCancel={closeManagement}
          onConfirm={() => void saveManagement()}
        >
          {management === "rename" && (
            <label className="reader-book-title-field">
              {t("reader.bookTitle")}
              <input
                value={title}
                maxLength={500}
                disabled={saving}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveManagement();
                  }
                }}
              />
              {!title.trim() && (
                <span role="alert">{t("reader.titleRequired")}</span>
              )}
            </label>
          )}
          {error && <p role="alert">{error}</p>}
        </ConfirmDialog>
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
