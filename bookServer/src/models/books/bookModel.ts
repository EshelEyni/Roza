import { model } from "mongoose";
import { bookSchema } from "./schemas/bookSchema";
import { IBook } from "@rozaeyni/common";

const BookModel = model<IBook>("Book", bookSchema, "books");

export { BookModel };
