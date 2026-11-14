import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import { ReaderFooter } from "../../frontend/src/components/Reader/ReaderFooter";
import { ReaderSheet } from "../../frontend/src/components/Reader/ReaderSheet";
import { ReaderSettings } from "../../frontend/src/components/Reader/ReaderSettings";
import { useReaderProgressSettings } from "../../frontend/src/hooks/reader/useReaderProgressSettings";
import "../../frontend/src/styles/app/_reader.scss";
await i18next.use(initReactI18next).init({lng:"en",resources:{en:{translation:en}}});
const preferences = {fontSize:20,fontFamily:"serif",lineHeight:1.8,width:"comfortable",theme:"sepia",flow:"paginated"} as const;
function Reader({book}:{book:string}) {
 const settings=useReaderProgressSettings("test-user");
 const [opened,setOpened]=useState(true);
 return <div className="reader-shell reader-theme-sepia"><h1>{book}</h1><button onClick={()=>setOpened(true)}>Open settings</button><div className="reader-workspace">{opened && <ReaderSheet label="Settings" onClose={()=>setOpened(false)}><ReaderSettings preferences={preferences} onChange={()=>{}} publisherPagesAvailable={false}
 progressSettings={settings.progressSettings} onProgressChange={settings.updateProgressSettings} progressSaveStatus={settings.progressSaveStatus} onProgressRetry={settings.retryProgressSettings}/></ReaderSheet>}</div>
 <ReaderFooter defaultProgressDisplay={settings.progressSettings.defaultProgressDisplay} state={{preferences,location:"",progress:.42,savedAt:0}}
 remainingSectionPages={7} remainingBookPages={90} locationsReady={true} loading={false} onProgressNavigate={()=>{}} move={()=>{}}
 atStart={false} atEnd={false} chapter="Chapter" showPublisherPages={false} pageLabel="1 / 100" togglePageNumbering={()=>{}} saveStatus="saved" retrySave={async()=>{}}/></div>;
}
function Fixture(){const [book,setBook]=useState("Book A");return <><button onClick={()=>setBook(b=>b==="Book A"?"Book B":"Book A")}>Switch book</button><Reader key={book} book={book}/></>}
createRoot(document.getElementById("root")!).render(<Fixture/>);
