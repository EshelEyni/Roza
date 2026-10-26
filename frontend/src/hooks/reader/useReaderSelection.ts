import { useCallback, useEffect, useState } from "react";
import type { Contents } from "epubjs";
import { useTranslation } from "react-i18next";
import type { ReaderTextSelection } from "../../types/reader";

export function useReaderSelection() {
  const { t } = useTranslation();
  const [textSelection, setTextSelection] =
    useState<ReaderTextSelection | null>(null);
  const [limitNotice, setLimitNotice] = useState<{ message: string } | null>(
    null,
  );
  const closeLookup = useCallback(() => setTextSelection(null), []);
  const clearLimitNotice = useCallback(() => setLimitNotice(null), []);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [limitNotice]);
  const onSelectionChange = useCallback((doc: Document) => {
    const text = doc.getSelection()?.toString().trim() || "";
    if (text.length <= 3000) setLimitNotice(null);
  }, []);
  const select = useCallback(
    (cfi: string, contents: Contents) => {
      const range = contents.range(cfi);
      const text = range.toString().trim();
      if (!text || text.length > 3000) {
        setTextSelection(null);
        setLimitNotice(
          text.length > 3000
            ? { message: t("reader.chat.selectionLimit") }
            : null,
        );
        return;
      }
      setLimitNotice(null);
      const candidate = text.replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, "");
      const word =
        /^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(candidate) &&
        candidate.length <= 80
          ? candidate
          : undefined;
      const frame = contents.document.defaultView?.frameElement;
      if (!frame) return;
      const rect = range.getBoundingClientRect();
      const offset = frame.getBoundingClientRect();
      setTextSelection({
        text,
        word,
        cfi,
        x: offset.left + rect.left,
        y: offset.top + rect.bottom + 8,
      });
    },
    [t],
  );
  return {
    textSelection,
    closeLookup,
    clearLimitNotice,
    onSelectionChange,
    select,
    limitNotice: limitNotice?.message || "",
  };
}
export type ReaderSelection = ReturnType<typeof useReaderSelection>;
