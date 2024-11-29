import { Document, Schema } from "mongoose";
import { IBookReview } from "../../../types/iTypes";
declare const bookReviewSchema: Schema<IBookReview, import("mongoose").Model<IBookReview, any, any, any, Document<unknown, any, IBookReview> & IBookReview & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IBookReview, Document<unknown, {}, import("mongoose").FlatRecord<IBookReview>> & import("mongoose").FlatRecord<IBookReview> & Required<{
    _id: unknown;
}>>;
export { bookReviewSchema };
