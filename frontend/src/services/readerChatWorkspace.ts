import type { ReaderConversation, ReaderConversationSummary, ReaderPassage } from "../../../shared/types/readerChat";
import type readerChatApiService from "./readerChatApiService";

export type ReaderChatPending = {
  id: string; question: string; currentCfi: string; spoilersAllowed: boolean; passage?: ReaderPassage;
};
export type ReaderChatTab = {
  key: string; serverId?: string; title: string; conversation: ReaderConversation | null;
  passage?: ReaderPassage; draft: string; spoilersAllowed: boolean; pending: ReaderChatPending | null;
  loading: boolean; sending: boolean; unread: boolean; error: string; errorKey?: string;
  preferencesRestored?: boolean; unavailable: boolean; scrollTop?: number; viewedAnswerIds: string[]; updatedAt: string;
};
export type ReaderSidePanel = "contents" | "search" | "settings";
type ClosedTab = { key: string; index: number };
export type ReaderChatWorkspaceState = {
  tabs: Record<string, ReaderChatTab>; openKeys: string[]; activeKey: string | null;
  items: ReaderConversationSummary[]; cursor: string | null; history: boolean;
  historyLoading: boolean; historyError: string; removing: string[];
  lastClosed: ClosedTab | null; storageWarning: boolean; panelWidth: number; sidePanelWidths: Record<ReaderSidePanel, number>;
};
type Api = typeof readerChatApiService;
type StorageAccess = () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
let sequence = 0;
function emptyTab(serverId?: string): ReaderChatTab {
  return {
    key: "chat-" + Date.now() + "-" + ++sequence, serverId, title: "", conversation: null,
    draft: "", spoilersAllowed: false, pending: null, loading: !!serverId, sending: false,
    unread: false, error: "", unavailable: false, viewedAnswerIds: [], updatedAt: new Date().toISOString(),
  };
}
function isPassage(value: unknown): value is ReaderPassage {
  const p = value as ReaderPassage | undefined;
  return !!p && typeof p.cfi === "string" && typeof p.text === "string" &&
    (p.endCfi === undefined || typeof p.endCfi === "string");
}

/** One owner per account/book; network work is independent of the visible tab/component. */
export class ReaderChatWorkspace {
  private state: ReaderChatWorkspaceState;
  private listeners = new Set<() => void>();
  private initialized = false;
  private storageKey: string;
  private legacyKey: string;
  private viewing = false;
  private loads = new Map<string, Promise<void>>();
  private versions = new Map<string, number>();
  private historyVersion = 0;
  private savingEnabled = true;

