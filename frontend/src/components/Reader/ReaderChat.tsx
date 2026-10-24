import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [question, setQuestion] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messages = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const disabled = chat.sending || chat.loading;
  useEffect(() => {
    setQuestion("");
    setSettingsOpen(false);
    input.current?.focus();
  }, [chat.conversation?.id, chat.passage?.cfi]);
  useEffect(() => {
    const element = messages.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chat.conversation?.turns.length, chat.sending, chat.pending]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || disabled) return;
    // Leave the typed draft available on failure; retries reuse the saved request id.
    const retry = chat.pending?.question === text ? chat.pending.id : undefined;
    if (await chat.send(text, retry)) setQuestion("");
  }
  const turns = chat.conversation?.turns || [];
  const pendingIsSaved = turns.some(turn => turn.id === chat.pending?.id);
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
              setQuestion("");
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
          {chat.passage && (
            <details className="reader-chat-passage" open>
              <summary>{t("reader.chat.passage")}</summary>
              <blockquote dir="auto">{chat.passage.text}</blockquote>
            </details>
          )}
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
            {turns.map(turn => (
              <div className="reader-chat-turn" key={turn.id}>
                <div className="reader-chat-message reader-chat-question">
                  <span>{t("reader.chat.you")}</span>
                  <p dir="auto">{turn.question}</p>
                </div>
                {turn.status === "completed" ? (
                  <div className="reader-chat-message reader-chat-answer">
                    <span>{t("reader.chat.assistant")}</span>
                    <p dir="auto">{turn.answer}</p>
                  </div>
                ) : (
                  <div className="reader-chat-status">
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
            {chat.pending && !pendingIsSaved && (
              <div className="reader-chat-message reader-chat-question">
                <span>{t("reader.chat.you")}</span>
                <p dir="auto">{chat.pending.question}</p>
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
          </div>
          <form
            className="reader-chat-compose"
            onSubmit={event => void submit(event)}
          >
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
              ref={input}
              dir="auto"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder={t("reader.chat.question")}
              maxLength={2000}
              disabled={disabled}
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
                disabled={disabled || !question.trim()}
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
