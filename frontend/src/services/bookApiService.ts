import axios from "axios";
import { readOfflineBooks, saveOfflineBooks, withOfflineBook } from "./offlineBooks";
import { JsendResponse } from "../../../shared/types/system";
import type { Book, ManuscriptFilter, ManuscriptPage, ManuscriptSort } from "../../../shared/types/books";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";
import { BookQueryParams } from "../types/app";

const baseUrl = "book";

async function query({
  sort = "sortOrder",
  limit = 10000,
  searchTerm = "",
}: BookQueryParams): Promise<Book[]> {
  let url = `${baseUrl}?limit=${limit}&sort=${sort}`;
  if (searchTerm) url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
  const response = (await httpService.get(url)) as unknown as JsendResponse;

  return handleServerResponseData<Book[]>(response);
}

async function fetchManuscripts(
  q: string,
  sort: ManuscriptSort,
  filter: ManuscriptFilter,
  offset: number,
  signal: AbortSignal,
) {
  const response = await axios.get<JsendResponse<ManuscriptPage>>(`/api/${baseUrl}/manuscripts`, {
    params: { q, sort, filter, offset },
    signal,
    withCredentials: true,
  });
  return handleServerResponseData(response.data);
}

async function queryManuscripts(q: string, sort: ManuscriptSort, filter: ManuscriptFilter, offset: number, signal: AbortSignal) {
  return withOfflineBook<ManuscriptPage>(() => fetchManuscripts(q, sort, filter, offset, signal), async userId => {
    const snapshot = await readOfflineBooks("studio", userId);
    if (!snapshot) return;
    const term = q.trim().toLowerCase();
    const matches = snapshot.map(entry => entry.summary).filter(summary => summary.name.toLowerCase().includes(term));
    const shelves = {
      all: matches,
      writing: matches.filter(book => book.chapterCount > 0),
      blank: matches.filter(book => book.chapterCount === 0),
      epub: matches.filter(book => Boolean(book.readerBookId)),
    };
    const counts = { all: shelves.all.length, writing: shelves.writing.length, blank: shelves.blank.length, epub: shelves.epub.length };
    const manuscripts = shelves[filter];
    if (sort === "title") manuscripts.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "words") manuscripts.sort((a, b) => b.wordCount - a.wordCount);
    return { manuscripts: offset ? [] : manuscripts, total: manuscripts.length, counts, nextOffset: null };
  });
}

async function fetchBook(id: string, signal?: AbortSignal): Promise<Book> {
  try {
    const { data } = await axios.get<JsendResponse<Book>>(`/api/${baseUrl}/${id}`, {
      withCredentials: true, signal,
    });
    return handleServerResponseData(data);
  } catch (error) {
    if (axios.isAxiosError<JsendResponse<Book>>(error) && error.response?.data) {
      return handleServerResponseData(error.response.data);
    }
    throw error;
  }
}

function getById(id: string): Promise<Book> {
  return withOfflineBook(() => fetchBook(id), async userId =>
    (await readOfflineBooks("studio", userId))?.find(entry => entry.summary.id === id)?.book);
}

export async function refreshOfflineStudio(userId: string, signal: AbortSignal) {
  const previous = await readOfflineBooks("studio", userId);
  const { manuscripts } = await fetchManuscripts("", "recent", "all", 0, signal);
  const saved = [];
  for (const summary of manuscripts.slice(0, 6)) {
    const existing = previous?.find(entry => entry.summary.id === summary.id);
    const book = existing && existing.summary.updatedAt === summary.updatedAt ? existing.book : await fetchBook(summary.id, signal);
    saved.push({ summary, book });
  }
  if (!signal.aborted) await saveOfflineBooks("studio", userId, saved);
}

async function add(book: Book): Promise<Book> {
  const response = (await httpService.post(
    baseUrl,
    book,
  )) as unknown as JsendResponse;
  return handleServerResponseData<Book>(response);
}

async function update(book: Book): Promise<Book> {
  try {
    // Keep timeout scoped to manuscript writes; an uncertain response retains
    // the recovery draft and the server version check makes retries safe.
    // Publishing settings and the cover are saved by the Publish EPUB dialog.
    // Leaving them out keeps every autosave small.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { publishing, ...manuscript } = book;
    const response = await axios.patch<JsendResponse>(
      `/api/${baseUrl}/${book.id}`,
      manuscript,
      { withCredentials: true, timeout: 20000 },
    );
    return handleServerResponseData<Book>(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message ||
          "The save could not be confirmed. Check your connection and retry; your draft is kept locally when storage is available.",
      );
    }
    throw error;
  }
}

/** Archives a whole manuscript. It leaves the library but its data is kept. */
async function archive(id: string): Promise<void> {
  try {
    await axios.patch(`/api/${baseUrl}/${id}`, { isArchived: true }, { withCredentials: true });
  } catch (error) {
    if (axios.isAxiosError(error))
      throw new Error(error.response?.data?.message || "Unable to archive the manuscript. Please try again.");
    throw error;
  }
}

export default { query, queryManuscripts, getById, add, update, archive };
