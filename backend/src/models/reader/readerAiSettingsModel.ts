import { model, Schema } from "mongoose";

import { readerAiConfig } from "../../services/reader/readerAiConfig";
import { readerAiModels } from "../../services/reader/readerAiModels";

const readerAiSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    model: { type: String, enum: readerAiModels, default: "default" },
    answerLength: { type: String, enum: ["short", "standard", "detailed"], default: "standard" },
    simpleLanguage: { type: Boolean, default: true },
    customInstructions: { type: String, maxlength: readerAiConfig.maxInstructionsChars, default: "" },
  },
  { timestamps: true },
);

const ReaderAiSettingsModel = model(
  "ReaderAiSettings",
  readerAiSettingsSchema,
  "reader_ai_settings",
);
export { ReaderAiSettingsModel };
