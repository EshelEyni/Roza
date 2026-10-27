import { useCallback, useEffect, useRef, useState } from "react";
import type { Contents, Location } from "epubjs";
import { useTranslation } from "react-i18next";
import type { ReaderTextSelection } from "../../types/reader";
import type { EpubRuntime } from "./useEpubRuntime";
import {
  readSelectionRange,
  selectionEndpoints,
} from "../../services/readerSelectionRange";

export function useReaderSelection() {
  const { t } = useTranslation();
  const [textSelection, setTextSelection] =
    useState<ReaderTextSelection | null>(null);
  const [limitNotice, setLimitNotice] = useState<{ message: string } | null>(
    null,
  );
  const current = useRef<ReaderTextSelection | null>(null);
  const selectionDocument = useRef<Document | null>(null);
  const session = useRef<{
    start: string;
    end: string;
    direction: "next" | "prev";
    runtime: EpubRuntime;
  } | null>(null);
  const highlights = useRef<{ cfi: string; runtime: EpubRuntime }[]>([]);
  const version = useRef(0);
  const turning = useRef(false);
  const reading = useRef(false);
  const [extending, setExtending] = useState(false);
  const [busy, setBusy] = useState(false);
  const clearHighlights = useCallback(() => {
    highlights.current.forEach(({ cfi, runtime }) =>
      runtime.renditionRef.current?.annotations.remove(cfi, "highlight"),
    );
    highlights.current = [];
  }, []);
  const closeLookup = useCallback(() => {
    ++version.current;
    // Preserve main's mobile dismissal fix: the backdrop cannot clear the iframe range.
    const doc = selectionDocument.current;
    selectionDocument.current = null;
    doc?.getSelection()?.removeAllRanges();
    if (session.current) {
      // epub.js returns an array here; its published declaration says Contents.
      const contents =
        session.current.runtime.renditionRef.current?.getContents() as unknown as
          | Contents[]
          | undefined;
      contents?.forEach(content =>
        content.document.getSelection()?.removeAllRanges(),
      );
    }
    session.current = null;
    reading.current = false;
    current.current = null;
    clearHighlights();
    setExtending(false);
    setBusy(false);
    setTextSelection(null);
  }, [clearHighlights]);
  useEffect(() => closeLookup, [closeLookup]);

  const publishRange = useCallback(
    async (focus: string) => {
      const active = session.current;
      const previous = current.current;
      const book = active?.runtime.epubRef.current;
      if (!active || !book || !previous) return;
      const request = ++version.current;
      reading.current = true;
      setBusy(true);
      try {
        const anchor = active.direction === "next" ? active.start : active.end;
        const result = await readSelectionRange(book, anchor, focus);
        if (request !== version.current || session.current !== active) return;
        clearHighlights();
        const rendition = active.runtime.renditionRef.current;
        for (const piece of result.pieces) {
          if (!piece.text) continue;
          rendition?.annotations.highlight(
            piece.cfi,
            {},
            undefined,
            "reader-selection-highlight",
            {
              fill: "#719bd8",
              "fill-opacity": "0.3",
              "pointer-events": "none",
            },
          );
          highlights.current.push({ cfi: piece.cfi, runtime: active.runtime });
        }
        const next = {
          ...previous,
          text: result.text,
          cfi: result.cfi,
          endCfi: result.endCfi,
          word: undefined,
        };
        current.current = next;
        setTextSelection(next);
        setLimitNotice(
          result.text.length > 3000
            ? { message: t("reader.chat.selectionLimit") }
            : null,
        );
      } catch {
        if (request === version.current)
          setLimitNotice({ message: t("reader.selectionError") });
      } finally {
        if (request === version.current) {
          reading.current = false;
          setBusy(false);
        }
      }
    },
    [clearHighlights, t],
  );

  const extend = useCallback(
    async (runtime: EpubRuntime, direction: "next" | "prev") => {
      const selected = current.current;
      const rendition = runtime.renditionRef.current;
      if (
        !selected ||
        !rendition ||
        turning.current ||
        runtime.changingLayout.current
      )
        return;
      // epub.js's declarations incorrectly describe these public API return types.
      const location = rendition.currentLocation() as unknown as
        | Location
        | undefined;
      if (!location?.start || !location.end) return;
      if (
        (direction === "next" && location.atEnd) ||
        (direction === "prev" && location.atStart)
      )
        return;
      if (!session.current) {
        session.current = {
          ...selectionEndpoints(selected.cfi),
          direction,
          runtime,
        };
        setExtending(true);
      }
      turning.current = true;
      setBusy(true);
      const active = session.current;
      try {
        // Clear only the native fragment; the persistent endpoints survive iframe replacement.
        (rendition.getContents() as unknown as Contents[]).forEach(contents =>
          contents.document.getSelection()?.removeAllRanges(),
        );
        await rendition[direction]();
        await rendition.reportLocation();
        if (session.current !== active) return;
        const next = rendition.currentLocation() as unknown as Location;
        await publishRange(
          active.direction === "next" ? next.end.cfi : next.start.cfi,
        );
      } catch {
        if (session.current === active)
          setLimitNotice({ message: t("reader.selectionError") });
      } finally {
        turning.current = false;
        if (session.current === active) setBusy(false);
      }
    },
    [publishRange, t],
  );

  const isExtending = useCallback(() => !!session.current, []);
  const copySelection = useCallback((event: ClipboardEvent) => {
    if (!session.current || !current.current || !event.clipboardData) return;
    event.preventDefault();
    if (turning.current || reading.current) return;
    event.clipboardData.setData("text/plain", current.current.text);
  }, []);
  useEffect(() => {
    document.addEventListener("copy", copySelection);
    return () => document.removeEventListener("copy", copySelection);
  }, [copySelection]);
  const clearLimitNotice = useCallback(() => setLimitNotice(null), []);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [limitNotice]);
  const onSelectionChange = useCallback((doc: Document) => {
    const text = doc.getSelection()?.toString().trim() || "";
    // Page extension deliberately clears native fragments while keeping its CFI endpoints.
    if (!text && !session.current && !turning.current) {
      if (selectionDocument.current === doc) selectionDocument.current = null;
      current.current = null;
      setTextSelection(null);
    }
    if (text.length <= 3000) setLimitNotice(null);
  }, []);
  const select = useCallback(
    (cfi: string, contents: Contents) => {
      if (turning.current || !contents.document) return;
      const range = contents.range(cfi);
      const text = range.toString().trim();
      if (session.current) {
        const endpoints = selectionEndpoints(cfi);
        void publishRange(
          session.current.direction === "next"
            ? endpoints.end
            : endpoints.start,
        );
        return;
      }
      if (!text) {
        current.current = null;
        setTextSelection(null);
        setLimitNotice(null);
        return;
      }
      setLimitNotice(
        text.length > 3000
          ? { message: t("reader.chat.selectionLimit") }
          : null,
      );
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
      selectionDocument.current = contents.document;
      const next = {
        text,
        word,
        cfi,
        x: offset.left + rect.left,
        y: offset.top + rect.bottom + 8,
      };
      current.current = next;
      setTextSelection(next);
    },
    [t, publishRange],
  );
  return {
    textSelection,
    closeLookup,
    clearLimitNotice,
    onSelectionChange,
    select,
    limitNotice: limitNotice?.message || "",
    extend,
    extending,
    busy,
    isExtending,
    copySelection,
  };
}
export type ReaderSelection = ReturnType<typeof useReaderSelection>;
