import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpubCFI } from "epubjs";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import { useEpubReader } from "../../frontend/src/hooks/reader/useEpubReader";
import { ReaderToolbar } from "../../frontend/src/components/Reader/ReaderToolbar";
import { ReaderPanels } from "../../frontend/src/components/Reader/ReaderPanels";
import { ReaderSentenceMode } from "../../frontend/src/components/Reader/ReaderSentenceMode";
import { ReaderViewport } from "../../frontend/src/components/Reader/ReaderViewport";
import { ReaderDictionary } from "../../frontend/src/components/Reader/ReaderDictionary";
import { extractReaderSentences } from "../../frontend/src/services/readerSentences";
import "../../frontend/src/styles/app/_reader.scss";
await i18next
  .use(initReactI18next)
  .init({ lng: "en", resources: { en: { translation: en } } });
const book = {
  id: "sentence-navigation",
  title: "Sentence navigation",
  author: "Fixture",
  cover: "",
  filename: "navigation.epub",
  size: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  state: {
    location: "",
    progress: 0,
    savedAt: 0,
    preferences: {
      fontSize: 20,
      fontFamily: "serif" as const,
      lineHeight: 1.7,
      width: "comfortable" as const,
      theme: "sepia" as const,
      flow: "paginated" as const,
    },
  },
};
function Fixture() {
  const reader = useEpubReader(book, "sentence-navigation-fixture");
  useEffect(() => {
    const rendition = () => reader.searchBook?.rendition;
    const sourceCfi = async (chapter: number, index: number) => {
      const section = reader.searchBook!.spine.get(chapter);
      await section.load(reader.searchBook!.load.bind(reader.searchBook));
      return extractReaderSentences(section)[index].cfi;
    };
    const visible = (cfi: string, whole = false) => {
      const host = reader.host.current?.getBoundingClientRect();
      if (!host) return false;
      const pages = (rendition()?.getContents() ||
        []) as unknown as import("epubjs").Contents[];
      for (const contents of pages) {
        if (contents.sectionIndex !== new EpubCFI(cfi).spinePos) continue;
        try {
          const range = contents.range(cfi);
          if (!whole) range.collapse(true);
          if (
            !whole &&
            range.startContainer.nodeType === 3 &&
            range.startOffset < (range.startContainer.textContent?.length || 0)
          )
            range.setEnd(range.startContainer, range.startOffset + 1);
          const frame =
            contents.document.defaultView?.frameElement?.getBoundingClientRect();
          if (!frame) continue;
          if (
            Array.from(range.getClientRects()).some(
              rect =>
                rect.height > 0 &&
                frame.left + rect.left >= host.left - 1 &&
                frame.left + rect.left < host.right - 1 &&
                frame.top + rect.top >= host.top - 1 &&
                frame.top + rect.top < host.bottom,
            )
          )
            return true;
        } catch {
          /* A different spine document cannot resolve this range. */
        }
      }
      return false;
    };
    const selectCfi = (cfi: string) => {
      const contents = (
        rendition()?.getContents() as unknown as import("epubjs").Contents[]
      ).find(content => content.sectionIndex === new EpubCFI(cfi).spinePos)!;
      const range = contents.range(cfi);
      range.collapse(true);
      range.setEnd(
        range.startContainer,
        Math.min(
          range.startOffset + 8,
          range.startContainer.textContent!.length,
        ),
      );
      const native = contents.document.getSelection()!;
      native.removeAllRanges();
      native.addRange(range);
      contents.document.dispatchEvent(new Event("selectionchange"));
      contents.document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true }),
      );
      contents.document.defaultView?.focus();
      return range.toString();
    };
    Object.assign(window, {
      sentenceNavigationTest: {
        reader,
        EpubCFI,
        extractReaderSentences,
        sourceCfi,
        visible,
        selectCfi,
        rendition,
      },
    });
  }, [reader]);
  return (
    <div className="reader-shell reader-theme-sepia" ref={reader.shell}>
      <ReaderToolbar pageNavigation={reader.pageNavigation}
        book={book}
        sentenceMode={reader.sentenceMode}
        rsvp={reader.rsvp}
        panel={reader.panel}
        togglePanel={reader.togglePanel}
        loading={reader.loading}
        error={reader.error}
        mobile={reader.mobile}
        fullscreen={reader.fullscreen}
        toggleFullscreen={reader.toggleFullscreen}
        reload={reader.reload}
      />
      {reader.textSelection &&
        !reader.sentenceMode.active &&
        !reader.textSelection.suppressTooltip && (
          <ReaderDictionary
            selection={reader.textSelection}
            bookId={book.id}
            getLookupPage={reader.getLookupPage}
            onClose={reader.closeLookup}
            onAskAi={reader.askAi}
            extending={reader.selectionExtending}
            busy={reader.selectionBusy}
            onFlag={() => undefined}
            onAnnotate={() => undefined}
            pageTurn={{
              move: direction => { reader.closeLookup(); window.setTimeout(() => reader.move(direction)); },
              atStart: reader.atStart, atEnd: reader.atEnd, disabled: reader.loading,
            }}
          />
        )}
      <div
        className={
          "reader-workspace" + (reader.sentenceMode.active ? " is-rsvp" : "")
        }
      >
        <ReaderPanels {...reader} />
        {reader.sentenceMode.active && (
          <ReaderSentenceMode reader={reader} bookId={book.id} />
        )}
        <ReaderViewport
          rsvpActive={reader.sentenceMode.active}
          width="comfortable"
          loading={reader.loading}
          error={reader.error}
          retry={reader.retry}
          move={reader.move}
          atStart={reader.atStart}
          atEnd={reader.atEnd}
          host={reader.host}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <Fixture />
    </MemoryRouter>
  </QueryClientProvider>,
);
