import { BookReview } from "../../../shared/types/books";
import httpService from "./httpService";

async function get() {
  return await httpService.get("reviews");
}

async function add(book: BookReview) {
  try {
    return await httpService.post("reviews", book);
  } catch (error) {
    console.error("Error adding book review", error);
  }
}

export default {
  get,
  add,
};
