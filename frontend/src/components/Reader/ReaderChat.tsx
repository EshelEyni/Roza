import { buildReaderChatView, readerPassageKey, type ReaderChatMessageView } from "../../services/readerChatPresentation";
import { ReaderChatQuote } from "./ReaderChatQuote";
import { scrollReaderChat, type ReaderChatScrollState } from "../../services/readerChatScroll";
import { readerAiLimits } from "../../services/readerAiLimits";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiMessageSquare,
  FiPlus,
  FiSend,
  FiSettings,
  FiTrash2,
} from "react-icons/fi";
import { useReaderChat } from "../../hooks/useReaderChat";
import { ReaderAiSettings } from "./ReaderAiSettings";

type ChatState = ReturnType<typeof useReaderChat>;
export function ReaderChat({
  chat,
  onClose,
}: {
  chat: ChatState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { draft: question, setDraft: setQuestion } = chat;
  const [deleteId, setDeleteId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messages = useRef<HTMLDivElement>(null);
  const scrollState = useRef<ReaderChatScrollState | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const disabled = chat.sending || chat.loading;
  useEffect(() => {
    setSettingsOpen(false);
  }, [chat.draftVersion]);
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, [chat.conversation?.id, chat.passage?.cfi]);
  useLayoutEffect(() => {
    const element = messages.current;
    if (!element) return;
    scrollState.current = scrollReaderChat(element, scrollState.current, chat.conversation, chat.pending?.id);
  }, [chat.conversation, chat.pending?.id, chat.sending, chat.history, settingsOpen]);
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
        <ReaderChatQuote key={readerPassageKey(message.passage)} passage={message.passage} sourceId={message.id} />
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
    <section className="reader-chat" aria-label={t("reader.chat.title")}>
      <div className="reader-chat-heading">
        <h2>{t("reader.chat.title")}</h2>
        <div className="reader-chat-actions">
          <button
            className="reader-button"
            disabled={disabled}
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
            disabled={disabled}
            onClick={() => {
              setSettingsOpen(false);
              void chat.loadHistory();
            }}
          >
            <FiMessageSquare />
            {t("reader.chat.saved")}
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
      {chat.loading && (
        <p className="reader-chat-status" role="status">
          {t("reader.chat.loading")}
        </p>
      )}
      {settingsOpen ? (
        <ReaderAiSettings onClose={() => setSettingsOpen(false)} />
      ) : chat.history ? (
        <div className="reader-chat-history">
          <button
            className="reader-button"
            disabled={disabled}
            onClick={() => chat.setHistory(false)}
          >
            <FiArrowLeft />
            {t("reader.chat.back")}
          </button>
          {!chat.loading && !chat.items.length && (
            <p>{t("reader.chat.noSaved")}</p>
          )}
          {chat.items.map(item => (
            <div className="reader-chat-history-item" key={item.id}>
              <button
                disabled={disabled}
                onClick={() => void chat.open(item.id)}
              >
                <strong dir="auto">{item.title}</strong>
                <time>{new Date(item.updatedAt).toLocaleDateString()}</time>
              </button>
              {deleteId === item.id ? (
                <div className="reader-chat-delete-confirm">
                  <span>{t("reader.chat.deleteConfirm")}</span>
                  <button
                    className="reader-button"
                    disabled={disabled}
                    onClick={() => {
                      void chat.remove(item.id);
                      setDeleteId("");
                    }}
                  >
                    {t("reader.chat.delete")}
                  </button>
                  <button
                    className="reader-button"
                    onClick={() => setDeleteId("")}
                  >
                    {t("reader.chat.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  className="reader-icon-button"
                  disabled={disabled}
                  aria-label={t("reader.chat.delete")}
                  onClick={() => setDeleteId(item.id)}
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          ))}
          {chat.cursor && (
            <button
              className="reader-button"
              disabled={disabled}
              onClick={() => void chat.loadHistory(chat.cursor!)}
            >
              {t("reader.chat.more")}
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="reader-chat-messages"
            ref={messages}
            role="log"
            aria-live="polite"
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
                <ReaderChatQuote key={readerPassageKey(view.draftPassage)} passage={view.draftPassage} draft />
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
            <label className="reader-sr-only" htmlFor="reader-chat-question">
              {t("reader.chat.question")}
            </label>
            <textarea
              id="reader-chat-question"
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
                disabled={disabled || !!chat.pending || (!question.trim() && !chat.passage?.text.trim())}
              >
                <FiSend />
                {t("reader.chat.send")}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
