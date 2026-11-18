"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderFlagModel = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    bookId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    cfi: { type: String, required: true, maxlength: 4096 },
    endCfi: { type: String, default: "", maxlength: 4096 },
    text: { type: String, required: true, maxlength: 100000 },
    chapter: { type: String, default: "", maxlength: 1000 },
    context: { type: String, default: "", maxlength: 100000 },
    reviewed: { type: Boolean, default: false },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, result) => {
            delete result._id;
            delete result.__v;
            delete result.userId;
        },
    },
});
schema.index({ userId: 1, bookId: 1, cfi: 1, endCfi: 1 }, { unique: true });
exports.ReaderFlagModel = (0, mongoose_1.model)("ReaderFlag", schema, "reader_flags");
//# sourceMappingURL=readerFlagModel.js.map