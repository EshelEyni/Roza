"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookSchema = void 0;
const mongoose_1 = require("mongoose");
const chapterScehma_1 = require("./chapterScehma");
const characterSchema_1 = require("./characterSchema");
const themeSchema_1 = require("./themeSchema");
const plotlineScheme_1 = require("./plotlineScheme");
const noteSchema_1 = require("./noteSchema");
const bookSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, "Please provide a user Id"],
    },
    name: {
        type: String,
        required: [true, "Please provide a name"],
        trim: true,
    },
    chapters: [chapterScehma_1.chapterSchema],
    characters: [characterSchema_1.characterSchema],
    themes: [themeSchema_1.themeSchema],
    plotlines: [plotlineScheme_1.plotlineSchema],
    notes: [noteSchema_1.noteSchema],
    filterBy: {
        type: String,
        enum: ["chapters", "characters", "themes", "plotlines", "notes"],
        default: "chapters",
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    isReadMode: {
        type: Boolean,
        default: false,
    },
}, {
    toObject: {
        virtuals: true,
        transform: (_, ret) => {
            delete ret._id;
            return ret;
        },
    },
    toJSON: {
        virtuals: true,
        transform: (_, ret) => {
            delete ret._id;
            return ret;
        },
    },
    timestamps: true,
});
exports.bookSchema = bookSchema;
bookSchema.index({
    name: "text",
    "chapters.text": "text",
    "characters.description": "text",
    "themes.description": "text",
    "plotlines.description": "text",
    "notes.text": "text",
});
bookSchema.pre(/^find/, function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        this.find({ isArchived: { $ne: true } });
        next();
    });
});
bookSchema.post(/^find/, function (data, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data)
            return next();
        if (Array.isArray(data))
            for (const doc of data)
                filterArchivedItems(doc);
        else
            filterArchivedItems(data);
        next();
    });
});
function filterArchivedItems(doc) {
    if (!doc)
        return;
    if (doc.chapters && doc.chapters.length)
        doc.chapters = doc.chapters.filter((c) => !c.isArchived);
    if (doc.characters && doc.characters.length)
        doc.characters = doc.characters.filter((c) => !c.isArchived);
    if (doc.themes && doc.themes.length)
        doc.themes = doc.themes.filter((t) => !t.isArchived);
    if (doc.plotlines && doc.plotlines.length)
        doc.plotlines = doc.plotlines.filter((p) => !p.isArchived);
    if (doc.notes && doc.notes.length)
        doc.notes = doc.notes.filter((n) => !n.isArchived);
}
//# sourceMappingURL=bookSchema.js.map