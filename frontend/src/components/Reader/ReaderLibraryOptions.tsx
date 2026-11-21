import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FiGrid, FiList } from "react-icons/fi";
import type { ReaderLibrarySort } from "../../../../shared/types/reader";
import { ReaderUpload } from "./ReaderUpload";

type Layout = "grid" | "list";

export function ReaderLibraryOptions({
  open, sort, sortOptions, layout, onSort, onLayout, onClose,
}: {
  open: boolean;
  sort: ReaderLibrarySort;
  sortOptions: { value: ReaderLibrarySort; label: string }[];
  layout: Layout;
  onSort: (sort: ReaderLibrarySort) => void;
  onLayout: (layout: Layout) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  return createPortal(
    <dialog ref={dialog} className="reader-library-options" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="reader-library-options-content">
        <header>
          <h2 id={titleId}>{t("reader.libraryOptions")}</h2>
          <button type="button" autoFocus onClick={onClose}>{t("reader.libraryDone")}</button>
        </header>
        <fieldset>
          <legend>{t("reader.librarySort")}</legend>
          {sortOptions.map(option => (
            <label key={option.value}>
              {option.label}
              <input type="radio" name={titleId + "-sort"} checked={sort === option.value}
                onChange={() => onSort(option.value)} />
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t("reader.libraryLayout")}</legend>
          <div className="reader-library-options-layout">
            <button type="button" aria-pressed={layout === "grid"} onClick={() => onLayout("grid")}>
              <FiGrid aria-hidden="true" />{t("reader.libraryGridShort")}
            </button>
            <button type="button" aria-pressed={layout === "list"} onClick={() => onLayout("list")}>
              <FiList aria-hidden="true" />{t("reader.libraryListShort")}
            </button>
          </div>
        </fieldset>
        <ReaderUpload sheet />
      </div>
    </dialog>,
    document.body,
  );
}
