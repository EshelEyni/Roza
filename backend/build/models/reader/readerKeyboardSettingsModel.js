"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderKeyboardSettingsModel = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true, unique: true },
    unit: { type: String, enum: ["words", "sentences"], default: "words" },
    count: { type: Number, min: 1, validate: Number.isSafeInteger, default: 1 },
}, { timestamps: true });
exports.ReaderKeyboardSettingsModel = (0, mongoose_1.model)("ReaderKeyboardSettings", schema, "reader_keyboard_settings");
//# sourceMappingURL=readerKeyboardSettingsModel.js.map