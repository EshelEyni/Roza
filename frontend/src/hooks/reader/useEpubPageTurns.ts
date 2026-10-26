import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { EpubRuntime } from "./useEpubRuntime";
export function useEpubPageTurns(
  runtime: EpubRuntime,
  closeLookup: () => void,
  setError: (message: string) => void,
) {
  const { t } = useTranslation();
  const { changingLayout, renditionRef } = runtime;
  const move = useCallback(
    (direction: "next" | "prev") => {
      if (changingLayout.current) return;
      const rendition = renditionRef.current;
      closeLookup();
      if (rendition)
        void rendition[direction]().catch(() =>
          setError(t("reader.navigationError")),
        );
    },
    [t, changingLayout, renditionRef, closeLookup, setError],
  );

  return move;
}
