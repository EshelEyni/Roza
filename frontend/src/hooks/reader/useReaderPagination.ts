import { useMemo } from "react";
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
  const { screen: pageCount, publisherPages } = useReaderPageCount(
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
    renderingPreferences,
    pageLabel,
    showPublisherPages,
    togglePageNumbering,
    publisherPagesAvailable:
      publisherPages === null ? null : publisherPages.length > 0,
  };
}
