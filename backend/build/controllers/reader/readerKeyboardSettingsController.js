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
exports.updateKeyboardSettings = exports.getKeyboardSettings = void 0;
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const readerKeyboardSettingsModel_1 = require("../../models/reader/readerKeyboardSettingsModel");
const defaultReaderKeyboardSettings = {
    unit: "words",
    count: 1,
};
function isReaderKeyboardSettings(value) {
    const settings = value;
    return (!!settings &&
        typeof settings === "object" &&
        ["words", "sentences"].includes(settings.unit) &&
        Number.isSafeInteger(settings.count) &&
        settings.count >= 1);
}
exports.getKeyboardSettings = (0, errorService_1.asyncErrorCatcher)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const saved = yield readerKeyboardSettingsModel_1.ReaderKeyboardSettingsModel.findOne({
        userId: (0, ALSService_1.getLoggedInUserIdFromReq)(),
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "success",
        data: saved
            ? { unit: saved.unit, count: saved.count }
            : defaultReaderKeyboardSettings,
    });
}));
exports.updateKeyboardSettings = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isReaderKeyboardSettings(req.body))
        throw new errorService_1.AppError("Choose words or sentences and a whole-number count of at least 1.", 400);
    const settings = { unit: req.body.unit, count: req.body.count };
    yield readerKeyboardSettingsModel_1.ReaderKeyboardSettingsModel.findOneAndUpdate({ userId: (0, ALSService_1.getLoggedInUserIdFromReq)() }, { $set: settings }, { upsert: true, new: true, runValidators: true });
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: settings });
}));
//# sourceMappingURL=readerKeyboardSettingsController.js.map