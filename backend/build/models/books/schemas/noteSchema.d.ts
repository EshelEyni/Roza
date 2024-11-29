import { Schema } from "mongoose";
import { INote } from "../../../types/iTypes";
declare const noteSchema: Schema<INote, import("mongoose").Model<INote, any, any, any, import("mongoose").Document<unknown, any, INote> & INote & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, INote, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<INote>> & import("mongoose").FlatRecord<INote> & Required<{
    _id: unknown;
}>>;
export { noteSchema };
