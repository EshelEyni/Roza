import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiColumns, FiMessageSquare, FiPlus, FiX, FiSettings, FiArrowLeft, FiArrowRight, FiList, FiLoader, FiEdit3 } from "react-icons/fi";
import type { useReaderChat } from "../../hooks/useReaderChat";
import { ReaderPanelResize } from "./ReaderPanelResize";
import { ReaderChat } from "./ReaderChat";
import { ReaderChatHistory } from "./ReaderChatHistory";
import { ReaderAiSettings } from "./ReaderAiSettings";

import type { ReaderPassage } from "../../../../shared/types/readerChat";

type Chat = ReturnType<typeof useReaderChat>;
type Props = {
  chat: Chat; onClose: () => void; onPassageNavigate?: (passage: ReaderPassage) => void;
};
export function ReaderWorkspace({ chat, onClose, onPassageNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const { groups, focusedGroupId, groupRatio, panelWidth } = chat.workspace;
  const split = groups.length === 2;
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const draggedKey = useRef("");
  const [available, setAvailable] = useState(712);
  const [aiSettings, setAiSettings] = useState(false);
  const [dropGroup, setDropGroup] = useState<string | null>(null);
  const { setPanelWidth, setGroupRatio } = chat;
  useLayoutEffect(() => {
    const measure = () => setAvailable(Math.max(1, (grid.current?.clientWidth || 720) - 8));
    measure();
    const observer = new ResizeObserver(measure);
    if (grid.current) observer.observe(grid.current);
    return () => observer.disconnect();
  }, [split]);
  useEffect(() => { if (split && panelWidth < 720) setPanelWidth(720); }, [split, panelWidth, setPanelWidth]);
  const minimum = Math.min(.5, 340 / available);
  const ratio = Math.max(minimum, Math.min(1 - minimum, groupRatio));
  const allKeys = groups.flatMap(group => group.keys);
  function tabTitle(key: string) {
    return chat.workspace.tabs[key]?.title || t("reader.chat.new");
  }
  function focusSelected() {
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>('[data-focused-group="true"] [aria-selected="true"]')?.focus());
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, keys: string[], key: string) {
    const index = keys.indexOf(key), rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + (rtl ? -1 : 1) + keys.length) % keys.length;
    if (event.key === "ArrowLeft") next = (index + (rtl ? 1 : -1) + keys.length) % keys.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = keys.length - 1;
    if (next !== undefined) { event.preventDefault(); chat.selectTab(keys[next]); document.getElementById(keys[next])?.focus(); }
    if (event.key === "Delete") { event.preventDefault(); chat.closeTab(key); focusSelected(); }
  }
  function updateRatio(clientX: number) {
    const rect = grid.current?.getBoundingClientRect();
    if (!rect) return;
    const rtl = getComputedStyle(grid.current!).direction === "rtl";
    const next = (rtl ? rect.right - clientX : clientX - rect.left) / available;
    setGroupRatio(Math.max(minimum, Math.min(1 - minimum, next)));
  }
  return <section className="reader-groups-workspace" aria-label={t("reader.groups.title")}>
    <header className="reader-groups-heading"><div><h2>{t("reader.groups.title")}</h2>
      <span>{t(split ? "reader.groups.two" : "reader.groups.one")}</span></div>
      <div className="reader-groups-actions">
        <button className="reader-button" type="button" onClick={() => void chat.loadHistory()}><FiList />{t("reader.groups.all")}</button>
        <button className="reader-button" type="button" onClick={() => split ? chat.mergeGroups() : chat.splitGroup()}><FiColumns />{t(split ? "reader.groups.merge" : "reader.groups.split")}</button>
        <button className="reader-icon-button" type="button" aria-label={t("reader.chat.settings.title")} title={t("reader.chat.settings.title")}
          onClick={() => setAiSettings(value => !value)}><FiSettings /></button>
      </div>
    </header>
    {chat.workspace.lastClosed && <div className="reader-chat-tab-notice" role="status"><span>{t("reader.chat.tabs.closed")}</span>
      <button type="button" onClick={chat.reopenTab}>{t("reader.chat.tabs.undo")}</button></div>}
    {chat.workspace.storageWarning && <p className="reader-chat-status" role="status">{t("reader.chat.tabs.storageWarning")}</p>}
    <ReaderPanelResize width={panelWidth} onWidthChange={setPanelWidth} minimumWidth={split ? 720 : 440} />
    <div className="reader-group-grid" ref={grid} hidden={aiSettings}
      style={{ gridTemplateColumns: split ? `${ratio}fr 8px ${1 - ratio}fr` : "minmax(0, 1fr)" } as CSSProperties}
      onDragOver={event => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-reader-group-id]');
        if (draggedKey.current && target) { event.preventDefault(); setDropGroup(target.dataset.readerGroupId!); }
      }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropGroup(null); }}
      onDrop={event => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-reader-group-id]');
        if (!target || !draggedKey.current) return;
        event.preventDefault(); setDropGroup(null);
        const before = (event.target as HTMLElement).closest<HTMLElement>('[data-reader-tab-key]')?.dataset.readerTabKey;
        chat.moveTab(draggedKey.current, target.dataset.readerGroupId!, before); draggedKey.current = "";
      }}>
      {groups.map((group, index) => <header key={group.id} className="reader-group-heading" style={{ gridColumn: index * 2 + 1, gridRow: 1 }}
        data-reader-group-id={group.id} data-drop-target={dropGroup === group.id} data-focused-group={group.id === focusedGroupId}
        onPointerDown={() => chat.focusGroup(group.id)} onFocusCapture={() => chat.focusGroup(group.id)}>
        <div className="reader-group-label"><span>{t("reader.groups.group", { number: index + 1 })}</span>
          <span className="reader-group-focus-label">{group.id === focusedGroupId ? t("reader.groups.focused") : ""}</span>
          <div className="reader-group-controls"><button type="button" className="reader-icon-button" disabled={!group.activeKey}
            title={t("reader.groups.move")} aria-label={t("reader.groups.moveFrom", { number: index + 1 })}
            onClick={() => group.activeKey && chat.moveToSide(group.activeKey)}>{(index === 0) === (i18n.dir() === "rtl") ? <FiArrowLeft /> : <FiArrowRight />}</button>
            <button type="button" className="reader-icon-button reader-chat-new-tab" title={t("reader.chat.new")}
              aria-label={t("reader.groups.newIn", { number: index + 1 })} onClick={() => chat.start(undefined, group.id)}><FiPlus /></button></div>
        </div>
        <div className="reader-group-tabs" role="tablist" aria-label={t("reader.groups.tabsIn", { number: index + 1 })}>
          {group.keys.map(key => {
            const tab = chat.workspace.tabs[key], title = tabTitle(key);
            const status = tab?.sending ? t("reader.chat.tabs.generating") : tab?.unread ? t("reader.chat.tabs.unread")
              : tab?.error || tab?.errorKey || tab?.unavailable ? t("reader.chat.tabs.error") : tab?.draft ? t("reader.chat.tabs.draft") : "";
            return <div key={key} className={"reader-chat-tab" + (group.activeKey === key ? " is-active" : "")} draggable
              data-reader-tab-key={key} onDragStart={event => { draggedKey.current = key; event.dataTransfer.setData("text/plain", key); event.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { draggedKey.current = ""; setDropGroup(null); }}>
              <button role="tab" type="button" id={key} aria-controls={"reader-group-view-" + key} aria-selected={group.activeKey === key}
                tabIndex={group.activeKey === key ? 0 : -1} title={title + (status ? " · " + status : "")}
                aria-label={title + (status ? " · " + status : "")} onClick={() => chat.selectTab(key)} onKeyDown={event => tabKey(event, group.keys, key)}>
                {tab?.sending ? <FiLoader className="reader-chat-tab-busy" aria-hidden="true" /> : tab?.unread ? <span aria-hidden="true">●</span>
                  : tab?.draft ? <FiEdit3 /> : <FiMessageSquare />}
                <span dir="auto">{title}</span></button>
              <button className="reader-chat-tab-close" type="button" aria-label={t("reader.chat.tabs.close", { title })}
                onClick={() => { chat.closeTab(key); focusSelected(); }}><FiX /></button>
            </div>;
          })}
        </div>
      </header>)}
      {split && <div className="reader-group-divider" role="separator" tabIndex={0} aria-orientation="vertical"
        aria-label={t("reader.groups.resize")} aria-valuemin={Math.round(minimum * 100)} aria-valuemax={Math.round((1 - minimum) * 100)} aria-valuenow={Math.round(ratio * 100)}
        style={{ gridColumn: 2, gridRow: "1 / 3" }}
        onPointerDown={event => { drag.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (drag.current) updateRatio(event.clientX); }} onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
          setGroupRatio(event.key === "Home" ? minimum : event.key === "End" ? 1 - minimum : Math.max(minimum, Math.min(1 - minimum, ratio + ((event.key === "ArrowLeft") === rtl ? .04 : -.04))));
        }}><span /></div>}
      {/* Stable keyed conversation views preserve drafts and scroll state when moved between groups. */}
      {allKeys.map(key => {
        const index = groups.findIndex(g => g.keys.includes(key)), group = groups[index], visible = group.activeKey === key;
        return <article key={key} id={"reader-group-view-" + key} role="tabpanel" aria-labelledby={key}
          hidden={!visible} className="reader-group-view"
          data-reader-group-id={group.id} data-drop-target={dropGroup === group.id} style={{ gridColumn: index * 2 + 1, gridRow: 2 }}
          onPointerDown={() => chat.focusGroup(group.id)} onFocusCapture={() => chat.focusGroup(group.id)}>
          {<ReaderChat onPassageNavigate={onPassageNavigate} chat={chat.forTab(key)} onClose={onClose} embedded visible={visible && !aiSettings}
            focused={group.id === focusedGroupId} />}
        </article>;
      })}
      {groups.filter(g => !g.activeKey).map(group => <div key={"empty-" + group.id} className="reader-group-empty"
        style={{ gridColumn: groups.indexOf(group) * 2 + 1, gridRow: 2 }} data-reader-group-id={group.id} data-drop-target={dropGroup === group.id}
        onPointerDown={() => chat.focusGroup(group.id)}>
        <FiColumns /><h3>{t("reader.groups.emptyTitle")}</h3><p>{t("reader.groups.emptyHint")}</p>
        <button className="reader-button" onClick={() => { chat.focusGroup(group.id); void chat.loadHistory(); }}>{t("reader.groups.all")}</button>
        <button className="reader-button" onClick={() => chat.start(undefined, group.id)}><FiPlus />{t("reader.chat.new")}</button>

      </div>)}
    </div>
    {aiSettings && <div className="reader-workspace-ai"><button type="button" className="reader-button" onClick={() => setAiSettings(false)}><FiArrowLeft />{t("reader.chat.back")}</button><ReaderAiSettings onClose={() => setAiSettings(false)} /></div>}
    {chat.history && <ReaderChatHistory chat={chat} onOpenBeside={id => void chat.open(id, focusedGroupId, true)} />}
  </section>;
}
