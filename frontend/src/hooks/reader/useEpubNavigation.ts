import { EpubCFI } from "epubjs";
import { useTranslation } from "react-i18next";
import type { ReaderPassage } from "../../../../shared/types/readerChat";
import type { EpubRuntime } from "./useEpubRuntime";

export function useEpubNavigation(
  runtime: EpubRuntime,
  {
    closeLookup,
    closePanel,
    markPassage,
    clearMarker,
    locationsReady,
    setError,
    setNotice,
  }: {
    closeLookup: () => void;
    closePanel: () => void;
    clearMarker: () => void;
    markPassage: (passage: ReaderPassage, color: "blue" | "yellow") => Promise<void>;
    locationsReady: boolean;
    setError: (error: string) => void;
    setNotice: (notice: string) => void;
  },
) {
  const { t } = useTranslation();
  const {
    changingLayout,
    renditionRef,
    navigationVersion,
    explicitNavigation,
    pendingResize,
    layoutTask,
    host,
    highlightedCfi,
    mobileRef,
    epubRef,
  } = runtime;
  async function navigateTo(target: string) {
    clearMarker();
    closeLookup();
    if (target.startsWith("epubcfi(")) {
      const anchor = new EpubCFI(target);
      anchor.collapse(true);
      target = anchor.toString();
    }
    const rendition = renditionRef.current;
    if (!rendition) return;
    const version = ++navigationVersion.current;
    explicitNavigation.current = true;
    clearTimeout(pendingResize.current);
    try {
      await layoutTask.current;
      if (
        version !== navigationVersion.current ||
        renditionRef.current !== rendition
      )
        return;
      changingLayout.current = true;
      const element = host.current;
      if (element) {
        // epub.js accepts an optional CFI here but omits it from its TypeScript definition.
        const resize = rendition.resize as (
          width: number,
          height: number,
          cfi?: string,
        ) => void;
        resize.call(
          rendition,
          element.clientWidth,
          element.clientHeight,
          target,
        );
      }
      await rendition.display(target);
      // Continuous views can expand while neighboring sections are inserted.
      // Re-anchor once after layout has painted, using the now-final offsets.
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (
        renditionRef.current !== rendition ||
        version !== navigationVersion.current
      )
        return;
      await rendition.display(target);
      if (
        version !== navigationVersion.current ||
        renditionRef.current !== rendition
      )
        return;
      changingLayout.current = false;
      await rendition.reportLocation();
    } finally {
      if (
        version === navigationVersion.current &&
        renditionRef.current === rendition
      ) {
        explicitNavigation.current = false;
        changingLayout.current = false;
      }
    }
  }

  function onNavigate(target: string) {
    closePanel();
    void navigateTo(target).catch(() => setError(t("reader.navigationError")));
  }

  async function onSearchNavigate(cfi: string) {
    const rendition = renditionRef.current;
    if (!rendition) return;
    try {
      await navigateTo(cfi);
      if (renditionRef.current !== rendition) return;
      if (highlightedCfi.current)
        rendition.annotations.remove(highlightedCfi.current, "highlight");
      rendition.annotations.highlight(
        cfi,
        {},
        undefined,
        "reader-search-highlight",
        {
          fill: "#d6a750",
          "fill-opacity": "0.4",
          "mix-blend-mode": "multiply",
        },
      );
      highlightedCfi.current = cfi;
      if (mobileRef.current) closePanel();
    } catch {
      if (renditionRef.current === rendition)
        setNotice(t("reader.navigationError"));
    }
  }

  async function onPassageNavigate(passage: ReaderPassage) {
    const rendition = renditionRef.current;
    if (!rendition) return;
    if (mobileRef.current) closePanel();
    try {
      const task = navigateTo(passage.cfi);
      const version = navigationVersion.current;
      await task;
      if (renditionRef.current !== rendition || version !== navigationVersion.current) return;
      await markPassage(passage, "yellow");
    } catch {
      if (renditionRef.current === rendition) setNotice(t("reader.navigationError"));
    }
  }

  async function onProgressNavigate(progress: number) {
    const epub = epubRef.current;
    const rendition = renditionRef.current;
    if (!epub || !rendition || !locationsReady) return;
    try {
      const target =
        progress <= 0
          ? epub.spine.first().href
          : epub.locations.cfiFromPercentage(progress);
      await navigateTo(target);
    } catch {
      if (renditionRef.current === rendition)
        setNotice(t("reader.navigationError"));
    }
  }

  return { onNavigate, onSearchNavigate, onProgressNavigate, onPassageNavigate };
}
