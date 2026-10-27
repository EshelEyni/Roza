import type { ReaderChatTurn, ReaderPassage } from "../../../shared/types/readerChat";

type PendingMessage = { id: string; question: string; passage?: ReaderPassage };
export type ReaderChatMessageView = {
  id: string;
  question?: string;
  passage?: ReaderPassage;
  referenceId?: string;
};
export function readerPassageKey(passage: ReaderPassage): string {
  return JSON.stringify([passage.cfi, passage.endCfi || "", passage.text]);
}

/** A presentation-only projection. Never change stored questions, passages or API data. */
export function buildReaderChatView(
  turns: ReaderChatTurn[], conversationPassage?: ReaderPassage,
  pending?: PendingMessage | null, attached?: ReaderPassage,
) {
  const sources = new Map<string, string>();
  // Old conversations have only a conversation-level passage. Do not use the
  // latest conversation passage to guess missing sources in mixed newer records.
  const legacyPassage = turns.some(turn => turn.passage) ? undefined : conversationPassage;
  const present = (message: PendingMessage, fallback?: ReaderPassage): ReaderChatMessageView => {
    const passage = message.passage || fallback;
    const text = passage?.text.trim();
    const question = message.question.trim();
    const view: ReaderChatMessageView = {
      id: message.id,
      question: question && question !== text ? message.question : undefined,
    };
    if (passage && text) {
      const key = readerPassageKey(passage);
      const previousId = sources.get(key);
      if (previousId) view.referenceId = previousId;
      else {
        sources.set(key, message.id);
        view.passage = passage;
      }
    }
    return view;
  };
  const entries = turns.map(turn => ({ turn, message: present(turn, legacyPassage) }));
  const pendingMessage = pending && !turns.some(turn => turn.id === pending.id)
    ? present(pending, turns.length === 0 ? attached || conversationPassage : undefined)
    : undefined;
  const attachedReferenceId = attached ? sources.get(readerPassageKey(attached)) : undefined;
  return {
    entries,
    pending: pendingMessage,
    draftPassage: !pending && attached?.text.trim() && !attachedReferenceId ? attached : undefined,
    attachedReferenceId,
  };
}
