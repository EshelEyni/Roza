import React,{useEffect} from "react";
import {createRoot} from "react-dom/client";
import i18next from "i18next";
import {initReactI18next} from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import type {ReaderBook} from "../../shared/types/reader";
import {useEpubReader} from "../../frontend/src/hooks/reader/useEpubReader";
import {ReaderFooter} from "../../frontend/src/components/Reader/ReaderFooter";
import {ReaderViewport} from "../../frontend/src/components/Reader/ReaderViewport";
import "../../frontend/src/styles/app/_reader.scss";
await i18next.use(initReactI18next).init({lng:'en',resources:{en:{translation:en}}});
const book:ReaderBook={id:'navigation',title:'Navigation',author:'Fixture',cover:'',filename:'navigation.epub',size:1000,createdAt:'2026-11-02',updatedAt:'2026-11-02',state:{location:'',progress:0,savedAt:0,preferences:{fontSize:20,fontFamily:'serif',lineHeight:1.7,width:'comfortable',theme:'sepia',flow:'paginated'}}};
function Fixture(){
 const reader=useEpubReader(book,'fixture');
 useEffect(()=>{Object.assign(window,{navigationTest:{reader}})},[reader]);
 return <div className="reader-shell reader-theme-sepia" ref={reader.shell}>
 <div className="reader-workspace"><ReaderViewport width="comfortable" loading={reader.loading} error={reader.error} retry={reader.retry} move={reader.move} atStart={reader.atStart} atEnd={reader.atEnd} host={reader.host}/></div>
 <ReaderFooter remainingSectionPages={reader.remainingSectionPages} remainingBookPages={reader.remainingBookPages} state={reader.state} locationsReady={reader.locationsReady} loading={reader.loading} onProgressNavigate={reader.onProgressNavigate} getProgressDestination={reader.getProgressDestination} returnPoint={reader.returnPoint} goBack={reader.goBack} move={reader.move} atStart={reader.atStart} atEnd={reader.atEnd} chapter={reader.chapter} showPublisherPages={reader.showPublisherPages} pageLabel={reader.pageLabel} togglePageNumbering={reader.togglePageNumbering} saveStatus={reader.saveStatus} retrySave={reader.retrySave}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
