import { useState } from "react";
import type { ReaderBook } from "../../../../shared/types/reader";
import { useReaderState } from "../useReaderState";
import { useReaderMobile } from "../useReaderMobile";
import { useReaderChat } from "../useReaderChat";
import { useEpubRuntime } from "./useEpubRuntime";
import { useReaderSelection } from "./useReaderSelection";
import { useReaderPanels, useReaderPanelActions } from "./useReaderPanels";
import { useEpubPageTurns } from "./useEpubPageTurns";
import { useEpubNavigation } from "./useEpubNavigation";
import { useEpubBook } from "./useEpubBook";
import { useEpubPreferences } from "./useEpubPreferences";
import { useReaderFullscreen } from "./useReaderFullscreen";
import { useReaderPagination } from "./useReaderPagination";

/** Compose reader concerns; DOM and EPUB lifecycle work live in dedicated hooks. */
export function useEpubReader(book: ReaderBook, userId: string) {
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
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const move = useEpubPageTurns(runtime, selection.closeLookup, setError);
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
  useEpubPreferences(
    runtime,
    pagination.renderingPreferences,
    engine.loading,
    setError,
  );
  const navigation = useEpubNavigation(runtime, {
    closeLookup: selection.closeLookup,
    closePanel,
    locationsReady: engine.locationsReady,
    setError,
    setNotice,
  });
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
