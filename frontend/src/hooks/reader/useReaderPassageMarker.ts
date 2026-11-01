import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReaderPassage } from "../../../../shared/types/readerChat";
import { ReaderPassageMarker } from "../../services/readerPassageMarker";
import { readerPassageKey } from "../../services/readerChatPresentation";
import { readSelectionRange } from "../../services/readerSelectionRange";
import type { EpubRuntime } from "./useEpubRuntime";

export function useReaderPassageMarker(runtime: EpubRuntime) {
  const translated = useRef<ReaderPassageMarker>();
  const passages = useRef(new Map<string, { passage: ReaderPassage; marker: ReaderPassageMarker; count: number }>());
  const disabled = useRef(new Set<string>());
  const [revision, setRevision] = useState(0);
  const createMarker = useCallback(() => new ReaderPassageMarker(
    () => runtime.renditionRef.current,
    color => color === "blue" ? runtime.stateRef.current.preferences.translationColor : runtime.stateRef.current.preferences.passageColor,
  ), [runtime]);
  if (!translated.current) translated.current = createMarker();
  const ranges = useCallback(async (selected: ReaderPassage) => {
    if (!selected.endCfi) return [selected.cfi];
    const book = runtime.epubRef.current;
    if (!book) return [];
    const result = await readSelectionRange(book, selected.cfi, selected.endCfi);
    return result.pieces.filter(piece => piece.text.trim()).map(piece => piece.cfi);
  }, [runtime]);
  const entryFor = useCallback((passage: ReaderPassage) => {
    const key = readerPassageKey(passage);
    let entry = passages.current.get(key);
    if (!entry) {
      entry = { passage, marker: createMarker(), count: 0 };
      passages.current.set(key, entry);
    }
    return entry;
  }, [createMarker]);
  const markPassage = useCallback(async (passage: ReaderPassage, color: "blue" | "yellow") => {
    if (color === "blue") return translated.current!.show(passage, color, ranges);
    const entry = passages.current.get(readerPassageKey(passage));
    if (entry?.count && !disabled.current.has(readerPassageKey(passage)))
      await entry.marker.show(passage, color, ranges);
  }, [ranges]);
  const register = useCallback((passage: ReaderPassage) => {
    const key = readerPassageKey(passage);
    const entry = entryFor(passage);
    entry.count++;
    void markPassage(passage, "yellow").catch(() => undefined);
    return () => {
      if (--entry.count === 0) {
        // Also cancels in-flight range resolution, so closed tabs cannot restore marks.
        entry.marker.clear();
        passages.current.delete(key);
      }
    };
  }, [entryFor, markPassage]);
  const toggle = useCallback((passage: ReaderPassage) => {
    const key = readerPassageKey(passage);
    if (disabled.current.has(key)) {
      disabled.current.delete(key);
      void markPassage(passage, "yellow").catch(() => undefined);
    } else {
      disabled.current.add(key);
      entryFor(passage).marker.clear();
    }
    setRevision(value => value + 1);
  }, [entryFor, markPassage]);
  const rendition = runtime.renditionRef.current;
  const passageColor = runtime.stateRef.current.preferences.passageColor;
  useEffect(() => {
    for (const entry of passages.current.values())
      if (!disabled.current.has(readerPassageKey(entry.passage)))
        void entry.marker.show(entry.passage, "yellow", ranges).catch(() => undefined);
  }, [passageColor, ranges, rendition]);
  useEffect(() => () => {
    translated.current?.clear();
    for (const entry of passages.current.values()) entry.marker.clear();
    passages.current.clear();
  }, []);
  const passageMarks = useMemo(() => {
    const hidden = new Set(disabled.current);
    return { register, toggle,
      enabled: (passage: ReaderPassage) => !hidden.has(readerPassageKey(passage)),
      revision,
    };
  }, [register, toggle, revision]);
  return { markPassage, clearMarker: translated.current.clear, passageMarks };
}
