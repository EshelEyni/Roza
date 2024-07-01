import { Book } from "../../../shared/types/books";
import httpService from "./httpService";

async function get() {
  return await httpService.get("book");
}

async function getById(id: string) {
  console.log("id", id);
  return await httpService.get(`book/${id}`);
}

async function add(book: Book) {
  try {
    return await httpService.post("book", book);
  } catch (error) {
    console.error("Error adding book", error);
  }
}

async function update(book: Book) {
  try {
    return await httpService.patch("book", book);
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
