export type ReaderPassage = { cfi: string; text: string; endCfi?: string };
export type ReaderChatTurn = {
  id: string;
  question: string;
  answer: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
};
export type ReaderConversationSummary = {
  id: string;
  title: string;
  passage?: ReaderPassage;
  spoilersAllowed: boolean;
  createdAt: string;
  updatedAt: string;
};
export type ReaderConversation = ReaderConversationSummary & { turns: ReaderChatTurn[] };
