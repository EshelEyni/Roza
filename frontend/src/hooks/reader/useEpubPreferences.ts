import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ReaderPreferences } from "../../../../shared/types/reader";
import { applyPreferences } from "../../services/readerPreferences";
import type { EpubRuntime } from "./useEpubRuntime";

export function useEpubPreferences(
  runtime: EpubRuntime,
  renderingPreferences: ReaderPreferences,
  loading: boolean,
  setError: (message: string) => void,
) {
  const { t } = useTranslation();
  const {
    renditionRef,
    stateRef,
    changingLayout,
    explicitNavigation,
    layoutTask,
  } = runtime;
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || loading) return;
    const cfi = stateRef.current.location;
    changingLayout.current = true;
    applyPreferences(rendition, renderingPreferences);
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (explicitNavigation.current) return;
      layoutTask.current = rendition
        .display(cfi || undefined)
        .then(() => {
          if (cancelled || renditionRef.current !== rendition) return;
          changingLayout.current = false;
          void rendition.reportLocation();
        })
        .catch(() => {
          if (cancelled || renditionRef.current !== rendition) return;
          changingLayout.current = false;
          setError(t("reader.navigationError"));
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    renderingPreferences,
    loading,
    t,
    renditionRef,
    stateRef,
    changingLayout,
    explicitNavigation,
    layoutTask,
    setError,
  ]);
}
