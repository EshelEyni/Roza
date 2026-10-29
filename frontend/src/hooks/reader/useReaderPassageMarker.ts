import { useCallback, useEffect, useRef } from "react";
import type { ReaderPassage } from "../../../../shared/types/readerChat";
import { ReaderPassageMarker } from "../../services/readerPassageMarker";
import { readSelectionRange } from "../../services/readerSelectionRange";
import type { EpubRuntime } from "./useEpubRuntime";

export function useReaderPassageMarker(runtime: EpubRuntime) {
  const marker = useRef<ReaderPassageMarker>();
  if (!marker.current)
    marker.current = new ReaderPassageMarker(
      () => runtime.renditionRef.current,
    );
  const clearMarker = marker.current.clear;
  useEffect(() => clearMarker, [clearMarker]);
  const markPassage = useCallback(
    async (passage: ReaderPassage, color: "blue" | "yellow") => {
      await marker.current!.show(passage, color, async (selected) => {
        if (!selected.endCfi) return [selected.cfi];
        const book = runtime.epubRef.current;
        if (!book) return [];
        const result = await readSelectionRange(
          book,
          selected.cfi,
          selected.endCfi,
        );
        return result.pieces
          .filter((piece) => piece.text.trim())
          .map((piece) => piece.cfi);
      });
    },
    [runtime],
  );
  return { markPassage, clearMarker };
}
