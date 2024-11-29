import { Schema } from "mongoose";
import { ICharacter } from "../../../types/iTypes";
declare const characterSchema: Schema<ICharacter, import("mongoose").Model<ICharacter, any, any, any, import("mongoose").Document<unknown, any, ICharacter> & ICharacter & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ICharacter, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<ICharacter>> & import("mongoose").FlatRecord<ICharacter> & Required<{
    _id: unknown;
}>>;
export { characterSchema };
