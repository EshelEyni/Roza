import { IBook } from "../../types/iTypes";
declare const BookModel: import("mongoose").Model<IBook, {}, {}, {}, import("mongoose").Document<unknown, {}, IBook> & IBook & Required<{
    _id: unknown;
}>, any>;
export { BookModel };
