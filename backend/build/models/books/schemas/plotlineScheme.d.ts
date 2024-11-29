import { Schema } from "mongoose";
import { IPlotline } from "../../../types/iTypes";
declare const plotlineSchema: Schema<IPlotline, import("mongoose").Model<IPlotline, any, any, any, import("mongoose").Document<unknown, any, IPlotline> & IPlotline & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IPlotline, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IPlotline>> & import("mongoose").FlatRecord<IPlotline> & Required<{
    _id: unknown;
}>>;
export { plotlineSchema };
