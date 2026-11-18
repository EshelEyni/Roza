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
exports.normalizeReaderWord = normalizeReaderWord;
exports.lookupReaderWord = lookupReaderWord;
exports.lookupReaderWordWithTranslation = lookupReaderWordWithTranslation;
const fs_1 = __importDefault(require("fs"));
const errorService_1 = require("../error/errorService");
const googleTranslateService_1 = require("./googleTranslateService");
const path_1 = __importDefault(require("path"));
let dictionaries;
function normalizeReaderWord(word) {
    return word.normalize("NFKC").replace(/[’‘]/g, "'").trim().toLowerCase();
}
const own = (values, key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
function loadDictionaries() {
    const directory = path_1.default.resolve(__dirname, "../../../dictionary");
    return {
        wiktionary: JSON.parse(fs_1.default.readFileSync(path_1.default.join(directory, "wiktionary-en-he.json"), "utf8")),
        wordnet: JSON.parse(fs_1.default.readFileSync(path_1.default.join(directory, "english-hebrew.json"), "utf8")),
    };
}
function lookupReaderWord(input) {
    const word = normalizeReaderWord(input);
    if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word) || word.length > 80)
        return null;
    dictionaries || (dictionaries = loadDictionaries());
    const { wiktionary, wordnet } = dictionaries;
    const candidates = [
        word,
        ...(own(wiktionary.forms, word) || []),
        ...(own(wordnet.forms, word) || []),
        ...(word.endsWith("'s") ? [word.slice(0, -2)] : []),
    ];
    for (const headword of new Set(candidates)) {
        const wikiSenses = own(wiktionary.entries, headword);
        const senses = wikiSenses || own(wordnet.entries, headword);
        if (!(senses === null || senses === void 0 ? void 0 : senses.length))
            continue;
        const source = wikiSenses ? "Wiktionary" : "Princeton WordNet 3.0 / Hebrew WordNet (OMW)";
        const attribution = wikiSenses
            ? {
                name: "Wiktionary contributors via Kaikki / Wiktextract",
                url: wikiSenses[0].sourceUrl ||
                    "https://en.wiktionary.org/wiki/" + encodeURIComponent(headword) + "#English",
                license: "CC BY-SA 4.0",
                licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
            }
            : {
                name: source,
                url: "https://omwn.org/",
                license: "WordNet",
                licenseUrl: "https://wordnet.princeton.edu/license-and-commercial-use",
            };
        return { word, headword, source, senses, attribution };
    }
    return null;
}
function lookupReaderWordWithTranslation(input_1) {
    return __awaiter(this, arguments, void 0, function* (input, provider = "auto") {
        var _a;
        let local = null;
        try {
            local = lookupReaderWord(input);
        }
        catch (error) {
            if (provider === "auto")
                throw error;
        }
        if (provider === "auto")
            return local || (0, googleTranslateService_1.translateReaderWord)(normalizeReaderWord(input));
        if (!((_a = process.env.GOOGLE_TRANSLATE_API_KEY) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new errorService_1.AppError("Google Translate is not configured on the server.", 503);
        const translated = yield (0, googleTranslateService_1.translateReaderWord)(normalizeReaderWord(input));
        // A second provider must not split an inflected word into a separate vocabulary entry.
        return translated && local ? Object.assign(Object.assign({}, translated), { headword: local.headword }) : translated;
    });
}
//# sourceMappingURL=readerDictionaryService.js.map