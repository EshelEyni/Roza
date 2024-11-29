import { Schema } from "mongoose";
import { ITheme } from "../../../types/iTypes";
declare const themeSchema: Schema<ITheme, import("mongoose").Model<ITheme, any, any, any, import("mongoose").Document<unknown, any, ITheme> & ITheme & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ITheme, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<ITheme>> & import("mongoose").FlatRecord<ITheme> & Required<{
    _id: unknown;
}>>;
export { themeSchema };
