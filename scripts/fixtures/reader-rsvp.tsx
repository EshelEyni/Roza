import { ReaderSentenceMode } from "../../frontend/src/components/Reader/ReaderSentenceMode";
import { ReaderPanels } from "../../frontend/src/components/Reader/ReaderPanels";
import * as sentenceService from "../../frontend/src/services/readerSentences";
import { MemoryRouter } from "react-router-dom";
import { ReaderToolbar } from "../../frontend/src/components/Reader/ReaderToolbar";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import { useEpubReader } from "../../frontend/src/hooks/reader/useEpubReader";
import { ReaderViewport } from "../../frontend/src/components/Reader/ReaderViewport";
import { ReaderRsvp } from "../../frontend/src/components/Reader/ReaderRsvp";
import * as service from "../../frontend/src/services/readerRsvp";
import "../../frontend/src/styles/app/_reader.scss";
await i18next
  .use(initReactI18next)
  .init({ lng: "en", resources: { en: { translation: en } } });
const book = {
  id: "rsvp",
  title: "RSVP",
  author: "Fixture",
  cover: "",
  filename: "rsvp.epub",
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
const saved = await fetch("/rsvp-state").then((response) => response.json());
if (saved) book.state = saved;
function Fixture() {
  const reader = useEpubReader(book, "fixture");
  useEffect(() => {
    Object.assign(window, { rsvpTest: { reader, service, sentenceService } });
  }, [reader]);
  return (
    <div className="reader-shell reader-theme-sepia" ref={reader.shell}>
      <ReaderToolbar
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
      <div
        className={"reader-workspace" + (reader.rsvp.active || reader.sentenceMode.active ? " is-rsvp" : "")}
      >
        <ReaderPanels {...reader} />
        {reader.sentenceMode.active && <ReaderSentenceMode reader={reader} bookId="rsvp" />}
        {reader.rsvp.active && <ReaderRsvp reader={reader} bookId="rsvp" />}
        <ReaderViewport
          rsvpActive={reader.rsvp.active || reader.sentenceMode.active}
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
  <MemoryRouter>
    <Fixture />
  </MemoryRouter>,
);
