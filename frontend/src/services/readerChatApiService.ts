import {
  ReaderConversation,
  ReaderConversationSummary,
} from "../../../shared/types/readerChat";
import readerApiService from "./readerApiService";

const path = (bookId: string) => "/" + bookId + "/conversations";
export default {
  list: (bookId: string, before?: string) =>
    readerApiService.request<{
      items: ReaderConversationSummary[];
      nextCursor: string | null;
    }>("GET", path(bookId) + (before ? "?before=" + before : "")),
  create: (bookId: string, passageCfi?: string, passageEndCfi?: string) =>
    readerApiService.request<ReaderConversation>("POST", path(bookId), {
      passageCfi,
      passageEndCfi,
    }),
  getById: (bookId: string, id: string) =>
    readerApiService.request<ReaderConversation>(
      "GET",
      path(bookId) + "/" + id,
    ),
  remove: (bookId: string, id: string) =>
    readerApiService.request<null>("DELETE", path(bookId) + "/" + id),
  send: (
    bookId: string,
    id: string,
    message: {
      requestId: string;
      question: string;
      currentCfi: string;
      spoilersAllowed: boolean;
    },
  ) =>
    readerApiService.request<ReaderConversation>(
      "POST",
      path(bookId) + "/" + id + "/messages",
      message,
    ),
};
