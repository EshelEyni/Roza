import { useEffect } from "react";
import type { ReaderPreferences } from "../../../../shared/types/reader";
import { applyPreferences } from "../../services/readerPreferences";
import type { EpubRuntime } from "./useEpubRuntime";

export function useEpubPreferences(
  runtime: EpubRuntime,
  renderingPreferences: ReaderPreferences,
  loading: boolean,
) {
  const { renditionRef, requestLayout } = runtime;
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || loading) return;
    // Guard before changing styles; resize and font changes share one anchor
    // and completion owner so neither can unlock the other's pending reflow.
    requestLayout.current?.();
    applyPreferences(rendition, renderingPreferences);
  }, [renderingPreferences, loading, renditionRef, requestLayout]);
}
