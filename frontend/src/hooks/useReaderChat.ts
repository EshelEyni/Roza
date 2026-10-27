import { useEffect, useRef, useSyncExternalStore } from "react";
import readerChatApiService from "../services/readerChatApiService";
import { createRequestId } from "../services/createRequestId";
import { ReaderChatWorkspace } from "../services/readerChatWorkspace";

export function useReaderChat(bookId: string, getCurrentCfi: () => string, userId?: string) {
  const owner = useRef<{ scope: string; store: ReaderChatWorkspace }>();
  const scope = JSON.stringify([userId, bookId]);
  if (!owner.current || owner.current.scope !== scope) {
    owner.current?.store.setSavingEnabled(false);
    owner.current = { scope, store: new ReaderChatWorkspace(bookId, userId, readerChatApiService, createRequestId) };
  }
  const store = owner.current.store;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.setSavingEnabled(true);
    store.initialize();
    const save = () => store.flush();
    if (typeof window !== "undefined") window.addEventListener?.("pagehide", save);
    return () => { store.flush(); store.setSavingEnabled(false); if (typeof window !== "undefined") window.removeEventListener?.("pagehide", save); };
  }, [store]);
  const tab = state.activeKey ? state.tabs[state.activeKey] : undefined;
  return {
    conversation: tab?.conversation || null, draft: tab?.draft || "", passage: tab?.passage,
    loading: tab?.loading || false, sending: tab?.sending || false, pending: tab?.pending || null,
    error: tab?.error || "", errorKey: tab?.errorKey, spoilersAllowed: tab?.spoilersAllowed || false,
    draftVersion: tab?.key || "", activeTabKey: tab?.key, activeTab: tab,
    unavailable: tab?.unavailable || false, workspace: state,
    items: state.items, cursor: state.cursor, history: state.history,
    setDraft: store.setDraft, setSpoilersAllowed: store.setSpoilersAllowed, setHistory: store.setHistory,
    start: store.start, attach: store.attach, open: store.open, remove: store.remove, loadHistory: store.loadHistory,
    send: (question: string, retryId?: string) => store.send(question, getCurrentCfi(), retryId),
    selectTab: store.selectTab, closeTab: store.closeTab, reopenTab: store.reopenTab,
    retryLoad: store.retryLoad, rememberScroll: store.rememberScroll, flush: store.flush,
    setViewing: store.setViewing, setPanelWidth: store.setPanelWidth,
  };
}
