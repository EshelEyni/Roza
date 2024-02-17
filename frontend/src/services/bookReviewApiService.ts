import httpService from "./httpService";

async function getBooks() {
  return await httpService.get("books");
}

export default {
  getBooks,
};
