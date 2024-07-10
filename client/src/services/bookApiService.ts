import { JsendResponse, Book } from "@rozaeyni/common-types";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";
import { BookQueryParams } from "../types/app";

const baseUrl = "book";
const port = 3010;

async function query({
  sort = "sortOrder",
  limit = 10000,
  searchTerm = "",
}: BookQueryParams): Promise<Book[]> {
  let url = `${baseUrl}?limit=${limit}&sort=${sort}`;
  if (searchTerm) url += `&searchTerm=${searchTerm}`;

  const response = (await httpService.get({
    endpoint: url,
    port,
  })) as unknown as JsendResponse;

  return handleServerResponseData<Book[]>(response);
}

async function getById(id: string): Promise<Book> {
  const response = (await httpService.get({
    endpoint: `${baseUrl}/${id}`,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<Book>(response);
}

async function add(book: Book): Promise<Book> {
  const response = (await httpService.post({
    endpoint: `${baseUrl}`,
    data: book,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<Book>(response);
}

async function update(book: Book): Promise<Book> {
  const response = (await httpService.patch({
    endpoint: `${baseUrl}/${book.id}`,
    data: book,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<Book>(response);
}

async function remove(id: string): Promise<void> {
  const res = await httpService.delete({
    endpoint: `${baseUrl}/${id}`,
    port,
  });
  return res;
}

export default { query, getById, add, update, remove };
