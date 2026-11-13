import { model, Schema } from "mongoose";

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    unit: { type: String, enum: ["words", "sentences"], default: "words" },
    count: { type: Number, min: 1, validate: Number.isSafeInteger, default: 1 },
  },
  { timestamps: true },
);

export const ReaderKeyboardSettingsModel = model(
  "ReaderKeyboardSettings",
  schema,
  "reader_keyboard_settings",
);
