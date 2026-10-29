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
  return (
    <div
      className={"reader-shell reader-theme-" + reader.state.preferences.theme}
      ref={reader.shell}
    >
      {reader.textSelection && (
        <ReaderDictionary
          key={reader.textSelection.cfi}
          selection={reader.textSelection}
          bookId={book.id}
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
        state={reader.state}
        locationsReady={reader.locationsReady}
        loading={reader.loading}
        onProgressNavigate={reader.onProgressNavigate}
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
  );
}
