import { useCallback, useMemo } from "react";
import type { Location } from "epubjs";
import { useTranslation } from "react-i18next";
import type { ReaderState } from "../../../../shared/types/reader";
import { useReaderPageCount } from "../useReaderPageCount";
import { applyPreferences } from "../../services/readerPreferences";
import { publisherPageAt } from "../../services/readerPublisherPages";
import type { EpubRuntime } from "./useEpubRuntime";
export function useReaderPagination(
  host: EpubRuntime["host"],
  paginationFile: ArrayBuffer | null,
  location: Location | null,
  state: ReaderState,
  updateState: (changes: Partial<ReaderState>) => void,
  setNotice: (message: string) => void,
) {
  const { t } = useTranslation();
  // Numbering changes only affect the footer, never the EPUB layout or page measurement.
  const renderingPreferences = useMemo(
    () => ({
      fontSize: state.preferences.fontSize,
      fontFamily: state.preferences.fontFamily,
      lineHeight: state.preferences.lineHeight,
      width: state.preferences.width,
      theme: state.preferences.theme,
      flow: state.preferences.flow,
    }),
    [
      state.preferences.fontSize,
      state.preferences.fontFamily,
      state.preferences.lineHeight,
      state.preferences.width,
      state.preferences.theme,
      state.preferences.flow,
    ],
  );
  const visualPreferences = useMemo(() => ({
    ...renderingPreferences,
    backgroundColor: state.preferences.backgroundColor,
    selectionColor: state.preferences.selectionColor,
    selectionTextColor: state.preferences.selectionTextColor,
  }), [renderingPreferences, state.preferences.backgroundColor, state.preferences.selectionColor, state.preferences.selectionTextColor]);
  const { screen: pageCount, publisherPages, getPage, getPageCfi, getCachedPage } = useReaderPageCount(
    host,
    paginationFile,
    renderingPreferences,
    location,
    applyPreferences,
  );
  const showPublisherPages = state.preferences.pageNumbering === "publisher";
  const publisherLabel =
    publisherPages && location
      ? (publisherPageAt(publisherPages, location.start.cfi)?.label ?? null)
      : null;

  const describeLocation = useCallback(async (cfi: string) => {
    const screen = await getPage(cfi);
    if (!screen) return null;
    const publisher = showPublisherPages && publisherPages?.length ? publisherPageAt(publisherPages, cfi)?.label : undefined;
    return { page: screen.page, label: publisher || String(screen.page) };
  }, [getPage, publisherPages, showPublisherPages]);
  const pageLabel =
    showPublisherPages && publisherPages?.length
      ? t("reader.bookPageOfTotal", {
          page: publisherLabel || "—",
          total: publisherPages[publisherPages.length - 1].label,
        })
      : pageCount
        ? t("reader.pageOfTotal", {
            page: pageCount.page,
            total: pageCount.total,
          })
        : t("reader.countingPages");
  function togglePageNumbering() {
    if (publisherPages === null) setNotice(t("reader.preparingBookPages"));
    else if (!publisherPages.length) setNotice(t("reader.noBookPages"));
    else {
      updateState({
        preferences: {
          ...state.preferences,
          pageNumbering: showPublisherPages ? "screen" : "publisher",
        },
      });
      setNotice("");
    }
  }
  return {
    getCachedPageLabel: (cfi: string) => {
      if (showPublisherPages && publisherPages?.length) return publisherPageAt(publisherPages, cfi)?.label ?? null;
      const page = getCachedPage(cfi);
      return page ? String(page.page) : null;
    },
    bookPageRange: publisherPages?.reduce<{ min: number; max: number } | null>((range, page) => {
      if (!/^\d+$/.test(page.label)) return range;
      const number = Number(page.label);
      if (!Number.isSafeInteger(number)) return range;
      return range ? { min: Math.min(range.min, number), max: Math.max(range.max, number) } : { min: number, max: number };
    }, null) ?? null,
    resolvePage: async (value: string, kind: "book" | "screen") => {
      if (kind === "book") {
        if (publisherPages === null) throw new Error("Book pages are still loading.");
        if (!publisherPages.length) throw new Error("This book has no book-page labels. Choose screen page instead.");
        const number = Number(value);
        if (!value.trim() || !Number.isSafeInteger(number) || number < 0) throw new Error("Enter a valid book-page number.");
        const page = publisherPages.find(page => /^\d+$/.test(page.label) && Number(page.label) === number);
        if (!page) throw new Error("That book-page number is not available.");
        return page.cfi;
      }
      const number = Number(value);
      if (!pageCount) throw new Error("Screen pages are still being counted.");
      if (!value.trim() || !Number.isInteger(number) || number < 1 || number > pageCount.total)
        throw new Error("Enter a screen page from 1 to " + pageCount.total + ".");
      const cfi = await getPageCfi(number);
      if (!cfi) throw new Error("Screen pagination changed. Please try again.");
      return cfi;
    },
    renderingPreferences: visualPreferences,
    describeLocation,
    totalPages: pageCount?.total || 0,
    remainingSectionPages: pageCount?.sectionRemaining ?? null,
    remainingBookPages: pageCount ? Math.max(0, pageCount.total - pageCount.page) : null,
    pageLabel,
    showPublisherPages,
    togglePageNumbering,
    publisherPagesAvailable:
      publisherPages === null ? null : publisherPages.length > 0,
  };
}
