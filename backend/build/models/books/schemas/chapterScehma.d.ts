import { Schema } from "mongoose";
import { IChapter } from "../../../types/iTypes";
declare const chapterSchema: Schema<IChapter, import("mongoose").Model<IChapter, any, any, any, import("mongoose").Document<unknown, any, IChapter> & IChapter & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IChapter, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IChapter>> & import("mongoose").FlatRecord<IChapter> & Required<{
    _id: unknown;
}>>;
export { chapterSchema };
