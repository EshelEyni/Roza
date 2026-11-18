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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnnotation = exports.saveAnnotation = exports.listAnnotations = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const readerBookModel_1 = require("../../models/reader/readerBookModel");
const readerAnnotationModel_1 = require("../../models/reader/readerAnnotationModel");
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
// Shared types are ESM; keep runtime validation local to the CommonJS backend.
const annotationColors = ["none", "yellow", "green", "blue", "pink"];
function scope(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = (0, ALSService_1.getLoggedInUserIdFromReq)();
        if (!mongoose_1.default.isValidObjectId(req.params.id) ||
            !(yield readerBookModel_1.ReaderBookModel.exists({ _id: req.params.id, userId })))
            throw new errorService_1.AppError("Book not found.", 404);
        return { userId, bookId: req.params.id };
    });
}
const validCfi = (value) => typeof value === "string" &&
    value.length <= 4096 &&
    /^epubcfi\(\/6\/\d+(?:\[[^<>]*?\])?!\/[^<>]+\)$/.test(value);
exports.listAnnotations = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: yield readerAnnotationModel_1.ReaderAnnotationModel.find(filter) });
}));
exports.saveAnnotation = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    const { cfi, endCfi = "", text, chapter, color, note, flagged } = req.body;
    if ((flagged !== undefined && typeof flagged !== "boolean") ||
        !validCfi(cfi) ||
        (endCfi !== "" && !validCfi(endCfi)) ||
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 100000 ||
        typeof chapter !== "string" ||
        chapter.length > 1000 ||
        !annotationColors.includes(color) ||
        typeof note !== "string" ||
        note.length > 10000)
        throw new errorService_1.AppError("Invalid annotation.", 400);
    const data = Object.assign({ cfi, endCfi, text, chapter, color, note }, (flagged === undefined ? {} : { flagged }));
    const annotation = yield readerAnnotationModel_1.ReaderAnnotationModel.findOneAndUpdate(Object.assign(Object.assign({}, filter), { cfi, endCfi }), { $set: data }, { new: true, upsert: true, runValidators: true });
    res.json({ status: "success", data: annotation });
}));
exports.deleteAnnotation = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = yield scope(req);
    if (!mongoose_1.default.isValidObjectId(req.params.annotationId))
        throw new errorService_1.AppError("Annotation not found.", 404);
    const deleted = yield readerAnnotationModel_1.ReaderAnnotationModel.findOneAndDelete(Object.assign(Object.assign({}, filter), { _id: req.params.annotationId }));
    if (!deleted)
        throw new errorService_1.AppError("Annotation not found.", 404);
    res.json({ status: "success", data: null });
}));
//# sourceMappingURL=readerAnnotationController.js.map