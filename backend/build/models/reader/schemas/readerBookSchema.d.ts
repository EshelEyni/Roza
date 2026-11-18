import { Schema } from "mongoose";
import { IReaderBook } from "../../../types/iTypes";
declare const readerBookSchema: Schema<IReaderBook, import("mongoose").Model<IReaderBook, any, any, any, import("mongoose").Document<unknown, any, IReaderBook> & IReaderBook & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IReaderBook, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IReaderBook>> & import("mongoose").FlatRecord<IReaderBook> & Required<{
    _id: unknown;
}>>;
export { readerBookSchema };
