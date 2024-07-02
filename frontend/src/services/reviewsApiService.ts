import { JsendResponse } from "../../../shared/types/system";
import { BookReview } from "../../../shared/types/books";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "review";

async function query(userId: string): Promise<BookReview[]> {
  const response = (await httpService.get(
    `${baseUrl}?userId=${userId}&limit=1000`,
  )) as unknown as JsendResponse;
  return handleServerResponseData<BookReview[]>(response);
}

async function getById(id: string): Promise<BookReview> {
  const response = (await httpService.get(
    `${baseUrl}/${id}`,
  )) as unknown as JsendResponse;
  return handleServerResponseData<BookReview>(response);
}

async function add(review: BookReview): Promise<BookReview> {
  const response = (await httpService.post(
    baseUrl,
    review,
  )) as unknown as JsendResponse;
  return handleServerResponseData<BookReview>(response);
}

async function update(review: BookReview): Promise<BookReview> {
  const response = (await httpService.patch(
    `${baseUrl}/${review.id}`,
    review,
  )) as unknown as JsendResponse;
  return handleServerResponseData<BookReview>(response);
}

async function remove(id: string): Promise<void> {
  const res = await httpService.delete(`${baseUrl}/${id}`);
  return res;
}

export default { query, getById, add, update, remove };
