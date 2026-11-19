import type { SlateCustomElement } from "../../../shared/types/books";
import type {
  ReaderDocument,
  ReaderDocumentSummary,
  ReaderDocumentUpdate,
} from "../../../shared/types/readerDocuments";
import readerApiService from "./readerApiService";

const base = (bookId: string) => "/" + bookId + "/documents";

/** Saves that outlive a closed panel; reopening waits so it never shows stale text. */
const settling = new Map<string, Promise<unknown>>();

export function trackDocumentSave<T>(documentId: string, save: Promise<T>) {
  const done = save.catch(() => undefined).finally(() => {
    if (settling.get(documentId) === done) settling.delete(documentId);
  });
  settling.set(documentId, done);
  return save;
}

export default {
  list: (bookId: string) =>
    readerApiService.request<ReaderDocumentSummary[]>("GET", base(bookId)),
  get: async (bookId: string, documentId: string) => {
    await settling.get(documentId);
    return readerApiService.request<ReaderDocument>("GET", base(bookId) + "/" + documentId);
  },
  create: (bookId: string, title: string) =>
    readerApiService.request<ReaderDocument>("POST", base(bookId), { title }),
  update: (bookId: string, documentId: string, update: ReaderDocumentUpdate) =>
    readerApiService.request<ReaderDocumentSummary>("PATCH", base(bookId) + "/" + documentId, update),
  saveContent: (bookId: string, documentId: string, content: SlateCustomElement[]) =>
    trackDocumentSave(
      documentId,
      readerApiService.request<ReaderDocumentSummary>("PATCH", base(bookId) + "/" + documentId, { content }),
    ),
  remove: (bookId: string, documentId: string) =>
    readerApiService.request<null>("DELETE", base(bookId) + "/" + documentId),
};
