import type { ReaderConversation } from "../../../shared/types/readerChat";

export type ReaderChatScrollState = {
  container: HTMLElement;
  conversationId?: string;
  completedIds: Set<string>;
  pendingId?: string;
};

/** Move only the chat viewport: new answers start at their first line. */
export function scrollReaderChat(
  container: HTMLElement,
  previous: ReaderChatScrollState | null,
  conversation: ReaderConversation | null,
  pendingId?: string,
): ReaderChatScrollState {
  const completed = (conversation?.turns || []).filter(turn => turn.status === "completed");
  const opened = previous?.container !== container || previous?.conversationId !== conversation?.id;
  const newAnswers = opened ? completed : completed.filter(turn => !previous?.completedIds.has(turn.id));
  const target = newAnswers.find(turn => turn.id === previous?.pendingId) || newAnswers[newAnswers.length - 1];

  if (target) {
    // Compare dataset values rather than interpolating saved IDs into a CSS selector.
    const answer = Array.from(container.querySelectorAll<HTMLElement>("[data-reader-chat-answer]"))
      .find(element => element.dataset.readerChatAnswer === target.id);
    if (answer) {
      container.scrollTop += answer.getBoundingClientRect().top -
        container.getBoundingClientRect().top - container.clientTop;
    }
  } else if (opened || (pendingId && pendingId !== previous?.pendingId)) {
    // While waiting, reveal the submitted question and loading indicator.
    container.scrollTop = container.scrollHeight;
  }

  return {
    container, conversationId: conversation?.id,
    completedIds: new Set(completed.map(turn => turn.id)), pendingId,
  };
}
