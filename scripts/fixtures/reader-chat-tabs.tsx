import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import he from "../../frontend/public/locales/he/translation.json";
import { ReaderChat } from "../../frontend/src/components/Reader/ReaderChat";
import { ReaderSheet } from "../../frontend/src/components/Reader/ReaderSheet";
import { useReaderChat } from "../../frontend/src/hooks/useReaderChat";
import "../../frontend/src/styles/app/_reader.scss";
const rtl = new URLSearchParams(location.search).get("lang") === "he";
await i18next.use(initReactI18next).init({ lng: rtl ? "he" : "en", resources: { en: { translation: en }, he: { translation: he } } });
document.documentElement.dir = rtl ? "rtl" : "ltr";
function Fixture() {
  const chat = useReaderChat("fixture-book", () => "current-reading-cfi", "fixture-user");
  const [opened, setOpened] = useState(true);
  const [dark, setDark] = useState(false);
  const closePanel = useCallback(() => setOpened(false), []);
  useEffect(() => {
    Object.assign(window, { tabTest: { snapshot: () => chat.workspace } });
  }, [chat.workspace]);
  return <div className={"reader-shell reader-theme-" + (dark ? "dark" : "sepia")}>
    <header className="reader-toolbar"><div className="reader-toolbar-title"><h1>{rtl ? "בין השורות" : "Between the lines"}</h1><p>{rtl ? "פרק שלישי · סביבת בדיקה מקומית" : "Chapter three · Local test fixture"}</p></div>
      <button className="reader-button" onClick={() => setDark(value => !value)}>Theme</button>
      <button className="reader-button" onClick={() => setOpened(value => !value)}>Toggle chat</button></header>
    <main className="reader-workspace">
      {opened && <ReaderSheet label="Chat" className="reader-chat-panel" mobileFullscreen mobileCloseInContent onClose={closePanel}>
        <ReaderChat chat={chat} onClose={closePanel} />
      </ReaderSheet>}
      <article className="reader-paper"><div /><div style={{ padding: "50px 28px", font: "21px/1.9 Georgia,serif" }}>
        <h2 style={{ font: "32px Georgia,serif", marginBottom: 30 }}>{rtl ? "הדברים שנשארים" : "The things that remain"}</h2>
        <p>{rtl ? "בכל בוקר היה פותח את החלון לפני שפתח את המכתבים. הוא אמר שאוויר חדש צריך להיכנס לפני חדשות ישנות." : "Every morning he opened the window before he opened the letters. He said fresh air should arrive before old news."}</p>
        <p style={{ marginTop: 25 }}>{rtl ? "היא הביטה אל הרחוב, ופתאום נדמה היה לה שהבית אינו המקום שבו שמרה את הדברים, אלא המקום שבו הדברים שמרו עליה." : "She looked out at the street, and suddenly the house seemed less a place where she kept her things than a place where those things kept her safe."}</p>
      </div></article>
    </main>
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>);
