import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import type { useReaderChat } from "../../hooks/useReaderChat";

type Chat = ReturnType<typeof useReaderChat>;
export function ReaderChatHistory({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null;
    const inert: Array<[HTMLElement, boolean]> = [];
    let branch: HTMLElement | null = dialog.current?.parentElement || null;
    while (branch && branch !== document.body) {
      for (const sibling of Array.from(branch.parentElement?.children || [])) {
        if (sibling !== branch && sibling instanceof HTMLElement) { inert.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      branch = branch.parentElement;
    }
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { inert.forEach(([element, value]) => { element.inert = value; }); if (original?.isConnected) original.focus({ preventScroll: true }); };
  }, []);
  const tabs = Object.values(chat.workspace.tabs);
  const local = tabs.filter(tab => chat.workspace.openKeys.includes(tab.key) || tab.draft || tab.pending || (!tab.serverId && tab.passage))
    .map(tab => ({ id: tab.serverId || tab.key, title: tab.title || t("reader.chat.new"), updatedAt: tab.updatedAt, tab }));
  const items = [...local, ...chat.items.filter(item => !local.some(row => row.id === item.id))
    .map(item => ({ ...item, tab: tabs.find(tab => tab.serverId === item.id) }))]
    .filter(item => item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="reader-chat-history-overlay" onClick={event => {
    if (event.target === event.currentTarget) chat.setHistory(false);
  }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="reader-chat-history-title" className="reader-chat-history-drawer"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); chat.setHistory(false); }
        if (event.key === "Tab") {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') || []);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="reader-chat-history-heading"><h3 id="reader-chat-history-title">{t("reader.chat.tabs.all")}</h3>
        <button type="button" ref={close} className="reader-icon-button" aria-label={t("reader.chat.tabs.closeList")}
          onClick={() => chat.setHistory(false)}><FiX /></button></div>
      <p className="reader-chat-history-help">{t("reader.chat.tabs.historyHint")}</p>
      <label className="reader-chat-history-search"><FiSearch aria-hidden="true" /><input value={search}
        aria-label={t("reader.chat.tabs.search")} placeholder={t("reader.chat.tabs.search")}
        onChange={event => setSearch(event.target.value)} /></label>
      <div className="reader-chat-history">
        {chat.workspace.historyError && <div role="alert" className="reader-chat-error">{chat.workspace.historyError}
          <button type="button" className="reader-button" onClick={() => void chat.loadHistory()}>{t("reader.retry")}</button></div>}
        {chat.workspace.historyLoading && <p role="status">{t("reader.chat.loading")}</p>}
        {!chat.workspace.historyLoading && !items.length && <p>{t(search ? "reader.chat.tabs.noResults" : "reader.chat.noSaved")}</p>}
        {[true, false].map(open => {
          const rows = items.filter(item => !!(item.tab && chat.workspace.openKeys.includes(item.tab.key)) === open);
          return rows.length ? <div key={String(open)} className="reader-chat-history-group"><h4>{t(open ? "reader.chat.tabs.openNow" : "reader.chat.tabs.other")}</h4>
            {rows.map(item => <div className="reader-chat-history-item" key={item.id}>
              <button type="button" onClick={() => void chat.open(item.id)}><strong dir="auto">{item.title}</strong>
                <span className="reader-chat-history-meta">{item.tab?.sending ? t("reader.chat.tabs.generating") : item.tab?.unread ? t("reader.chat.tabs.unread")
                  : open ? t("reader.chat.tabs.alreadyOpen") : t("reader.chat.tabs.openTab")}
                  {item.tab?.draft && <span> · {t("reader.chat.tabs.draft")}</span>}</span></button>
              {deleteId === item.id ? <div className="reader-chat-delete-confirm"><span>{t("reader.chat.deleteConfirm")}</span>
                <button className="reader-button" disabled={chat.workspace.removing.includes(item.id)}
                  onClick={() => { void chat.remove(item.id); setDeleteId(""); }}>{t("reader.chat.delete")}</button>
                <button className="reader-button" onClick={() => setDeleteId("")}>{t("reader.chat.cancel")}</button></div>
                : <button type="button" className="reader-icon-button" disabled={item.tab?.sending || chat.workspace.removing.includes(item.id)}
                  aria-label={t("reader.chat.delete") + ": " + item.title} onClick={() => setDeleteId(item.id)}><FiTrash2 /></button>}
            </div>)}
          </div> : null;
        })}
        {chat.cursor && <button className="reader-button" disabled={chat.workspace.historyLoading}
          onClick={() => void chat.loadHistory(chat.cursor!)}>{t("reader.chat.more")}</button>}
      </div>
      <button type="button" className="reader-button" onClick={() => chat.start()}><FiPlus />{t("reader.chat.new")}</button>
    </div>
  </div>;
}
