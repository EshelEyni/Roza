import { JsendResponse } from "../../../shared/types/system";
import { Book } from "../../../shared/types/books";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "book";

async function query(userId: string): Promise<Book[]> {
  const response = (await httpService.get(
    `${baseUrl}?userId=${userId}`,
  )) as unknown as JsendResponse;
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
  const response = (await httpService.patch(
    `${baseUrl}/${book.id}`,
    book,
  )) as unknown as JsendResponse;
  return handleServerResponseData<Book>(response);
}

async function remove(id: string): Promise<void> {
  const res = await httpService.delete(`${baseUrl}/${id}`);
  return res;
}

export default { query, getById, add, update, remove };
