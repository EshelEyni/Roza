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
  useEffect(() => {
    if (reader.loading || !reader.flags.ready) return;
    const flag = reader.flags.items.find(f => f.id === params.get("flag"));
    const location = flag?.cfi || params.get("location");
    if (!location || destination.current === params.toString()) return;
    destination.current = params.toString();
    if (flag) {
      void reader.onPassageNavigate(flag);
      if (params.get("action") === "ai" && flag.text.length <= readerAiLimits.passage) { reader.chat.start(flag); reader.togglePanel("chat"); }
    } else if (location.startsWith("epubcfi(")) reader.onNavigate(location);
  }, [reader, params]);
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
      {reader.textSelection && !reader.textSelection.suppressTooltip && (
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
      <ReaderToolbar
        sentenceMode={reader.sentenceMode}
        rsvp={reader.rsvp}
        book={book}
        panel={reader.panel}
        togglePanel={reader.togglePanel}
        loading={reader.loading}
        error={reader.error}
        mobile={reader.mobile}
        fullscreen={reader.fullscreen}
        toggleFullscreen={reader.toggleFullscreen}
        reload={reader.reload}
      />
      <div className={"reader-workspace" + (reader.rsvp.active || reader.sentenceMode.active ? " is-rsvp" : "")}>
        {reader.sentenceMode.active && <ReaderSentenceMode reader={reader} bookId={book.id} />}
        {reader.rsvp.active && <ReaderRsvp reader={reader} bookId={book.id} />}
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
          onPassageNavigate={reader.onPassageNavigate}
          loading={reader.loading}
          searchBook={reader.searchBook}
          locationsReady={reader.locationsReady}
          onSearchNavigate={reader.onSearchNavigate}
          chat={reader.chat}
          state={reader.state}
          updateState={reader.updateState}
          publisherPagesAvailable={reader.publisherPagesAvailable}
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
