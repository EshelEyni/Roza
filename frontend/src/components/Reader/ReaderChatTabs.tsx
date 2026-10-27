import { useEffect, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiX, FiMessageSquare, FiLoader, FiEdit3 } from "react-icons/fi";
import type { ReaderChatView } from "../../hooks/useReaderChat";

type Chat = ReaderChatView;
export function ReaderChatTabs({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [chat.activeTabKey]);
  function onKey(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const keys = chat.workspace.openKeys;
    const index = keys.indexOf(key);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + (rtl ? -1 : 1) + keys.length) % keys.length;
    if (event.key === "ArrowLeft") next = (index + (rtl ? 1 : -1) + keys.length) % keys.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = keys.length - 1;
    if (event.key === "Delete") {
      event.preventDefault(); chat.closeTab(key);
      requestAnimationFrame(() => (list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ||
        list.current?.parentElement?.querySelector<HTMLButtonElement>(".reader-chat-new-tab"))?.focus());
    }
    if (next !== undefined) {
      event.preventDefault(); chat.selectTab(keys[next]);
      list.current?.querySelector<HTMLButtonElement>(`#${keys[next]}`)?.focus();
    }
  }
  return <div className="reader-chat-tabbar">
    <div ref={list} role="tablist" aria-label={t("reader.chat.tabs.label")} className="reader-chat-tabs">
      {chat.workspace.openKeys.map(key => {
        const tab = chat.workspace.tabs[key];
        const title = tab.title || t("reader.chat.new");
        const status = tab.sending ? t("reader.chat.tabs.generating") : tab.unread ? t("reader.chat.tabs.unread")
          : tab.error || tab.errorKey || tab.unavailable ? t("reader.chat.tabs.error") : tab.draft ? t("reader.chat.tabs.draft") : "";
        return <div key={key} className={"reader-chat-tab" + (key === chat.activeTabKey ? " is-active" : "")}>
          <button id={key} type="button" role="tab" aria-selected={key === chat.activeTabKey}
            aria-controls="reader-chat-tabpanel" tabIndex={key === chat.activeTabKey ? 0 : -1}
            title={title + (status ? " · " + status : "")} aria-label={title + (status ? " · " + status : "")}
            onKeyDown={event => onKey(event, key)} onClick={() => chat.selectTab(key)}>
            {tab.sending ? <FiLoader className="reader-chat-tab-busy" aria-hidden="true" />
              : tab.unread ? <span className="reader-chat-tab-unread" aria-hidden="true">●</span>
              : tab.error || tab.errorKey || tab.unavailable ? <span aria-hidden="true">!</span>
              : tab.draft ? <FiEdit3 aria-hidden="true" /> : <FiMessageSquare aria-hidden="true" />}
            <span dir="auto">{title}</span>
          </button>
          <button className="reader-chat-tab-close" type="button" aria-label={t("reader.chat.tabs.close", { title })}
            title={t("reader.chat.tabs.close", { title })} onClick={() => {
              chat.closeTab(key);
              requestAnimationFrame(() => (list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ||
                list.current?.parentElement?.querySelector<HTMLButtonElement>(".reader-chat-new-tab"))?.focus());
            }}><FiX /></button>
        </div>;
      })}
    </div>
    <button type="button" className="reader-icon-button reader-chat-new-tab" aria-label={t("reader.chat.new")}
      title={t("reader.chat.new")} onClick={() => chat.start()}><FiPlus /></button>
  </div>;
}
