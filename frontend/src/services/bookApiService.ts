import axios from "axios";
import { JsendResponse } from "../../../shared/types/system";
import type { Book, ManuscriptPage, ManuscriptSort } from "../../../shared/types/books";
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

async function queryManuscripts(q: string, sort: ManuscriptSort, offset: number, signal: AbortSignal) {
  const response = await axios.get<JsendResponse<ManuscriptPage>>(`/api/${baseUrl}/manuscripts`, {
    params: { q, sort, offset },
    signal,
    withCredentials: true,
  });
  return handleServerResponseData(response.data);
}

async function getById(id: string): Promise<Book> {
  const response = (await httpService.get(
    `${baseUrl}/${id}`,
  )) as unknown as JsendResponse;
  return handleServerResponseData<Book>(response);
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
