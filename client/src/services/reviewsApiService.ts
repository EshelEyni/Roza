import { JsendResponse, BookReview } from "@rozaeyni/common-types";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";
import { ReviewQueryParams } from "../types/app";

const baseUrl = "book-review";
const port = 3020;

async function query({
  limit = 10000,
  sort = "sortOrder",
  searchTerm = "",
}: ReviewQueryParams): Promise<BookReview[]> {
  let url = `${baseUrl}?limit=${limit}&sort=${sort}`;
  if (searchTerm) url += `&searchTerm=${searchTerm}`;
  const response = (await httpService.get({
    endpoint: url,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<BookReview[]>(response);
}

async function getById(id: string): Promise<BookReview> {
  const response = (await httpService.get({
    endpoint: `${baseUrl}/${id}`,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<BookReview>(response);
}

async function add(review: BookReview): Promise<BookReview> {
  const response = (await httpService.post({
    endpoint: `${baseUrl}`,
    data: review,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<BookReview>(response);
}

async function update(review: BookReview): Promise<BookReview> {
  const response = (await httpService.patch({
    endpoint: `${baseUrl}/${review.id}`,
    data: review,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<BookReview>(response);
}

async function remove(id: string): Promise<void> {
  const res = await httpService.delete({
    endpoint: `${baseUrl}/${id}`,
    port,
  });
  return res;
}

export default { query, getById, add, update, remove };
