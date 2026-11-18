import { Document, Schema } from "mongoose";
import { IBook } from "../../../types/iTypes";
declare const bookSchema: Schema<IBook, import("mongoose").Model<IBook, any, any, any, Document<unknown, any, IBook> & IBook & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IBook, Document<unknown, {}, import("mongoose").FlatRecord<IBook>> & import("mongoose").FlatRecord<IBook> & Required<{
    _id: unknown;
}>>;
export { bookSchema };
