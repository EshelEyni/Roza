import {
  getOne,
  createOne,
  updateOne,
  deleteOne,
  getAll,
} from "../../services/factory/factoryService";
import { BookModel } from "../../models/books/bookModel";

const getBooks = getAll(BookModel);
const getBookById = getOne(BookModel);
const addBook = createOne(BookModel);
const updateBook = updateOne(BookModel);
const removeBook = deleteOne(BookModel);

export { getBooks, getBookById, addBook, updateBook, removeBook };
