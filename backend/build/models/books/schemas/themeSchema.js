"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeSchema = void 0;
const mongoose_1 = require("mongoose");
const slateElementSchema_1 = require("../../schemas/slateElementSchema");
const utilService_1 = require("../../../services/util/utilService");
const themeSchema = new mongoose_1.Schema({
    bookId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, "Please provide a book id"],
    },
    name: {
        type: String,
        required: [true, "Please provide a name"],
        trim: true,
    },
    description: {
        type: [slateElementSchema_1.SlateCustomElementSchema],
        default: (0, utilService_1.getDefaultSlateElement)(),
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    type: {
        type: String,
        enum: ["themes"],
        default: "themes",
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
exports.themeSchema = themeSchema;
//# sourceMappingURL=themeSchema.js.map