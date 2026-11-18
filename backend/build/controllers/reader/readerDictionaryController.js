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
exports.lookupReaderDictionary = void 0;
const googleTranslateService_1 = require("../../services/reader/googleTranslateService");
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const readerBookModel_1 = require("../../models/reader/readerBookModel");
const readerVocabularyModel_1 = require("../../models/reader/readerVocabularyModel");
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const readerDictionaryService_1 = require("../../services/reader/readerDictionaryService");
exports.lookupReaderDictionary = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader("Cache-Control", "private, no-store");
    const { word, requestId, location = "", pageLocation, provider = "auto", passage = false } = req.body;
    if (provider !== "auto" && provider !== "google")
        throw new errorService_1.AppError("Invalid dictionary provider.", 400);
    if (typeof word !== "string" ||
        typeof passage !== "boolean" ||
        (passage ? !word.trim() || word.length > 20000 || provider !== "google" :
            word.length > 80 || !/^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(word.trim())) ||
        typeof requestId !== "string" ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(requestId) ||
        (pageLocation !== undefined &&
            (typeof pageLocation !== "string" ||
                pageLocation.length > 4096 ||
                !/^epubcfi\([^<>]*\)$/.test(pageLocation))) ||
        typeof location !== "string" ||
        location.length > 4096 ||
        (location && !/^epubcfi\([^<>]*\)$/.test(location))) {
        throw new errorService_1.AppError("Select a single English word.", 400);
    }
    const userId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    if (!mongoose_1.default.isValidObjectId(req.params.id) ||
        !(yield readerBookModel_1.ReaderBookModel.exists({ _id: req.params.id, userId }))) {
        throw new errorService_1.AppError("Book not found.", 404);
    }
    if (passage) {
        const entry = yield (0, googleTranslateService_1.translateReaderWord)(word, true);
        res.json({ status: "success", data: { entry } });
        return;
    }
    const entry = yield (0, readerDictionaryService_1.lookupReaderWordWithTranslation)(word, provider);
    if (!entry) {
        res.json({ status: "success", data: { entry: null } });
        return;
    }
    const saveVocabulary = () => __awaiter(void 0, void 0, void 0, function* () {
        const stableLocation = pageLocation || location;
        // Reuse the existing unique event index for atomic page/word deduplication.
        // Historical events are untouched; new events use a separate deterministic ID namespace.
        const identity = {
            userId,
            requestId: stableLocation
                ? "page-" +
                    (0, crypto_1.createHash)("sha256")
                        .update(JSON.stringify([userId, req.params.id, (0, readerDictionaryService_1.normalizeReaderWord)(word), stableLocation]))
                        .digest("hex")
                : requestId,
        };
        try {
            yield readerVocabularyModel_1.ReaderLookupModel.updateOne(identity, {
                $setOnInsert: Object.assign(Object.assign({}, identity), { word: entry.word, headword: entry.headword, provider, bookId: req.params.id, location: stableLocation }),
            }, { upsert: true });
        }
        catch (error) {
            if (error.code !== 11000)
                throw error;
        }
        const event = yield readerVocabularyModel_1.ReaderLookupModel.findOne(identity).orFail();
        if (event.word !== entry.word ||
            String(event.bookId) !== req.params.id ||
            event.location !== stableLocation) {
            throw new errorService_1.AppError("This lookup request belongs to another selection.", 409);
        }
        const filter = { userId, headword: event.headword };
        const lookupCount = yield readerVocabularyModel_1.ReaderLookupModel.countDocuments(filter);
        // Count from durable unique events, so a retry also repairs an interrupted vocabulary write.
        const update = {
            $set: { entry: Object.assign(Object.assign({}, entry), { headword: event.headword }) },
            $max: { lookupCount, lastLookedUpAt: event.createdAt },
            $min: { firstLookedUpAt: event.createdAt },
            $addToSet: { observedForms: entry.word, bookIds: event.bookId },
        };
        try {
            yield readerVocabularyModel_1.ReaderVocabularyModel.updateOne(filter, update, { upsert: true });
        }
        catch (error) {
            if (error.code !== 11000)
                throw error;
            yield readerVocabularyModel_1.ReaderVocabularyModel.updateOne(filter, update);
        }
        const vocabulary = yield readerVocabularyModel_1.ReaderVocabularyModel.findOne(filter).orFail();
        return vocabulary.lookupCount;
    });
    let timer;
    try {
        const lookupCount = yield Promise.race([
            saveVocabulary().catch(error => {
                if (error instanceof errorService_1.AppError && error.statusCode === 409)
                    throw error;
                return undefined;
            }),
            new Promise(resolve => {
                timer = setTimeout(() => resolve(undefined), 3000);
            }),
        ]);
        res.json({ status: "success", data: { entry, lookupCount } });
    }
    finally {
        clearTimeout(timer);
    }
}));
//# sourceMappingURL=readerDictionaryController.js.map