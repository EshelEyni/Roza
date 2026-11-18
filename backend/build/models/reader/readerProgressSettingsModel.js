"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderProgressSettingsModel = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true, unique: true },
    defaultProgressDisplay: { type: String, enum: ["percentage", "section", "book"], default: "percentage" },
}, { timestamps: true });
exports.ReaderProgressSettingsModel = (0, mongoose_1.model)("ReaderProgressSettings", schema, "reader_progress_settings");
//# sourceMappingURL=readerProgressSettingsModel.js.map