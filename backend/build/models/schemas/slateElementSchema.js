"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlateCustomElementSchema = exports.SlateCustomTextSchema = void 0;
const mongoose_1 = require("mongoose");
const SlateCustomTextSchema = new mongoose_1.Schema({
    text: {
        type: String,
        required: true,
    },
    bold: {
        type: Boolean,
        default: false,
    },
    italic: {
        type: Boolean,
        default: false,
    },
    underline: {
        type: Boolean,
        default: false,
    },
});
exports.SlateCustomTextSchema = SlateCustomTextSchema;
const SlateCustomElementSchema = new mongoose_1.Schema({
    type: {
        type: String,
        required: true,
    },
    children: [
        {
            type: mongoose_1.Schema.Types.Mixed,
            default: [],
        },
    ],
    align: {
        type: String,
        enum: ["left", "center", "right", "justify"],
    },
});
exports.SlateCustomElementSchema = SlateCustomElementSchema;
//# sourceMappingURL=slateElementSchema.js.map