  constructor(private bookId: string, userId: string | undefined, private api: Api,
    private requestId: () => string, private storage: StorageAccess = () => window.localStorage) {
    this.storageKey = userId ? `roza-chat-workspace:v1:${userId}:${bookId}` : "";
    this.legacyKey = userId ? `roza-active-chat:${userId}:${bookId}` : "";
    const initial = emptyTab();
    this.state = { tabs: { [initial.key]: initial }, openKeys: [initial.key], activeKey: initial.key,
      items: [], cursor: null, history: false, historyLoading: false, historyError: "", removing: [],
      lastClosed: null, storageWarning: false, panelWidth: 480, sidePanelWidths: { contents: 285, search: 360, settings: 285 } };
    this.restore();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get active() { return this.state.activeKey ? this.state.tabs[this.state.activeKey] : undefined; }
  private update(change: Partial<ReaderChatWorkspaceState>, persist = true) {
    this.state = { ...this.state, ...change };
    if (persist) this.persist();
    this.listeners.forEach(listener => listener());
  }
  private patch(key: string, change: Partial<ReaderChatTab>, persist = true) {
    if (this.state.tabs[key]) this.update({ tabs: { ...this.state.tabs,
      [key]: { ...this.state.tabs[key], ...change } } }, persist);
  }
  private restore() {
    if (!this.storageKey) return;
    try {
      const storage = this.storage();
      const raw = storage?.getItem(this.storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !Array.isArray(saved.tabs) || !Array.isArray(saved.openKeys)) return;
        const tabs: Record<string, ReaderChatTab> = {};
        for (const value of saved.tabs) {
          if (!value || typeof value.key !== "string" || !/^chat-[\w-]+$/.test(value.key) ||
            typeof value.draft !== "string" || typeof value.title !== "string") continue;
          const tab = emptyTab(typeof value.serverId === "string" ? value.serverId : undefined);
          tab.key = value.key; tab.title = value.title; tab.draft = value.draft;
          tab.passage = isPassage(value.passage) ? value.passage : undefined;
          tab.spoilersAllowed = value.spoilersAllowed === true; tab.preferencesRestored = true;
          tab.scrollTop = Number.isFinite(value.scrollTop) ? Math.max(0, value.scrollTop) : undefined;
          tab.viewedAnswerIds = Array.isArray(value.viewedAnswerIds) ? value.viewedAnswerIds.filter((id: unknown) => typeof id === "string") : [];
          tab.unread = value.unread === true;
          const p = value.pending;
          if (p && typeof p.id === "string" && typeof p.question === "string" && typeof p.currentCfi === "string") {
            tab.pending = { id: p.id, question: p.question, currentCfi: p.currentCfi,
              spoilersAllowed: p.spoilersAllowed === true, passage: isPassage(p.passage) ? p.passage : undefined };
          }
          tabs[tab.key] = tab;
        }
        const openKeys = [...new Set<string>(saved.openKeys.filter((key: unknown) => typeof key === "string" && Object.prototype.hasOwnProperty.call(tabs, key)))];
        this.state = { ...this.state, tabs, openKeys, activeKey: openKeys.includes(saved.activeKey) ? saved.activeKey : openKeys[0] || null,
          panelWidth: Number.isFinite(saved.panelWidth) ? Math.max(440, saved.panelWidth) : 480,
          sidePanelWidths: {
            contents: Number.isFinite(saved.sidePanelWidths?.contents) ? Math.max(260, saved.sidePanelWidths.contents) : 285,
            search: Number.isFinite(saved.sidePanelWidths?.search) ? Math.max(260, saved.sidePanelWidths.search) : 360,
            settings: Number.isFinite(saved.sidePanelWidths?.settings) ? Math.max(260, saved.sidePanelWidths.settings) : 285,
          } };
      } else {
        const legacy = storage?.getItem(this.legacyKey);
        if (legacy) {
          const tab = emptyTab(legacy);
          this.state = { ...this.state, tabs: { [tab.key]: tab }, openKeys: [tab.key], activeKey: tab.key };
        }
      }
    } catch { this.state = { ...this.state, storageWarning: true }; }
  }
  private persist() {
    if (!this.storageKey || !this.savingEnabled) return;
    try {
      const storage = this.storage();
      if (!storage) return;
      const tabs = Object.values(this.state.tabs).filter(tab => this.state.openKeys.includes(tab.key) ||
        tab.draft || tab.pending || (!tab.serverId && tab.passage)).map(tab => ({
        key: tab.key, serverId: tab.serverId, title: tab.title, draft: tab.draft, passage: tab.passage,
        spoilersAllowed: tab.spoilersAllowed, pending: tab.pending, scrollTop: tab.scrollTop,
        viewedAnswerIds: tab.viewedAnswerIds, unread: tab.unread,
      }));
      storage.setItem(this.storageKey, JSON.stringify({ version: 1, tabs, openKeys: this.state.openKeys,
        activeKey: this.state.activeKey, panelWidth: this.state.panelWidth, sidePanelWidths: this.state.sidePanelWidths }));
      // Keep the legacy pointer for the single-conversation experience and migration.
      if (this.active?.serverId) storage.setItem(this.legacyKey, this.active.serverId);
      else storage.removeItem(this.legacyKey);
    } catch { this.state = { ...this.state, storageWarning: true }; }
  }
  initialize = () => {
    if (this.initialized) return;
    this.initialized = true;
    Object.values(this.state.tabs).filter(tab => tab.serverId && (this.state.openKeys.includes(tab.key) || tab.pending))
      .forEach(tab => { void this.load(tab.key); });
  };
  /** A departed account/book cannot overwrite the workspace if an old request finishes later. */
  setSavingEnabled = (enabled: boolean) => { this.savingEnabled = enabled; };
  setViewing = (viewing: boolean) => { this.viewing = viewing; };
  setDraft = (draft: string) => { if (this.active) this.patch(this.active.key, { draft }); };
  setSpoilersAllowed = (spoilersAllowed: boolean) => { if (this.active) this.patch(this.active.key, { spoilersAllowed }); };
  setHistory = (history: boolean) => { this.update({ history }, false); };
  setPanelWidth = (panelWidth: number) => { this.update({ panelWidth: Number.isFinite(panelWidth) ? Math.max(440, panelWidth) : 480 }); };
  setSidePanelWidth = (panel: ReaderSidePanel, width: number) => {
    if (Number.isFinite(width)) this.update({ sidePanelWidths: { ...this.state.sidePanelWidths, [panel]: Math.max(260, width) } });
  };
  rememberScroll = (key: string, scrollTop: number, viewedAnswerIds?: string[]) => {
    if (this.state.tabs[key]) {
      // Scroll events need no React render or storage write on every pixel.
      const unread = this.state.tabs[key].unread;
      this.state.tabs[key] = { ...this.state.tabs[key], scrollTop,
        ...(viewedAnswerIds ? { viewedAnswerIds, unread: false } : {}) };
      if (viewedAnswerIds && unread) this.update({ tabs: { ...this.state.tabs } });
    }
  };
  flush = () => { this.persist(); };
  selectTab = (key: string) => {
    if (!this.state.openKeys.includes(key)) return;
    this.update({ activeKey: key, history: false });
  };
  start = (selected?: ReaderPassage) => {
    const blank = this.state.openKeys.map(key => this.state.tabs[key]).find(tab =>
      !tab.serverId && !tab.draft && !tab.pending && !tab.passage);
    if (blank) { if (selected) this.patch(blank.key, { passage: selected }); this.selectTab(blank.key); return; }
    const tab = emptyTab(); tab.passage = selected;
    this.update({ tabs: { ...this.state.tabs, [tab.key]: tab }, openKeys: [...this.state.openKeys, tab.key], activeKey: tab.key, history: false });
  };
  closeTab = (key: string) => {
    const index = this.state.openKeys.indexOf(key);
    if (index < 0) return;
    const openKeys = this.state.openKeys.filter(id => id !== key);
    this.update({ openKeys, activeKey: this.state.activeKey === key ? openKeys[index] || openKeys[index - 1] || null : this.state.activeKey,
      lastClosed: { key, index } });
  };
  reopenTab = () => {
    const closed = this.state.lastClosed;
    if (!closed || !this.state.tabs[closed.key]) return;
    const openKeys = this.state.openKeys.filter(key => key !== closed.key);
    openKeys.splice(Math.min(closed.index, openKeys.length), 0, closed.key);
    this.update({ openKeys, activeKey: closed.key, history: false, lastClosed: null });
  };
  open = async (id: string) => {
    let tab = Object.values(this.state.tabs).find(tab => tab.key === id || tab.serverId === id);
    if (!tab) {
      tab = emptyTab(id);
      tab.title = this.state.items.find(item => item.id === id)?.title || "";
      this.update({ tabs: { ...this.state.tabs, [tab.key]: tab } }, false);
    }
    const openKeys = this.state.openKeys.includes(tab.key) ? this.state.openKeys : [...this.state.openKeys, tab.key];
    this.update({ openKeys, activeKey: tab.key, history: false });
    if (tab.serverId && !tab.conversation && !tab.sending) await this.load(tab.key);
  };
  private load(key: string): Promise<void> {
    const existing = this.loads.get(key);
    if (existing) return existing;
    const tab = this.state.tabs[key];
    if (!tab?.serverId || tab.sending) return Promise.resolve();
    const version = (this.versions.get(key) || 0) + 1;
    this.versions.set(key, version);
    this.patch(key, { loading: true, error: "", unavailable: false });
    const promise = (async () => {
      try {
        const found = await this.api.getById(this.bookId, tab.serverId!);
        if (this.versions.get(key) !== version) return;
        const current = this.state.tabs[key];
        const completed = current.pending && found.turns.find(turn => turn.id === current.pending!.id && turn.status === "completed");
        this.patch(key, { conversation: found, title: found.title || current.title, passage: current.passage || found.passage,
          spoilersAllowed: current.preferencesRestored ? current.spoilersAllowed : found.spoilersAllowed, preferencesRestored: true, pending: completed ? null : current.pending,
          unread: current.unread || found.turns.some(turn => turn.status === "completed" && !current.viewedAnswerIds.includes(turn.id)) });
      } catch (error) {
        this.patch(key, { error: (error as Error).message, unavailable: true });
      } finally {
        if (this.versions.get(key) === version) this.patch(key, { loading: false });
        this.loads.delete(key);
      }
    })();
    this.loads.set(key, promise);
    return promise;
  }
  retryLoad = () => { if (this.active) void this.load(this.active.key); };
  attach = (passage: ReaderPassage) => {
    if (this.active && !this.active.loading && !this.active.sending && !this.active.pending)
      this.patch(this.active.key, { passage, error: "" });
  };
  send = (question: string, currentCfi: string, retryId?: string) => {
    const tab = this.active;
    if (!tab || tab.loading || tab.sending || tab.unavailable || (tab.pending && retryId !== tab.pending.id)) return false;
    const original = retryId ? tab.conversation?.turns.find(turn => turn.id === retryId) ||
      (tab.pending?.id === retryId ? tab.pending : undefined) : undefined;
    if (retryId && !original) return false;
    const passage = retryId ? original?.passage : tab.passage;
    if (!question.trim() && !passage?.text.trim()) return false;
    const cfi = retryId ? original?.currentCfi || "" : passage?.endCfi || passage?.cfi || currentCfi;
    if (!cfi) { this.patch(tab.key, { errorKey: "originalPositionMissing" }); return false; }
    if (Object.values(this.state.tabs).filter(tab => tab.sending).length >= 3) {
      this.patch(tab.key, { errorKey: "parallelLimit" }); return false;
    }
    const pending: ReaderChatPending = { id: retryId || this.requestId(), question: question.trim(), currentCfi: cfi,
      spoilersAllowed: retryId ? original?.spoilersAllowed ?? false : tab.spoilersAllowed, passage };
    this.versions.set(tab.key, (this.versions.get(tab.key) || 0) + 1);
    this.patch(tab.key, { sending: true, pending, error: "", errorKey: undefined,
      title: tab.title || question.trim().slice(0, 55), updatedAt: new Date().toISOString() });
    void this.performSend(tab.key, pending);
    return true;
  };
  private async performSend(key: string, pending: ReaderChatPending) {
    let target = this.state.tabs[key].conversation;
    try {
      if (!target) {
        target = await this.api.create(this.bookId, pending.passage?.cfi, pending.passage?.endCfi);
        this.patch(key, { conversation: target, serverId: target.id, title: target.title || this.state.tabs[key].title });
      }
      const updated = await this.api.send(this.bookId, target.id, { requestId: pending.id,
        question: pending.question, currentCfi: pending.currentCfi, spoilersAllowed: pending.spoilersAllowed,
        passageCfi: pending.passage?.cfi, passageEndCfi: pending.passage?.endCfi });
      const tab = this.state.tabs[key];
      this.patch(key, { conversation: updated, title: updated.title || tab.title, passage: updated.passage,
        pending: null, unread: !(this.viewing && this.state.activeKey === key && !this.state.history), updatedAt: updated.updatedAt });
      // Never overwrite a new draft or spoiler preference composed while the request was in flight.
      if (tab.serverId) this.upsertSummary(updated);
    } catch (error) {
      this.patch(key, { error: (error as Error).message });
      if (target) {
        try {
          const saved = await this.api.getById(this.bookId, target.id);
          const done = saved.turns.some(turn => turn.id === pending.id && turn.status === "completed");
          this.patch(key, { conversation: saved, ...(done ? { pending: null, error: "", unread: true } : {}) });
        } catch { /* Preserve the pending request and its original boundary for an idempotent retry. */ }
      }
    } finally { this.patch(key, { sending: false }); }
  }
  private upsertSummary(conversation: ReaderConversation) {
    const summary: ReaderConversationSummary = { id: conversation.id, title: conversation.title,
      passage: conversation.passage, spoilersAllowed: conversation.spoilersAllowed,
      createdAt: conversation.createdAt, updatedAt: conversation.updatedAt,
      contextOmittedTurns: conversation.contextOmittedTurns, contextSummaryFailed: conversation.contextSummaryFailed };
    this.update({ items: [summary, ...this.state.items.filter(item => item.id !== summary.id)] }, false);
  }
  loadHistory = async (before?: string) => {
    this.setHistory(true);
    if (this.state.historyLoading) return;
    const version = ++this.historyVersion;
    const initialItems = this.state.items;
    this.update({ historyLoading: true, historyError: "" }, false);
    try {
      const page = await this.api.list(this.bookId, before);
      if (version !== this.historyVersion) return;
      const freshItems = this.state.items.filter(item => !initialItems.includes(item));
      const items = before ? [...this.state.items, ...page.items] : [...freshItems, ...page.items];
      this.update({ items: items.filter((item, i) => items.findIndex(other => other.id === item.id) === i), cursor: page.nextCursor }, false);
    } catch (error) { this.update({ historyError: (error as Error).message }, false); }
    finally { if (version === this.historyVersion) this.update({ historyLoading: false }, false); }
  };
  remove = async (id: string) => {
    const tab = Object.values(this.state.tabs).find(tab => tab.serverId === id || tab.key === id);
    if (tab?.sending || this.state.removing.includes(id)) return;
    this.update({ removing: [...this.state.removing, id], historyError: "" }, false);
    try {
      if (tab?.serverId || !tab) await this.api.remove(this.bookId, tab?.serverId || id);
      if (tab) {
        this.versions.set(tab.key, (this.versions.get(tab.key) || 0) + 1);
        const tabs = { ...this.state.tabs }; delete tabs[tab.key];
        const index = this.state.openKeys.indexOf(tab.key), openKeys = this.state.openKeys.filter(key => key !== tab.key);
        this.update({ tabs, openKeys, activeKey: this.state.activeKey === tab.key ? openKeys[index] || openKeys[index - 1] || null : this.state.activeKey,
          lastClosed: this.state.lastClosed?.key === tab.key ? null : this.state.lastClosed });
      }
      this.update({ items: this.state.items.filter(item => item.id !== id) });
    } catch (error) { this.update({ historyError: (error as Error).message }, false); }
    finally { this.update({ removing: this.state.removing.filter(key => key !== id) }, false); }
  };
}
