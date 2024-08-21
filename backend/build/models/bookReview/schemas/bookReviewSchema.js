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
exports.bookReviewSchema = void 0;
const mongoose_1 = require("mongoose");
const referenceSchema_1 = require("./referenceSchema");
const reviewSchema_1 = require("./reviewSchema");
const slateElementSchema_1 = require("../../schemas/slateElementSchema");
const utilService_1 = require("../../../services/util/utilService");
const bookReviewSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, "Please provide a user Id"],
    },
    name: {
        type: String,
        required: [true, "Please provide a name"],
        trim: true,
    },
    reviews: [reviewSchema_1.reviewSchema],
    references: [referenceSchema_1.referenceSchema],
    structure: {
        type: [slateElementSchema_1.SlateCustomElementSchema],
        default: (0, utilService_1.getDefaultSlateElement)(),
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
    isArchived: {
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
exports.bookReviewSchema = bookReviewSchema;
bookReviewSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = this.get("userId");
        const lastSortOrder = (yield this.model("BookReview")
            .findOne({ userId }, {
            sortOrder: 1,
        }, { sort: { sortOrder: -1 }, lean: true })
            .exec());
        if (this.isNew && lastSortOrder)
            this.sortOrder = lastSortOrder.sortOrder + 1;
        next();
    });
});
bookReviewSchema.pre(/^find/, function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        this.find({ isArchived: { $ne: true } });
        next();
    });
});
bookReviewSchema.post(/^find/, function (data, next) {
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
    if (doc.reviews && doc.reviews.length)
        doc.reviews = doc.reviews.filter((r) => !r.isArchived);
    if (doc.references && doc.references.length)
        doc.references = doc.references.filter((r) => !r.isArchived);
}
bookReviewSchema.index({ name: "text", "reviews.text": "text", "references.text": "text" });
//# sourceMappingURL=bookReviewSchema.js.map