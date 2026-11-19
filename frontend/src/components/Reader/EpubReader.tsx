import { ReaderChatNotification } from "./ReaderChatNotification";
import { ReaderReadingTarget } from "./ReaderReadingTarget";
import { ReaderSentenceMode } from "./ReaderSentenceMode";
import { useSearchParams } from "react-router-dom";
import { ReaderRsvp } from "./ReaderRsvp";
import { useEffect, useRef, useState } from "react";
import { ReaderPassageMarks } from "./ReaderPassageMarks";
import { readerAiLimits } from "../../services/readerAiLimits";
import type { ReaderBook } from "../../../../shared/types/reader";
import { useEpubReader } from "../../hooks/reader/useEpubReader";
import { ReaderDictionary } from "./ReaderDictionary";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderPanels } from "./ReaderPanels";
import { ReaderViewport } from "./ReaderViewport";
import { ReaderNotices } from "./ReaderNotices";
import { ReaderFooter } from "./ReaderFooter";
import { ReaderAudiobookHost } from "./Audiobook/ReaderAudiobookHost";
import { useReaderModeSync } from "../../hooks/reader/useReaderModeSync";
import { readerDestinationKey } from "../../services/readerMode";

export function EpubReader({
  book,
  userId,
}: {
  book: ReaderBook;
  userId: string;
}) {
  const reader = useEpubReader(book, userId);
  const [params] = useSearchParams();
  const destination = useRef("");
  // Mode restoration waits for a URL destination so it starts from the requested position.
  const [destinationSettled, setDestinationSettled] = useState(() => !params.get("flag") && !params.get("location"));
  useEffect(() => {
    if (!destinationSettled && !reader.flags.ready && reader.flags.message) setDestinationSettled(true);
  }, [destinationSettled, reader.flags.ready, reader.flags.message]);
  useEffect(() => {
    if (reader.loading || !reader.flags.ready) return;
    const flag = reader.flags.items.find(f => f.id === params.get("flag"));
    const location = flag?.cfi || params.get("location");
    // The mode parameter is reader UI state, not a destination: changing it must not re-navigate.
    const key = readerDestinationKey(params.toString());
    if (!location || destination.current === key) { setDestinationSettled(true); return; }
    destination.current = key;
    if (flag) {
      void reader.onPassageNavigate(flag).finally(() => setDestinationSettled(true));
      if (params.get("action") === "ai" && flag.text.length <= readerAiLimits.passage) { reader.chat.start(flag); reader.togglePanel("chat"); }
    } else if (location.startsWith("epubcfi(")) {
      void Promise.resolve(reader.onNavigate(location)).finally(() => setDestinationSettled(true));
    } else setDestinationSettled(true);
  }, [reader, params]);
  // Sentence Mode saves its exact sentence as the location. Capture it before page rendering
  // reports the page start; a URL destination supplies its own position instead.
  const [resumeCfi] = useState(() =>
    params.get("flag") || params.get("location") ? undefined : reader.state.location || undefined);
  useReaderModeSync(reader, !reader.loading && !reader.error && destinationSettled, resumeCfi);
  const [copyToast, setCopyToast] = useState<{ message: string; id: number } | null>(null);
  useEffect(() => {
    if (!copyToast) return;
    const timer = window.setTimeout(() => setCopyToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyToast]);
  return (
    <ReaderPassageMarks.Provider value={reader.passageMarks}>
    <div
      className={"reader-shell reader-theme-" + reader.state.preferences.theme}
      style={{ background: reader.state.preferences.backgroundColor }}
      ref={reader.shell}
    >
      <span className="app-header-status-surface" aria-hidden="true" />
      {reader.flags.message && <div className="reader-copy-toast" role="status">{reader.flags.message}</div>}
      {copyToast && <div key={copyToast.id} className="reader-copy-toast" role="status" aria-live="polite">{copyToast.message}</div>}
      {reader.textSelection && !reader.readingTarget.selecting && !reader.textSelection.suppressTooltip && (
        <ReaderDictionary
          key={reader.textSelection.cfi}
          selection={reader.textSelection}
          onCopyFeedback={message => setCopyToast(current => ({ message, id: (current?.id || 0) + 1 }))}
          onFlag={() => void reader.flags.save(reader.textSelection!, true)}
          flagged={!!reader.flags.has(reader.textSelection)}
          flagReady={reader.flags.ready}
          onAnnotate={note => reader.annotations.select(reader.textSelection!, note)}
          annotationBusy={reader.annotations.busy || reader.annotations.loading}
          bookId={book.id}
          getLookupPage={reader.getLookupPage}
          onClose={reader.closeLookup}
          onTranslationDismiss={reader.markTranslation}
          aiDisabled={
            reader.selectionBusy ||
            reader.textSelection.text.length > readerAiLimits.passage
          }
          onAskAi={reader.askAi}
          extending={reader.selectionExtending}
          busy={reader.selectionBusy}
        />
      )}
      <ReaderChatNotification key={userId + ":" + book.id} chat={reader.chat} visible={reader.panel === "chat"} onOpen={key => {
        void reader.chat.open(key); if (reader.panel !== "chat") reader.togglePanel("chat");
      }} />
      <ReaderReadingTarget reader={reader} />
      <ReaderToolbar pageNavigation={reader.pageNavigation}
        sentenceMode={reader.sentenceMode}
        rsvp={reader.rsvp}
        book={book}
        panel={reader.panel}
        togglePanel={reader.togglePanel}
        loading={reader.loading || reader.readingTarget.selecting}
        error={reader.error}
        mobile={reader.mobile}
        fullscreen={reader.fullscreen}
        toggleFullscreen={reader.toggleFullscreen}
        reload={reader.reload}
      />
      <div className={"reader-workspace" + (reader.rsvp.active || reader.sentenceMode.active ? " is-rsvp" : "")}>
        {reader.sentenceMode.active && <ReaderSentenceMode reader={reader} bookId={book.id} />}
        {reader.rsvp.active && <ReaderRsvp reader={reader} bookId={book.id} />}
        <ReaderAudiobookHost key={book.id} open={reader.panel === "tts"} bookId={book.id} source={reader.audiobook}
          onMinimize={reader.closePanel} onOpen={() => { if (reader.panel !== "tts") reader.togglePanel("tts"); }}
          onExit={cfi => { if (cfi) reader.onNavigate(cfi); else reader.closePanel(); }}
          onFollow={cfi => void reader.onAnnotationNavigate(cfi)} />
        {!reader.rsvp.active && <ReaderPanels
          progressSettings={reader.progressSettings}
          updateProgressSettings={reader.updateProgressSettings}
          progressSaveStatus={reader.progressSaveStatus}
          retryProgressSettings={reader.retryProgressSettings}
          keyboardSettings={reader.keyboardSettings}
          updateKeyboardSettings={reader.updateKeyboardSettings}
          keyboardSaveStatus={reader.keyboardSaveStatus}
          retryKeyboardSettings={reader.retryKeyboardSettings}
          review={reader.review}
          annotations={reader.annotations}
          describeLocation={reader.describeLocation}
          totalPages={reader.totalPages}
          panel={reader.panel}
          closePanel={reader.closePanel}
          toc={reader.toc}
          href={reader.href}
          onNavigate={reader.onNavigate}
          onAnnotationNavigate={reader.onAnnotationNavigate}
          onPassageNavigate={reader.onPassageNavigate}
          loading={reader.loading}
          searchBook={reader.searchBook}
          locationsReady={reader.locationsReady}
          onSearchNavigate={reader.onSearchNavigate}
          chat={reader.chat}
          state={reader.state}
          updateState={reader.updateState}
          publisherPagesAvailable={reader.publisherPagesAvailable}
          bookId={book.id}
          userId={userId}
        />}
        <ReaderViewport rsvpActive={reader.rsvp.active || reader.sentenceMode.active}
          width={reader.state.preferences.width}
          loading={reader.loading}
          error={reader.error}
          retry={reader.retry}
          move={reader.move}
          atStart={reader.atStart}
          atEnd={reader.atEnd}
          host={reader.host}
        />
      </div>
      <ReaderNotices
        mobile={reader.mobile}
        saveStatus={reader.saveStatus}
        retrySave={reader.retrySave}
        notice={reader.notice}
      />
      {!reader.rsvp.active && !reader.sentenceMode.active && <ReaderFooter
        defaultProgressDisplay={reader.progressSettings.defaultProgressDisplay}
        remainingSectionPages={reader.remainingSectionPages}
        remainingBookPages={reader.remainingBookPages}
        state={reader.state}
        locationsReady={reader.locationsReady}
        loading={reader.loading}
        onProgressNavigate={reader.onProgressNavigate}
        getProgressDestination={reader.getProgressDestination}
        returnPoint={reader.returnPoint}
        goBack={reader.goBack}
        move={reader.move}
        atStart={reader.atStart}
        atEnd={reader.atEnd}
        chapter={reader.chapter}
        showPublisherPages={reader.showPublisherPages}
        pageLabel={reader.pageLabel}
        togglePageNumbering={reader.togglePageNumbering}
        saveStatus={reader.saveStatus}
        retrySave={reader.retrySave}
      />}
    </div>
    </ReaderPassageMarks.Provider>
  );
}
