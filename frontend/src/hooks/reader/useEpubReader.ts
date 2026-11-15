import { useSentencePanelKeyboard } from "./useSentencePanelKeyboard";
import { readerAiLimits } from "../../services/readerAiLimits";
import { useReaderProgressSettings } from "./useReaderProgressSettings";
import { useReaderFlags } from "./useReaderFlags";
import { useReaderKeyboardSettings } from "./useReaderKeyboardSettings";
import { useReaderSentenceMode } from "./useReaderSentenceMode";
import { useReaderRsvp } from "./useReaderRsvp";
import {useTranslation} from "react-i18next";
import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import { useReaderAnnotations } from "./useReaderAnnotations";

/** Compose reader concerns; DOM and EPUB lifecycle work live in dedicated hooks. */
export function useEpubReader(book: ReaderBook, userId: string) {
  const {t} = useTranslation();
  const mobile = useReaderMobile();
  const { state, updateState, saveStatus, retrySave } = useReaderState(
    book,
    userId,
  );
  const keyboard = useReaderKeyboardSettings(userId);
  const progressSettings = useReaderProgressSettings(userId);
  const selection = useReaderSelection();
  const { panel, setPanel, closePanel } = useReaderPanels();
  const runtime = useEpubRuntime(
    state,
    updateState,
    mobile,
    panel,
    selection.textSelection,
  );
  runtime.keyboardRef.current = keyboard.keyboardSettings;
  const { markPassage, locatePassage, clearMarker, passageMarks, translatedPassages } = useReaderPassageMarker(runtime);
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
  const flags = useReaderFlags(runtime, book.id, userId, engine.chapter);
  runtime.flagReady.current = flags.ready;
  selection.flagHandler.current = value => { if (!selection.busy) void flags.save(value); };
  const rsvp = useReaderRsvp(runtime, engine.loading || !!panel || !!selection.textSelection);
  const pagination = useReaderPagination(
    runtime.host,
    engine.paginationFile,
    engine.location,
    state,
    updateState,
    setNotice,
  );
  const openAnnotations = useCallback(() => setPanel("annotations"), [setPanel]);
  const annotations = useReaderAnnotations(runtime, book.id, userId, engine.chapter,
    openAnnotations, selection.closeLookup, panel === "annotations");
  runtime.wordAction.current = (action, value) => {
    if (action === "n") annotations.select(value, true);
    if (action === "f") void flags.save(value);
    if (action === "c") void navigator.clipboard.writeText(value.text)
      .then(() => setNotice(t("reader.selectionCopied")))
      .catch(() => setNotice(t("reader.selectionCopyError")));
    if (action === "a" && value.text.length <= readerAiLimits.passage) {
      chat.start(value); selection.closeLookup(); setPanel("chat");
    }
  };
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
    locatePassage,
    clearMarker,
    locationsReady: engine.locationsReady,
    setError,
    setNotice,
  });
  const sentenceMode = useReaderSentenceMode(runtime, navigation.returnTo);
  useSentencePanelKeyboard(sentenceMode.active);
  const toggleSentenceMode = (startCfi?: string) => {
    const cfi = sentenceMode.active ? undefined : startCfi || sentenceMode.entryCfi();
    selection.closeLookup();
    closePanel();
    return sentenceMode.toggle(cfi);
  };
  const [targetOrigin, setTargetOrigin] = useState<string | null>(null);
  runtime.enterSentenceMode.current = () => { if (!targetOrigin) void toggleSentenceMode(); };
  const [targetPending, setTargetPending] = useState(false);
  const [targetError, setTargetError] = useState("");
  const beginReadingTarget = async () => {
    const origin = sentenceMode.sentence?.cfi;
    if (!origin) return;
    await toggleSentenceMode();
    if (runtime.rsvpActive.current) return;
    setTargetError(""); setTargetOrigin(origin);
  };
  const finishReadingTarget = async (confirm: boolean) => {
    if (!targetOrigin || targetPending) return;
    setTargetPending(true); setTargetError("");
    try {
      if (confirm && selection.textSelection)
        await sentenceMode.setReadingTarget(selection.textSelection.cfi, selection.textSelection.text, targetOrigin);
      selection.closeLookup();
      await sentenceMode.toggle(targetOrigin);
      setTargetOrigin(null);
    } catch (error) {
      setTargetError(error instanceof Error ? error.message : "Could not set reading target. Try again.");
    } finally { setTargetPending(false); }
  };
  const jumpHistory = useReaderJumpHistory(runtime, engine.location, describeLocation, navigation.returnTo,
    () => setNotice(t("reader.navigationError")));
  const getProgressDestination = useCallback((progress: number) => {
    const book = runtime.epubRef.current;
    if (!book || !engine.locationsReady) return null;
    const cfi = book.locations.cfiFromPercentage(Math.max(0,Math.min(1,progress)));
    return pagination.getCachedPageLabel(cfi);
  }, [runtime,engine.locationsReady,pagination.getCachedPageLabel]);
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
    flags,
    review: { annotations, onOpenAnnotation: (id: string) => {
      selection.closeLookup();
      annotations.setDraft(null);
      annotations.setFilterId(id);
      setPanel("annotations");
    }, bookId: book.id, userId, onPassageNavigate: navigation.onFlagNavigate, revision: flags.items.map(item => item.id).join(","), onFlagsChanged: flags.sync,
      onAskAi: (passage: ReaderPassage) => { chat.start(passage); selection.closeLookup(); setPanel("chat"); } },
    ...keyboard,
    ...progressSettings,
    rsvp: { ...rsvp, toggle: () => { selection.closeLookup(); closePanel(); return rsvp.toggle(); } },
    readingTarget: { selecting: !!targetOrigin, pending: targetPending, error: targetError,
      begin: beginReadingTarget, finish: finishReadingTarget,
      chooseAgain: () => { selection.closeLookup(); setTargetError(""); } },
    sentenceMode: { ...sentenceMode, toggle: toggleSentenceMode },
    askSentenceAi: (passage: ReaderPassage, autoSubmit = false) => {
      if (passage.text.length > readerAiLimits.passage) return;
      flushSync(() => {
        const key = chat.start(passage);
        if (autoSubmit) chat.forTab(key).send("What does this sentence mean in this context?");
        setPanel("chat");
      });
      if (!autoSubmit) runtime.shell.current?.querySelector<HTMLTextAreaElement>(
        '[data-focused-group="true"] textarea[id^="reader-chat-question-"], #reader-chat-question',
      )?.focus({ preventScroll: true });
    },
    annotations,
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
    translatedPassages,
    getLookupPage: async (cfi: string) => {
      await runtime.lookupLocations.current;
      const locations = runtime.epubRef.current?.locations;
      // Use the existing fixed text locations, never reflowed screen page numbers.
      if (!locations?.length()) return cfi;
      const index = locations.locationFromCfi(cfi);
      return typeof index === "number" && index >= 0 ? locations.cfiFromLocation(index) || cfi : cfi;
    },
    pageNavigation: {
      total: pagination.totalPages,
      bookPagesAvailable: pagination.publisherPagesAvailable,
      bookRange: pagination.bookPageRange,
      defaultKind: pagination.showPublisherPages ? "book" as const : "screen" as const,
      go: async (value: string, kind: "book" | "screen") => {
        const cfi = await pagination.resolvePage(value, kind);
        closePanel(); selection.closeLookup();
        await navigation.returnTo(cfi);
      },
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
    onNavigate: (target: string) => {
      if (!sentenceMode.active) return navigation.onNavigate(target);
      void sentenceMode.toggle().then(() => { if (!runtime.rsvpActive.current) navigation.onNavigate(target); });
    },
    onAnnotationNavigate: async (target: string) => {
      if (sentenceMode.active) {
        await sentenceMode.toggle();
        if (runtime.rsvpActive.current) return;
      }
      navigation.onAnnotationNavigate(target);
    },
    onPassageNavigate: async (passage: ReaderPassage) => {
      if (sentenceMode.active) {
        await sentenceMode.toggle();
        if (runtime.rsvpActive.current) return;
      }
      await navigation.onPassageNavigate(passage);
    },
    ...display,
    ...panelActions,
  };
}
export type EpubReaderController = ReturnType<typeof useEpubReader>;
