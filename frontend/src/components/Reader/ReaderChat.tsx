import { ReaderChatResize } from "./ReaderChatResize";
import { buildReaderChatView, readerPassageKey, type ReaderChatMessageView } from "../../services/readerChatPresentation";
import { ReaderChatTabs } from "./ReaderChatTabs";
import { ReaderChatHistory } from "./ReaderChatHistory";
import { ReaderChatQuote } from "./ReaderChatQuote";
import { scrollReaderChat, type ReaderChatScrollState } from "../../services/readerChatScroll";
import { readerAiLimits } from "../../services/readerAiLimits";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiMessageSquare,
  FiPlus,
  FiSend,
  FiSettings,
} from "react-icons/fi";
import type { ReaderChatView } from "../../hooks/useReaderChat";
import { ReaderAiSettings } from "./ReaderAiSettings";

import type { ReaderPassage } from "../../../../shared/types/readerChat";

type ChatState = ReaderChatView;
export function ReaderChat({
  chat,
  onPassageNavigate,
  onClose, embedded = false, visible = true, focused = true,
}: {
  chat: ChatState;
  onPassageNavigate?: (passage: ReaderPassage) => void;
  onClose: () => void; embedded?: boolean; visible?: boolean; focused?: boolean;
}) {
  const { t } = useTranslation();
  const { draft: question, setDraft: setQuestion } = chat;
  const { setViewing, rememberScroll, activeTabKey, activeTab, conversation, pending, sending, history, loading } = chat;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(typeof document === "undefined" || !document.hidden);
  const messages = useRef<HTMLDivElement>(null);
  const previouslyVisible = useRef(false);
  const questionId = embedded ? "reader-chat-question-" + chat.activeTabKey : "reader-chat-question";
  const scrollStates = useRef(new Map<string, ReaderChatScrollState>());
  const visibleTab = useRef<string>();
  const focusedTab = useRef<string>();
  const input = useRef<HTMLTextAreaElement>(null);
  const disabled = chat.sending || chat.loading;
  useEffect(() => {
    setSettingsOpen(false);
  }, [chat.draftVersion]);
  useEffect(() => {
    const update = () => { setDocumentVisible(!document.hidden); setViewing(visible && !document.hidden && !settingsOpen && !history); };
    update();
    document.addEventListener("visibilitychange", update);
    return () => { setViewing(false); document.removeEventListener("visibilitychange", update); };
  }, [setViewing, history, settingsOpen, visible]);
  useLayoutEffect(() => {
    const becameVisible = visible && !previouslyVisible.current;
    previouslyVisible.current = visible;
    if (!visible || !documentVisible || history || settingsOpen || !activeTabKey) return;
    const element = messages.current;
    if (!element) return;
    const key = activeTabKey;
    const completed = conversation?.turns.filter(turn => turn.status === "completed").map(turn => turn.id) || [];
    const unseen = completed.some(id => !activeTab?.viewedAnswerIds.includes(id));
    const switched = visibleTab.current !== key || becameVisible;
    const previous = scrollStates.current.get(key);
    if ((switched || !previous || previous.container !== element) && activeTab?.scrollTop !== undefined && !unseen) {
      element.scrollTop = activeTab.scrollTop;
      scrollStates.current.set(key, { container: element, conversationId: conversation?.id,
        completedIds: new Set(completed), pendingId: pending?.id });
    } else {
      scrollStates.current.set(key, scrollReaderChat(element, switched ? null : previous || null, conversation, pending?.id));
    }
    visibleTab.current = key;
    rememberScroll(key, element.scrollTop, completed);
  }, [activeTabKey, activeTab, conversation, pending?.id, sending, history, settingsOpen, loading, rememberScroll, documentVisible, visible]);
  useLayoutEffect(() => {
    if (visible && focused && focusedTab.current !== activeTabKey && !history && !settingsOpen && document.activeElement?.getAttribute("role") !== "tab")
      input.current?.focus({ preventScroll: true });
    focusedTab.current = activeTabKey;
  }, [activeTabKey, history, settingsOpen, visible, focused]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if ((!text && !chat.passage?.text.trim()) || disabled) return;
    if (chat.pending) return;
    if (chat.send(text)) setQuestion("");
  }
  const turns = chat.conversation?.turns || [];
  const pendingIsSaved = turns.some(turn => turn.id === chat.pending?.id);
  const view = buildReaderChatView(turns, chat.conversation?.passage, chat.pending, chat.passage);
  function revealPassage(sourceId: string) {
    const container = messages.current;
    if (!container) return;
    const source = Array.from(container.querySelectorAll<HTMLElement>("[data-reader-chat-source]"))
      .find(element => element.dataset.readerChatSource === sourceId);
    if (!source) return;
    container.scrollTop += source.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop - 12;
    source.focus({ preventScroll: true });
  }
  function userContent(message: ReaderChatMessageView) {
    return <>
      {message.passage && (
        <ReaderChatQuote key={readerPassageKey(message.passage)} passage={message.passage} sourceId={message.id} onReveal={onPassageNavigate} />
      )}
      {message.referenceId && (
        <button type="button" className="reader-chat-source-reference"
          title={t("reader.chat.viewOriginalQuote")} onClick={() => revealPassage(message.referenceId!)}>
          <span aria-hidden="true">↩</span> {t("reader.chat.samePassage")}
        </button>
      )}
      {message.question && (
        <div className={message.passage ? "reader-chat-authored-question" : undefined}>
          {message.passage && <span className="reader-chat-question-label">{t("reader.chat.yourQuestion")}</span>}
          <p dir="auto">{message.question}</p>
        </div>
      )}
    </>;
  }
  return (
    <section className={"reader-chat" + (embedded ? " reader-chat-embedded" : "")} aria-label={t("reader.chat.title")}>
      {!embedded && <>
      <div className="reader-chat-heading">
        <h2>{t("reader.chat.title")}</h2>
        <div className="reader-chat-actions">
          <button
            className="reader-button"
            onClick={() => {
              setSettingsOpen(false);
              chat.start();
            }}
          >
            <FiPlus />
            {t("reader.chat.new")}
          </button>
          <button
            className="reader-button"
            onClick={() => {
              setSettingsOpen(false);
              void chat.loadHistory();
            }}
          >
            <FiMessageSquare />
            <span className="reader-chat-saved-label">{t("reader.chat.saved")}</span><span className="reader-chat-all-label">{t("reader.chat.tabs.all")}</span>
          </button>
          <button
            className={
              "reader-icon-button " + (settingsOpen ? "is-active" : "")
            }
            disabled={disabled}
            onClick={() => setSettingsOpen(value => !value)}
            aria-label={t("reader.chat.settings.title")}
            title={t("reader.chat.settings.title")}
            aria-expanded={settingsOpen}
          >
            <FiSettings />
          </button>
          <button
            type="button"
            className="reader-panel-cancel"
            onClick={onClose}
          >
            {t("reader.chat.cancel")}
          </button>
        </div>
      </div>
      <ReaderChatResize chat={chat} />
      <ReaderChatTabs chat={chat} />
      </>}
      {embedded && <div className="reader-chat-conversation-heading"><h3 title={chat.activeTab?.title}>{chat.activeTab?.title || t("reader.chat.new")}</h3></div>}
      {!embedded && chat.workspace.lastClosed && <div className="reader-chat-tab-notice" role="status">
        <span>{t("reader.chat.tabs.closed")}</span>
        <button type="button" onClick={chat.reopenTab}>{t("reader.chat.tabs.undo")}</button>
      </div>}
      {!embedded && chat.workspace.storageWarning && <p className="reader-chat-status" role="status">{t("reader.chat.tabs.storageWarning")}</p>}
      <div id={embedded ? "reader-chat-content-" + activeTabKey : "reader-chat-tabpanel"} className="reader-chat-tabpanel" role={embedded ? undefined : "tabpanel"}
        aria-labelledby={chat.activeTabKey}>
      {!settingsOpen && chat.conversation?.contextSummaryFailed && (
        <p className="reader-chat-status" role="status">
          {t("reader.chat.summaryUnavailable")}
        </p>
      )}
      {!settingsOpen && !!chat.conversation?.contextOmittedTurns && (
        <p className="reader-chat-status" role="status">
          {t("reader.chat.contextLimited", { count: chat.conversation.contextOmittedTurns })}
        </p>
      )}
      {!settingsOpen && chat.error && (
        <p className="reader-chat-error" role="alert">
          {chat.error}
        </p>
      )}
      {!settingsOpen && chat.errorKey && <p className="reader-chat-error" role="alert">{t("reader.chat.tabs." + chat.errorKey)}</p>}
      {chat.unavailable && <button type="button" className="reader-button" onClick={chat.retryLoad}>{t("reader.retry")}</button>}
      {chat.loading && (
        <p className="reader-chat-status" role="status">
          {t("reader.chat.loading")}
        </p>
      )}
      {settingsOpen ? (
        <ReaderAiSettings onClose={() => setSettingsOpen(false)} />
      ) : !chat.activeTabKey ? (
        <div className="reader-chat-workspace-empty"><h3>{t("reader.chat.tabs.emptyTitle")}</h3>
          <p>{t("reader.chat.tabs.emptyHint")}</p>
          <button type="button" className="reader-button" onClick={() => chat.start()}><FiPlus />{t("reader.chat.new")}</button>
        </div>
      ) : (
        <>
          <div
            className="reader-chat-messages"
            ref={messages}
            role="log"
            aria-live={chat.history ? "off" : "polite"}
            onScroll={event => { if (visible && chat.activeTabKey) chat.rememberScroll(chat.activeTabKey, event.currentTarget.scrollTop); }}
            aria-label={t("reader.chat.messages")}
          >
            {!turns.length && !chat.pending && (
              <p className="reader-chat-empty">
                {t(
                  chat.passage
                    ? "reader.chat.passageHint"
                    : "reader.chat.generalHint",
                )}
              </p>
            )}
            {view.entries.map(({ turn, message }) => (
              <div className="reader-chat-turn" key={turn.id}>
                <div className="reader-chat-message reader-chat-question">
                  <span>{t("reader.chat.you")}</span>
                  {userContent(message)}
                </div>
                {turn.status === "completed" ? (
                  <div className="reader-chat-message reader-chat-answer" data-reader-chat-answer={turn.id}>
                    <span>{t("reader.chat.assistant")}</span>
                    <p dir="auto">{turn.answer}</p>
                  </div>
                ) : (
                  <div className="reader-chat-status" role="status">
                    <p>
                      {t(
                        chat.sending && chat.pending?.id === turn.id
                          ? "reader.chat.generating"
                          : turn.status === "pending"
                            ? "reader.chat.interrupted"
                            : "reader.chat.failed",
                      )}
                    </p>
                    {!chat.sending && (
                      <button
                        className="reader-button"
                        disabled={disabled}
                        onClick={() => void chat.send(turn.question, turn.id)}
                      >
                        {t("reader.retry")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {chat.pending && view.pending && (
              <div className="reader-chat-message reader-chat-question">
                <span>{t("reader.chat.you")}</span>
                {userContent(view.pending)}
                {!chat.sending && (
                  <button
                    className="reader-button"
                    onClick={() =>
                      void chat.send(chat.pending!.question, chat.pending!.id)
                    }
                  >
                    {t("reader.retry")}
                  </button>
                )}
              </div>
            )}
            {chat.sending &&
              (!pendingIsSaved ||
                turns.find(turn => turn.id === chat.pending?.id)?.status !==
                  "pending") && (
                <p className="reader-chat-status" role="status">
                  {t("reader.chat.generating")}
                </p>
              )}
            {view.draftPassage && (
              <div className="reader-chat-draft-source" data-reader-chat-draft>
                <ReaderChatQuote key={readerPassageKey(view.draftPassage)} passage={view.draftPassage} onReveal={onPassageNavigate} draft />
              </div>
            )}
          </div>
          <form
            className="reader-chat-compose"
            autoComplete="off"
            onSubmit={event => void submit(event)}
          >
            {view.attachedReferenceId && !chat.pending && (
              <button type="button" className="reader-chat-source-reference reader-chat-compose-reference"
                onClick={() => revealPassage(view.attachedReferenceId!)}>
                <span aria-hidden="true">↩</span> {t("reader.chat.samePassage")}
              </button>
            )}
            <label className="reader-chat-spoilers">
              <input
                type="checkbox"
                checked={chat.spoilersAllowed}
                disabled={disabled}
                onChange={event =>
                  chat.setSpoilersAllowed(event.target.checked)
                }
              />
              {t("reader.chat.spoilers")}
            </label>
            <label className="reader-sr-only" htmlFor={questionId}>
              {t("reader.chat.question")}
            </label>
            <textarea
              id={questionId}
              name="book-chat-message"
              autoComplete="off"
              ref={input}
              dir="auto"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder={t(chat.passage ? "reader.chat.optionalQuestion" : "reader.chat.question")}
              maxLength={readerAiLimits.question}
              disabled={chat.loading}
              rows={3}
              onKeyDown={event => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="reader-chat-compose-footer">
              <span>{t("reader.chat.contextNote")}</span>
              <button
                className="reader-button"
                type="submit"
                disabled={disabled || chat.unavailable || !!chat.pending || (!question.trim() && !chat.passage?.text.trim())}
              >
                <FiSend />
                {t("reader.chat.send")}
              </button>
            </div>
          </form>
        </>
      )}
      </div>
      {!embedded && chat.history && <ReaderChatHistory chat={chat} />}
    </section>
  );
}
