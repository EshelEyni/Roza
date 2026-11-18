import { Schema } from "mongoose";
import { IReaderConversation } from "../../../types/iTypes";
declare const readerConversationSchema: Schema<IReaderConversation, import("mongoose").Model<IReaderConversation, any, any, any, import("mongoose").Document<unknown, any, IReaderConversation> & IReaderConversation & Required<{
    _id: unknown;
}>, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IReaderConversation, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IReaderConversation>> & import("mongoose").FlatRecord<IReaderConversation> & Required<{
    _id: unknown;
}>>;
export { readerConversationSchema };
