import { model } from "mongoose";
import { readerVocabularySchema, readerLookupSchema } from "./schemas/readerVocabularySchema";

export const ReaderVocabularyModel = model(
  "ReaderVocabulary",
  readerVocabularySchema,
  "reader_vocabulary",
);
export const ReaderLookupModel = model("ReaderLookup", readerLookupSchema, "reader_lookups");
