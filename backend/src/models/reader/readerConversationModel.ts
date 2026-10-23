import { model } from "mongoose";
import { IReaderConversation } from "../../types/iTypes";
import { readerConversationSchema } from "./schemas/readerConversationSchema";

const ReaderConversationModel = model<IReaderConversation>(
  "ReaderConversation",
  readerConversationSchema,
  "reader_conversations",
);
export { ReaderConversationModel };
