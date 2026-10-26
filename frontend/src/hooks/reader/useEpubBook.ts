import { useEffect, useState } from "react";
import ePub, {
  type Book,
  type Contents,
  type Location,
  type NavItem,
} from "epubjs";
import type Rendition from "epubjs/types/rendition";
import type { RenditionOptions } from "epubjs/types/rendition";
import { useTranslation } from "react-i18next";
import type {
  ReaderBook,
  ReaderPreferences,
} from "../../../../shared/types/reader";
import { applyPreferences } from "../../services/readerPreferences";
import readerApiService from "../../services/readerApiService";
import { protectReaderDocument } from "../../services/readerContentSecurity";
import { bindReaderContents } from "../../services/bindReaderContents";
import { observeReaderLayout } from "../../services/observeReaderLayout";
import type { ReaderSelection } from "./useReaderSelection";
import type { EpubRuntime } from "./useEpubRuntime";

export function useEpubBook(
  book: ReaderBook,
  flow: ReaderPreferences["flow"],
  runtime: EpubRuntime,
  selection: ReaderSelection,
  move: (direction: "next" | "prev") => void,
  attempt: number,
  setError: (message: string) => void,
  setNotice: (message: string) => void,
) {
  const { t } = useTranslation();
  const { closeLookup, clearLimitNotice, onSelectionChange, select } =
    selection;
  const [toc, setToc] = useState<NavItem[]>([]);
  const [href, setHref] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [searchBook, setSearchBook] = useState<Book | null>(null);
  const [paginationFile, setPaginationFile] = useState<ArrayBuffer | null>(
    null,
  );
  const [locationsReady, setLocationsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [atStart, setAtStart] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [chapter, setChapter] = useState("");
  useEffect(() => {
    const {
      host,
      stateRef,
      updateRef,
      epubRef,
      renditionRef,
      changingLayout,
      fullscreenResizeAnchor,
      explicitNavigation,
      layoutTask,
      highlightedCfi,
      readingBoundary,
      mobileRef,
      panelRef,
      pendingResize,
    } = runtime;
    const controller = new AbortController();
    let cancelled = false;
    let epub: Book | undefined;
    let rendition: Rendition | undefined;
    let stopObserving: (() => void) | undefined;
    const touchCleanups: (() => void)[] = [];
    let ready = false;
    let hasLocations = false;
    const element = host.current!;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLookup();
      const target = event.target as HTMLElement | null;
      if (
        changingLayout.current ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        target?.closest(
          "input, textarea, select, button, [contenteditable=true]",
        ) ||
        stateRef.current.preferences.flow !== "paginated"
      )
        return;
      const selection = target?.ownerDocument?.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        void rendition?.next().catch(() => undefined);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        void rendition?.prev().catch(() => undefined);
      }
    };
    async function start() {
      changingLayout.current = false;
      fullscreenResizeAnchor.current = null;
      explicitNavigation.current = false;
      layoutTask.current = Promise.resolve();
      setLoading(true);
      setSearchBook(null);
      setPaginationFile(null);
      setLocation(null);
      setLocationsReady(false);
      highlightedCfi.current = "";
      readingBoundary.current = "";
      setError("");
      setNotice("");
      clearLimitNotice();
      try {
        const buffer = await readerApiService.getFile(
          book.id,
          controller.signal,
        );
        if (cancelled) return;
        epub = ePub({ replacements: "blobUrl" });
        epub.spine.hooks.content.register(protectReaderDocument);
        await epub.open(buffer, "binary");
        await Promise.all([epub.opened, epub.ready]);
        if (cancelled) {
          epub.destroy();
          return;
        }
        epubRef.current = epub;
        setSearchBook(epub);
        setPaginationFile(buffer);
        let count = 0;
        const fallback: NavItem[] = [];
        epub.spine.each(
          (section: { idref: string; href: string; linear: boolean }) => {
            if (section.linear !== false) {
              count += 1;
              fallback.push({
                id: section.idref,
                href: section.href,
                label: t("reader.section", { number: count }),
              });
            }
          },
        );
        const navigation = await epub.loaded.navigation;
        if (cancelled) {
          epub.destroy();
          return;
        }
        setToc(navigation.toc.length ? navigation.toc : fallback);
        const preferences = stateRef.current.preferences;
        const renderOptions: RenditionOptions & { gap: number } = {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: preferences.flow === "paginated" ? "paginated" : "scrolled-doc",
          manager: preferences.flow === "scrolled" ? "continuous" : "default",
          // WebKit blocks parent event callbacks without this sandbox permission.
          // protectReaderDocument blocks book scripts before iframe parsing.
          allowScriptedContent: true,
          gap: 40,
        };
        rendition = epub.renderTo(element, renderOptions);
        renditionRef.current = rendition;
        applyPreferences(rendition, preferences);
        rendition.hooks.content.register((contents: Contents) => {
          touchCleanups.push(
            bindReaderContents(
              contents,
              runtime,
              { onSelectionChange, closeLookup },
              {
                onKey,
                enabled: () => ready && !cancelled && !changingLayout.current,
                move,
                title: book.title,
              },
            ),
          );
        });
        rendition.on("selected", (cfi: string, contents: Contents) => {
          if (
            cancelled ||
            changingLayout.current ||
            (mobileRef.current && panelRef.current)
          )
            return;
          select(cfi, contents);
        });
        rendition.on("relocated", (location: Location) => {
          if (cancelled || !ready || changingLayout.current) return;
          closeLookup();
          clearLimitNotice();
          setLocation(location);
          const start = location.start;
          readingBoundary.current = location.end.cfi || start.cfi;
          setHref(start.href);
          setAtStart(location.atStart);
          setAtEnd(location.atEnd);
          const entry = epub?.navigation.get(start.href);
          setChapter(
            entry?.label || t("reader.section", { number: start.index + 1 }),
          );
          const progress =
            hasLocations && epub?.locations.length()
              ? epub.locations.percentageFromCfi(start.cfi)
              : stateRef.current.progress;
          updateRef.current({
            location: start.cfi,
            progress: location.atEnd
              ? 1
              : Math.min(
                  1,
                  Math.max(
                    0,
                    Number.isFinite(progress)
                      ? progress
                      : stateRef.current.progress,
                  ),
                ),
          });
        });
        try {
          await rendition.display(stateRef.current.location || undefined);
        } catch {
          await rendition.display();
          if (!cancelled) setNotice(t("reader.positionFallback"));
        }
        if (cancelled) return;
        ready = true;
        setLoading(false);
        await rendition.reportLocation();
        void epub.locations
          .generate(1600)
          .then(() => {
            if (cancelled) return;
            hasLocations = true;
            setLocationsReady(epub!.locations.length() > 0);
            void rendition?.reportLocation();
          })
          .catch(() => undefined);
        document.addEventListener("keydown", onKey);
        stopObserving = observeReaderLayout(
          element,
          rendition,
          runtime,
          () => ready && !cancelled,
          setError,
          t("reader.navigationError"),
        );
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : t("reader.openError"));
        }
      }
    }
    const opening = start();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(pendingResize.current);
      stopObserving?.();
      touchCleanups.forEach(cleanup => cleanup());
      document.removeEventListener("keydown", onKey);
      renditionRef.current = undefined;
      epubRef.current = undefined;
      // EPUB open() returns before its navigation and resource work settles.
      void opening.then(() => {
        if (epub?.isOpen) epub.destroy();
      });
      element.replaceChildren();
    };
  }, [
    book.id,
    book.title,
    flow,
    attempt,
    t,
    move,
    runtime,
    closeLookup,
    clearLimitNotice,
    onSelectionChange,
    select,
    setError,
    setNotice,
  ]);

  return {
    toc,
    href,
    location,
    searchBook,
    paginationFile,
    locationsReady,
    loading,
    atStart,
    atEnd,
    chapter,
  };
}
