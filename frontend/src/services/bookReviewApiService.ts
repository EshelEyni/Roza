import { JsendResponse } from "../../../shared/types/system";
import { BookReview } from "../../../shared/types/books";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";
import { ReviewQueryParams } from "../types/app";

const baseUrl = "book-review";

async function query({
  limit = 10000,
  sort = "sortOrder",
  searchTerm = "",
}: ReviewQueryParams): Promise<BookReview[]> {
  let url = `${baseUrl}?limit=${limit}&sort=${sort}`;
  if (searchTerm) url += `&searchTerm=${searchTerm}`;
  const response = (await httpService.get(url)) as unknown as JsendResponse;
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

export default { query, getById, add, update };
