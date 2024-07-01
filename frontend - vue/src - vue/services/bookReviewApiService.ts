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

async function update(book: BookReview) {
  try {
    return await httpService.patch("reviews", book);
  } catch (error) {
    console.error("Error updating book review", error);
  }
}

export default {
  get,
  add,
  update,
};
