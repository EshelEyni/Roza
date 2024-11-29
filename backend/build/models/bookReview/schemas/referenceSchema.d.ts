import { Schema } from "mongoose";
import { IReference } from "../../../types/iTypes";
declare const referenceSchema: Schema<IReference, import("mongoose").Model<IReference, any, any, any, import("mongoose").Document<unknown, any, IReference> & IReference & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IReference, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IReference>> & import("mongoose").FlatRecord<IReference> & Required<{
    _id: unknown;
}>>;
export { referenceSchema };
