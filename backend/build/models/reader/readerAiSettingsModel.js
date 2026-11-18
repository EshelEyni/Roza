"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderAiSettingsModel = void 0;
const mongoose_1 = require("mongoose");
const readerAiConfig_1 = require("../../services/reader/readerAiConfig");
const readerAiModels_1 = require("../../services/reader/readerAiModels");
const readerAiSettingsSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true, unique: true },
    model: { type: String, enum: readerAiModels_1.readerAiModels, default: "default" },
    answerLength: { type: String, enum: ["short", "standard", "detailed"], default: "standard" },
    simpleLanguage: { type: Boolean, default: true },
    customInstructions: { type: String, maxlength: readerAiConfig_1.readerAiConfig.maxInstructionsChars, default: "" },
}, { timestamps: true });
const ReaderAiSettingsModel = (0, mongoose_1.model)("ReaderAiSettings", readerAiSettingsSchema, "reader_ai_settings");
exports.ReaderAiSettingsModel = ReaderAiSettingsModel;
//# sourceMappingURL=readerAiSettingsModel.js.map