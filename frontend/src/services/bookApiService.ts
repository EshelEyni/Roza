import { Book } from "../../../shared/types/books";
import httpService from "./httpService";

async function get() {
  return await httpService.get("books");
}

async function getById(id: string) {
  return await httpService.get(`books/${id}`);
}

async function add(book: Book) {
  try {
    return await httpService.post("books", book);
  } catch (error) {
    console.error("Error adding book", error);
  }
}

async function update(book: Book) {
  try {
    return await httpService.patch("books", book);
  } catch (error) {
    console.error("Error updating book", error);
  }
}

export default {
  get,
  getById,
  add,
  update,
};
