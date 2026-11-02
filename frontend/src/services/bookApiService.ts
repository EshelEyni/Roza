import axios from "axios";
import { JsendResponse } from "../../../shared/types/system";
import { Book } from "../../../shared/types/books";
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
    const response = await axios.patch<JsendResponse>(
      `/api/${baseUrl}/${book.id}`,
      book,
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

export default { query, getById, add, update };
