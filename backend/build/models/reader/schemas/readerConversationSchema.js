"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerConversationSchema = void 0;
const mongoose_1 = require("mongoose");
const readerAiConfig_1 = require("../../../services/reader/readerAiConfig");
const readerConversationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    bookId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 100 },
    passage: {
        type: new mongoose_1.Schema({
            cfi: { type: String, required: true },
            text: { type: String, required: true },
            endCfi: String,
        }, { _id: false }),
        default: undefined,
    },
    memorySummary: {
        type: new mongoose_1.Schema({
            text: { type: String, required: true, maxlength: readerAiConfig_1.readerAiConfig.maxSummaryChars },
            turnIds: [String], sourceHashes: [String],
            spoilersAllowed: { type: Boolean, required: true },
            model: { type: String, required: true }, createdAt: { type: Date, required: true },
        }, { _id: false }),
        default: undefined,
    },
    contextSummaryFailed: { type: Boolean, default: false },
    contextOmittedTurns: { type: Number, default: 0 },
    spoilersAllowed: { type: Boolean, default: false },
    lockedUntil: { type: Date, default: new Date(0), select: false },
    lockToken: { type: String, select: false },
    turns: [
        {
            _id: false,
            id: { type: String, required: true },
            question: {
                type: String, default: "", maxlength: readerAiConfig_1.readerAiConfig.maxQuestionChars,
                validate: {
                    validator: function (value) {
                        var _a, _b;
                        return typeof value === "string" && (!!value.trim() || !!((_b = (_a = this.passage) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.trim()));
                    },
                    message: "A question or selected passage is required.",
                },
            },
            currentCfi: { type: String, required: true },
            spoilersAllowed: { type: Boolean, default: false },
            answer: { type: String, default: "", maxlength: readerAiConfig_1.readerAiConfig.maxAnswerChars },
            status: { type: String, enum: ["pending", "completed", "failed"], required: true },
            passage: {
                type: new mongoose_1.Schema({ cfi: String, endCfi: String, text: String }, { _id: false }),
                default: undefined,
            },
            excerpts: { type: [new mongoose_1.Schema({ label: String, text: String }, { _id: false })], default: undefined },
            createdAt: { type: Date, default: Date.now },
        },
    ],
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_document, result) => {
            delete result._id;
            delete result.__v;
            delete result.userId;
            delete result.lockedUntil;
            delete result.lockToken;
            delete result.memorySummary;
            return result;
        },
    },
});
exports.readerConversationSchema = readerConversationSchema;
readerConversationSchema.index({ userId: 1, bookId: 1, updatedAt: -1, _id: -1 });
//# sourceMappingURL=readerConversationSchema.js.map