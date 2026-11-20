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
  const { appliedPreferences } = runtime;
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
    const applied = appliedPreferences.current;
    if (applied && Object.entries(renderingPreferences).every(
      ([key, value]) => applied[key as keyof ReaderPreferences] === value,
    )) return;
    const generation = runtime.navigationVersion.current;
    changingLayout.current = true;
    appliedPreferences.current = undefined;
    applyPreferences(rendition, renderingPreferences);
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled || renditionRef.current !== rendition || explicitNavigation.current ||
        generation !== runtime.navigationVersion.current) return;
      if (runtime.rsvpActive.current) { changingLayout.current = false; return; }
      const cfi = stateRef.current.location;
      layoutTask.current = rendition
        .display(cfi || undefined)
        .then(() => {
          if (cancelled || renditionRef.current !== rendition || generation !== runtime.navigationVersion.current) return;
          appliedPreferences.current = renderingPreferences;
          changingLayout.current = false;
          void rendition.reportLocation();
        })
        .catch(() => {
          if (cancelled || renditionRef.current !== rendition || generation !== runtime.navigationVersion.current) return;
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
    appliedPreferences,
  ]);
}
