import { model, Schema } from "mongoose";

const readerAiSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    answerLength: { type: String, enum: ["short", "standard", "detailed"], default: "short" },
    simpleLanguage: { type: Boolean, default: true },
    customInstructions: { type: String, maxlength: 1500, default: "" },
  },
  { timestamps: true },
);

const ReaderAiSettingsModel = model(
  "ReaderAiSettings",
  readerAiSettingsSchema,
  "reader_ai_settings",
);
export { ReaderAiSettingsModel };
