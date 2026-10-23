import { model } from "mongoose";
import { readerBookSchema } from "./schemas/readerBookSchema";
import { IReaderBook } from "../../types/iTypes";

const ReaderBookModel = model<IReaderBook>("ReaderBook", readerBookSchema, "reader_books");

export { ReaderBookModel };
