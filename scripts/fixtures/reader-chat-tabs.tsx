import type { Book } from "epubjs";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import he from "../../frontend/public/locales/he/translation.json";
import { ReaderPanels } from "../../frontend/src/components/Reader/ReaderPanels";
import type { ReaderPanel } from "../../frontend/src/types/reader";
import type { ReaderState } from "../../shared/types/reader";
import { useReaderChat } from "../../frontend/src/hooks/useReaderChat";
import "../../frontend/src/styles/app/_reader.scss";
const rtl = new URLSearchParams(location.search).get("lang") === "he";
await i18next.use(initReactI18next).init({ lng: rtl ? "he" : "en", resources: { en: { translation: en }, he: { translation: he } } });
document.documentElement.dir = rtl ? "rtl" : "ltr";
const fixtureSection = { url: "fixture-chapter", href: "chapter3", cfiFromRange: () => "epubcfi(/6/2!/4/2/1:0)" };
const fixtureSearchBook = { spine: { each: (visit: (section: typeof fixtureSection) => void) => visit(fixtureSection) },
  navigation: { toc: [{ href: "chapter3", label: "Chapter three", subitems: [] }] },
  load: async () => new DOMParser().parseFromString("<html><body><p>The house keeps memories. A house can feel like home.</p></body></html>", "text/html"),
  pageList: { pageFromCfi: () => -1 } } as unknown as Book;
function Fixture() {
  const chat = useReaderChat("fixture-book", () => "current-reading-cfi", "fixture-user");
  const [opened, setOpened] = useState(true);
  const [dark, setDark] = useState(false);
  const [panel, setPanel] = useState<ReaderPanel>("chat");
  const [readerState, setReaderState] = useState<ReaderState>({ location: "current-reading-cfi", progress: .38, savedAt: 0,
    preferences: { fontSize: 20, fontFamily: "serif", lineHeight: 1.8, width: "comfortable", theme: "sepia", flow: "paginated" } });
  const closePanel = useCallback(() => setOpened(false), []);
  useEffect(() => {
    Object.assign(window, { tabTest: { snapshot: () => chat.workspace } });
  }, [chat.workspace]);
  return <div className={"reader-shell reader-theme-" + (dark ? "dark" : "sepia")}>
    <header className="reader-toolbar"><div className="reader-toolbar-title"><h1>{rtl ? "בין השורות" : "Between the lines"}</h1><p>{rtl ? "פרק שלישי · סביבת בדיקה מקומית" : "Chapter three · Local test fixture"}</p></div>
      <button className="reader-button" onClick={() => setDark(value => !value)}>Theme</button>
      <button className="reader-button" onClick={() => setOpened(value => !value)}>Toggle chat</button>
      <select aria-label="Panel" value={panel} onChange={event => { setPanel(event.target.value as ReaderPanel); setOpened(true); }}>
        <option value="chat">Chat</option><option value="contents">Contents</option><option value="search">Search</option><option value="settings">Settings</option>
      </select></header>
    <main className="reader-workspace">
      <ReaderPanels panel={opened ? panel : null} closePanel={closePanel}
        toc={[{ id: "chapter3", href: "chapter3", label: rtl ? "פרק שלישי" : "Chapter three", subitems: [] }]}
        href="chapter3" onNavigate={() => {}} loading={false} searchBook={fixtureSearchBook} locationsReady={false}
        onSearchNavigate={async () => {}} chat={chat} state={readerState}
        updateState={changes => setReaderState(previous => ({ ...previous, ...changes }))} publisherPagesAvailable={false} />
      <article className="reader-paper"><div /><div style={{ padding: "50px 28px", font: "21px/1.9 Georgia,serif" }}>
        <h2 style={{ font: "32px Georgia,serif", marginBottom: 30 }}>{rtl ? "הדברים שנשארים" : "The things that remain"}</h2>
        <p>{rtl ? "בכל בוקר היה פותח את החלון לפני שפתח את המכתבים. הוא אמר שאוויר חדש צריך להיכנס לפני חדשות ישנות." : "Every morning he opened the window before he opened the letters. He said fresh air should arrive before old news."}</p>
        <p style={{ marginTop: 25 }}>{rtl ? "היא הביטה אל הרחוב, ופתאום נדמה היה לה שהבית אינו המקום שבו שמרה את הדברים, אלא המקום שבו הדברים שמרו עליה." : "She looked out at the street, and suddenly the house seemed less a place where she kept her things than a place where those things kept her safe."}</p>
      </div></article>
    </main>
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>);
