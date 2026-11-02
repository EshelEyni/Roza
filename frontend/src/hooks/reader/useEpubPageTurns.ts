import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { EpubRuntime } from "./useEpubRuntime";
export function useEpubPageTurns(
  runtime: EpubRuntime,
  closeLookup: () => void,
  setError: (message: string) => void,
  extendSelection?: (runtime: EpubRuntime, direction: "next" | "prev") => Promise<void>,
) {
  const { t } = useTranslation();
  const { changingLayout, renditionRef, selectionRef } = runtime;
  const move = useCallback(
    (direction: "next" | "prev") => {
      if (changingLayout.current) return;
      if (selectionRef.current?.suppressTooltip && extendSelection) {
        void extendSelection(runtime, direction).catch(() =>
          setError(t("reader.navigationError")),
        );
        return;
      }
      const rendition = renditionRef.current;
      closeLookup();
      if (rendition)
        void rendition[direction]().catch(() =>
          setError(t("reader.navigationError")),
        );
    },
    [t, runtime, changingLayout, renditionRef, selectionRef, closeLookup, setError, extendSelection],
  );

  return move;
}
