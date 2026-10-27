// Real chat component and styles, deterministic view-only data, no API calls.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import { ReaderChat } from "../../frontend/src/components/Reader/ReaderChat";
import type { ReaderChatView } from "../../frontend/src/hooks/useReaderChat";
import type { ReaderConversation, ReaderPassage } from "../../shared/types/readerChat";
import "../../frontend/src/styles/app/_reader.scss";

await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation: en } } });
const text = "I wended my way, when the footman in breeches and hose had conveyed to me the injunction that Madame wished to speak to me, along a winding corridor that was remotely perfumed by the precious essences wafting the constant current of their sweet scents all the way from her dressing-room.";
const original: ReaderPassage = { cfi: "original-cfi", text };
function Fixture() {
  const [scenario, setScenario] = useState("draft");
  const [draft, setDraft] = useState("");
  const [sentQuestion, setSentQuestion] = useState("");
  const [spoilersAllowed, setSpoilersAllowed] = useState(false);
  const passage = scenario === "word" ? { cfi: "word-cfi", text: "screed" }
    : scenario === "long" ? { ...original, text: Array(25).fill(text).join("\n\n") } : original;
  const first = { id: "first", question: scenario === "question" ? "מה פירוש המשפט הזה?"
    : scenario === "legacy" ? passage.text : scenario === "sent" ? sentQuestion : "",
    answer: "המספר מתאר את דרכו אל מאדאם, לאורך מסדרון שבו מורגש הבושם מחדר ההלבשה שלה.",
    passage: scenario === "legacy" ? undefined : passage,
    status: "completed" as const, createdAt: "2026-10-27" };
  const conversation: ReaderConversation | null = scenario === "draft" || scenario === "pending" ? null : {
    id: "chat-" + scenario, title: "Fixture", passage, spoilersAllowed: false,
    createdAt: "2026-10-27", updatedAt: "2026-10-27",
    turns: scenario === "followup" ? [first, { ...first, id: "second", question: "ולמה הוא מדגיש את זה?", answer: "זהו פרט חושי שממחיש את האווירה בבית." }] : [first],
  };
  useEffect(() => {
    Object.assign(window, { quoteTest: {
      setScenario: (value: string) => { setDraft(""); setScenario(value); },
      snapshot: () => JSON.stringify(conversation),
    } });
  }, [conversation]);
  const chat = {
    activeTabKey: "fixture", activeTab: undefined, unavailable: false, errorKey: undefined,
    workspace: { tabs: {}, openKeys: [], activeKey: "fixture", items: [], cursor: null,
      history: false, historyLoading: false, historyError: "", removing: [], lastClosed: null, storageWarning: false, panelWidth: 480, groups: [{ id: "group-main", keys: ["fixture"], activeKey: "fixture" }], focusedGroupId: "group-main", groupRatio: .5 },
    selectTab: () => {}, closeTab: () => {}, reopenTab: () => {}, retryLoad: () => {}, rememberScroll: () => {},
    flush: () => {}, setViewing: () => {}, setPanelWidth: () => {},
    conversation, draft, setDraft, passage, items: [], cursor: null,
    loading: false, sending: scenario === "pending", draftVersion: "fixture", history: false, error: "",
    spoilersAllowed, setSpoilersAllowed,
    pending: scenario === "pending" ? { id: "optimistic", question: "", passage, currentCfi: passage.cfi, spoilersAllowed: false } : null,
    setHistory: () => {}, start: () => setScenario("draft"), attach: () => {},
    open: async () => {}, remove: async () => {}, loadHistory: async () => {},
    send: (question: string) => { setSentQuestion(question); setScenario("sent"); return true; },
  } satisfies ReaderChatView;
  return <div className="reader-shell reader-theme-sepia"><div className="reader-panel reader-chat-panel">
    <ReaderChat chat={chat} onClose={() => {}} />
  </div></div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
