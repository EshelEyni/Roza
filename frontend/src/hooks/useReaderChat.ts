import { useEffect, useRef, useSyncExternalStore } from "react";
import readerChatApiService from "../services/readerChatApiService";
import { createRequestId } from "../services/createRequestId";
import { ReaderChatWorkspace, type ReaderChatWorkspaceState } from "../services/readerChatWorkspace";
import type { ReaderPassage } from "../../../shared/types/readerChat";

type TabActions = {
  setDraft: (draft: string) => void; setSpoilersAllowed: (allowed: boolean) => void;
  setViewing: (visible: boolean) => void; retryLoad: () => void;
  send: (question: string, retryId?: string) => boolean; attach: (passage: ReaderPassage) => void;
};
function chatView(store: ReaderChatWorkspace, state: ReaderChatWorkspaceState, key: string | null, actions: TabActions) {
  const tab = key ? state.tabs[key] : undefined;
  return {
    conversation: tab?.conversation || null, draft: tab?.draft || "", passage: tab?.passage,
    loading: tab?.loading || false, sending: tab?.sending || false, pending: tab?.pending || null,
    error: tab?.error || "", errorKey: tab?.errorKey, spoilersAllowed: tab?.spoilersAllowed || false,
    draftVersion: tab?.key || "", activeTabKey: tab?.key, activeTab: tab,
    unavailable: tab?.unavailable || false, workspace: state,
    items: state.items, cursor: state.cursor, history: state.history,
    ...actions, setHistory: store.setHistory, start: store.start, open: store.open,
    remove: store.remove, loadHistory: store.loadHistory, selectTab: store.selectTab,
    closeTab: store.closeTab, reopenTab: store.reopenTab, rememberScroll: store.rememberScroll,
    flush: store.flush, setPanelWidth: store.setPanelWidth,
  };
}
export type ReaderChatView = ReturnType<typeof chatView>;
export function useReaderChat(bookId: string, getCurrentCfi: () => string, userId?: string) {
  const owner = useRef<{ scope: string; store: ReaderChatWorkspace }>();
  const actionCache = useRef(new Map<string | null, TabActions>());
  const boundary = useRef(getCurrentCfi);
  boundary.current = getCurrentCfi;
  const scope = JSON.stringify([userId, bookId]);
  if (!owner.current || owner.current.scope !== scope) {
    owner.current?.store.setSavingEnabled(false); actionCache.current.clear();
    owner.current = { scope, store: new ReaderChatWorkspace(bookId, userId, readerChatApiService, createRequestId) };
  }
  const store = owner.current.store;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.setSavingEnabled(true); store.initialize();
    const save = () => store.flush();
    if (typeof window !== "undefined") window.addEventListener?.("pagehide", save);
    return () => { store.flush(); store.setSavingEnabled(false); if (typeof window !== "undefined") window.removeEventListener?.("pagehide", save); };
  }, [store]);
  function viewFor(key: string | null) {
    let actions = actionCache.current.get(key);
    if (!actions) {
      actions = {
        setDraft: draft => store.setDraft(draft, key), setSpoilersAllowed: allowed => store.setSpoilersAllowed(allowed, key),
        setViewing: visible => { if (key) store.setTabViewing(key, visible); else store.setViewing(visible); },
        retryLoad: () => store.retryLoad(key), attach: passage => store.attach(passage, key),
        send: (question, retryId) => store.send(question, boundary.current(), retryId, key),
      };
      actionCache.current.set(key, actions);
    }
    return chatView(store, state, key, actions);
  }
  return { ...viewFor(state.activeKey || state.openKeys[0] || null), forTab: (key: string) => viewFor(key),
    focusGroup: store.focusGroup, splitGroup: store.splitGroup, mergeGroups: store.mergeGroups,
    moveTab: store.moveTab, moveToSide: store.moveToSide,
    setGroupRatio: store.setGroupRatio };
}
