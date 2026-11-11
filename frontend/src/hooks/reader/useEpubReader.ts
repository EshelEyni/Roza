import {useTranslation} from "react-i18next";
import { useCallback, useRef, useState } from "react";
import type { ReaderBook } from "../../../../shared/types/reader";
import { useReaderState } from "../useReaderState";
import { useReaderMobile } from "../useReaderMobile";
import { useReaderChat } from "../useReaderChat";
import { useEpubRuntime } from "./useEpubRuntime";
import { useReaderPassageMarker } from "./useReaderPassageMarker";
import type { ReaderPassage } from "../../../../shared/types/readerChat";
import { useReaderSelection } from "./useReaderSelection";
import { useReaderPanels, useReaderPanelActions } from "./useReaderPanels";
import { useEpubPageTurns } from "./useEpubPageTurns";
import { useEpubNavigation } from "./useEpubNavigation";
import { useEpubBook } from "./useEpubBook";
import { useEpubPreferences } from "./useEpubPreferences";
import { useReaderFullscreen } from "./useReaderFullscreen";
import { useReaderJumpHistory } from "./useReaderJumpHistory";
import { useReaderPagination } from "./useReaderPagination";

/** Compose reader concerns; DOM and EPUB lifecycle work live in dedicated hooks. */
export function useEpubReader(book: ReaderBook, userId: string) {
  const {t} = useTranslation();
  const mobile = useReaderMobile();
  const { state, updateState, saveStatus, retrySave } = useReaderState(
    book,
    userId,
  );
  const selection = useReaderSelection();
  const { panel, setPanel, closePanel } = useReaderPanels();
  const runtime = useEpubRuntime(
    state,
    updateState,
    mobile,
    panel,
    selection.textSelection,
  );
  const { markPassage, clearMarker, passageMarks } = useReaderPassageMarker(runtime);
  const activeSelection = useRef(selection.textSelection);
  activeSelection.current = selection.textSelection;
  const markTranslation = useCallback((passage: ReaderPassage) => {
    if (activeSelection.current && activeSelection.current.cfi !== passage.cfi) return;
    void markPassage(passage, "blue").catch(() => undefined);
  }, [markPassage]);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const move = useEpubPageTurns(runtime, selection.closeLookup, setError, selection.extend, selection.isPageTurnBlocked);
  const engine = useEpubBook(
    book,
    state.preferences.flow,
    runtime,
    selection,
    move,
    attempt,
    setError,
    setNotice,
  );
  const pagination = useReaderPagination(
    runtime.host,
    engine.paginationFile,
    engine.location,
    state,
    updateState,
    setNotice,
  );
  const {describeLocation} = pagination;
  useEpubPreferences(
    runtime,
    pagination.renderingPreferences,
    engine.loading,
    setError,
  );
  const navigation = useEpubNavigation(runtime, {
    closeLookup: selection.closeLookup,
    closePanel,
    markPassage,
    clearMarker,
    locationsReady: engine.locationsReady,
    setError,
    setNotice,
  });
  const jumpHistory = useReaderJumpHistory(runtime, engine.location, describeLocation, navigation.returnTo,
    () => setNotice(t("reader.navigationError")));
  const getProgressDestination = useCallback(async (progress: number) => {
    const book = runtime.epubRef.current;
    if (!book || !engine.locationsReady) return null;
    const cfi = book.locations.cfiFromPercentage(Math.max(0,Math.min(1,progress)));
    const destination = await describeLocation(cfi);
    return destination?.label || null;
  }, [runtime,engine.locationsReady,describeLocation]);
  const display = useReaderFullscreen(runtime, setNotice);
  const chat = useReaderChat(
    book.id,
    () => runtime.readingBoundary.current || runtime.stateRef.current.location,
    userId,
  );
  const panelActions = useReaderPanelActions({
    mobile,
    shell: runtime.shell,
    closeLookup: selection.closeLookup,
    setPanel,
    chat,
    textSelection: selection.textSelection,
  });
  function retry() {
    setAttempt(value => value + 1);
  }
  function reload() {
    selection.closeLookup();
    closePanel();
    retry();
  }
  return {
    mobile,
    state,
    updateState,
    saveStatus,
    retrySave,
    panel,
    closePanel,
    chat,
    error,
    notice: selection.limitNotice || notice,
    textSelection: selection.textSelection,
    closeLookup: selection.closeLookup,
    markTranslation,
    passageMarks,
    getLookupPage: async (cfi: string) => {
      await runtime.lookupLocations.current;
      const locations = runtime.epubRef.current?.locations;
      // Use the existing fixed text locations, never reflowed screen page numbers.
      if (!locations?.length()) return cfi;
      const index = locations.locationFromCfi(cfi);
      return typeof index === "number" && index >= 0 ? locations.cfiFromLocation(index) || cfi : cfi;
    },
    getProgressDestination,
    returnPoint: jumpHistory.returnPoint,
    goBack: jumpHistory.goBack,
    extendSelection: (direction: "next" | "prev") =>
      selection.extend(runtime, direction),
    selectionExtending: selection.extending,
    selectionBusy: selection.busy,
    host: runtime.host,
    shell: runtime.shell,
    move,
    retry,
    reload,
    ...engine,
    ...pagination,
    ...navigation,
    ...display,
    ...panelActions,
  };
}
export type EpubReaderController = ReturnType<typeof useEpubReader>;
