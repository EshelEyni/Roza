import { useEffect, useState } from "react";
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
      {copyToast && <div key={copyToast.id} className="reader-copy-toast" role="status" aria-live="polite">{copyToast.message}</div>}
      {reader.textSelection && !reader.textSelection.suppressTooltip && (
        <ReaderDictionary
          key={reader.textSelection.cfi}
          selection={reader.textSelection}
          onCopyFeedback={message => setCopyToast(current => ({ message, id: (current?.id || 0) + 1 }))}
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
          onExtend={reader.extendSelection}
          extending={reader.selectionExtending}
          busy={reader.selectionBusy}
          atStart={reader.atStart}
          atEnd={reader.atEnd}
        />
      )}
      <ReaderToolbar
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
      <div className="reader-workspace">
        <ReaderPanels
          keyboardSettings={reader.keyboardSettings}
          updateKeyboardSettings={reader.updateKeyboardSettings}
          keyboardSaveStatus={reader.keyboardSaveStatus}
          retryKeyboardSettings={reader.retryKeyboardSettings}
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
        />
        <ReaderViewport
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
      <ReaderFooter
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
      />
    </div>
    </ReaderPassageMarks.Provider>
  );
}
