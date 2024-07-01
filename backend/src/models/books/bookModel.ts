import { model } from "mongoose";
import { bookSchema } from "./schemas/bookSchema";
import { IBook } from "../../types/iTypes";

const BookModel = model<IBook>("Book", bookSchema, "books");

export { BookModel };
