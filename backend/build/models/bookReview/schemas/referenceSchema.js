"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceSchema = void 0;
const mongoose_1 = require("mongoose");
const slateElementSchema_1 = require("../../schemas/slateElementSchema");
const utilService_1 = require("../../../services/util/utilService");
const referenceSchema = new mongoose_1.Schema({
    pages: {
        type: String,
        default: "",
    },
    text: {
        type: [slateElementSchema_1.SlateCustomElementSchema],
        default: (0, utilService_1.getDefaultSlateElement)(),
    },
    imgs: {
        type: [String],
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    isMinimized: {
        type: Boolean,
        default: false,
    },
}, {
    toObject: {
        virtuals: true,
    },
    toJSON: {
        virtuals: true,
    },
    timestamps: true,
});
exports.referenceSchema = referenceSchema;
//# sourceMappingURL=referenceSchema.js.map