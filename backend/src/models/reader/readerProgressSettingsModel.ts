import { model, Schema } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  defaultProgressDisplay: { type: String, enum: ["percentage", "section", "book"], default: "percentage" },
}, { timestamps: true });
export const ReaderProgressSettingsModel = model("ReaderProgressSettings", schema, "reader_progress_settings");
