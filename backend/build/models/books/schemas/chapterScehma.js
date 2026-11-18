"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chapterSchema = void 0;
const taskBoardSchema_1 = require("./taskBoardSchema");
const mongoose_1 = require("mongoose");
const slateElementSchema_1 = require("../../schemas/slateElementSchema");
const utilService_1 = require("../../../services/util/utilService");
const pointSchema = new mongoose_1.Schema({
    path: {
        type: [Number],
        required: true,
        validate: (path) => path.length > 0 && path.every((n) => Number.isInteger(n) && n >= 0),
    },
    offset: {
        type: Number,
        required: true,
        min: 0,
        validate: Number.isInteger,
    },
}, { _id: false });
const annotationSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    general: { type: Boolean, default: undefined },
    content: { type: String, default: "", maxlength: 50000 },
    quote: { type: String, default: "", maxlength: 500 },
    anchor: {
        type: new mongoose_1.Schema({
            anchor: { type: pointSchema, required: true },
            focus: { type: pointSchema, required: true },
        }, { _id: false }),
        default: null,
    },
}, { _id: false });
const linkSchema = new mongoose_1.Schema({
    entityId: { type: String, required: true, match: /^[a-f0-9]{24}$/i },
    note: { type: String, default: "", maxlength: 50000 },
}, { _id: false });
const planningSchema = new mongoose_1.Schema({
    themes: [linkSchema],
    plotlines: [linkSchema],
    characters: [linkSchema],
}, { _id: false });
const draftSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    chapterId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    text: { type: [slateElementSchema_1.SlateCustomElementSchema], required: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    annotations: { type: [annotationSchema], default: undefined },
    format: { type: String, enum: ["prose", "screenplay"] },
}, { _id: false });
const chapterSchema = new mongoose_1.Schema({
    drafts: { type: [draftSchema], default: undefined },
    taskBoard: { type: taskBoardSchema_1.taskBoardSchema, default: undefined },
    planning: { type: planningSchema, default: undefined },
    annotations: { type: [annotationSchema], default: undefined },
    bookId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, "Please provide a book id"],
    },
    format: { type: String, enum: ["prose", "screenplay"], default: "prose" },
    name: {
        type: String,
        default: "פרק חדש",
        trim: true,
    },
    description: {
        type: [slateElementSchema_1.SlateCustomElementSchema],
        default: (0, utilService_1.getDefaultSlateElement)(),
    },
    text: {
        type: [slateElementSchema_1.SlateCustomElementSchema],
        default: (0, utilService_1.getDefaultSlateElement)(),
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    type: {
        type: String,
        enum: ["chapters"],
        default: "chapters",
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
exports.chapterSchema = chapterSchema;
//# sourceMappingURL=chapterScehma.js.map