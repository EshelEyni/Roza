import { Schema } from "mongoose";
import { IReview } from "../../../types/iTypes";
declare const reviewSchema: Schema<IReview, import("mongoose").Model<IReview, any, any, any, import("mongoose").Document<unknown, any, IReview> & IReview & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IReview, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IReview>> & import("mongoose").FlatRecord<IReview> & Required<{
    _id: unknown;
}>>;
export { reviewSchema };
