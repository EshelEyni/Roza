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
exports.updateProgressSettings = exports.getProgressSettings = void 0;
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const readerProgressSettingsModel_1 = require("../../models/reader/readerProgressSettingsModel");
// Keep runtime values in the backend: shared source files are in an ESM package.
const defaultReaderProgressSettings = {
    defaultProgressDisplay: "percentage",
};
function isReaderProgressSettings(value) {
    const settings = value;
    return !!settings && typeof settings === "object" &&
        ["percentage", "section", "book"].includes(settings.defaultProgressDisplay);
}
exports.getProgressSettings = (0, errorService_1.asyncErrorCatcher)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const saved = yield readerProgressSettingsModel_1.ReaderProgressSettingsModel.findOne({
        userId: (0, ALSService_1.getLoggedInUserIdFromReq)(),
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "success",
        data: saved
            ? { defaultProgressDisplay: saved.defaultProgressDisplay }
            : defaultReaderProgressSettings,
    });
}));
exports.updateProgressSettings = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isReaderProgressSettings(req.body))
        throw new errorService_1.AppError("Choose percentage, section, or book progress.", 400);
    const settings = { defaultProgressDisplay: req.body.defaultProgressDisplay };
    yield readerProgressSettingsModel_1.ReaderProgressSettingsModel.findOneAndUpdate({ userId: (0, ALSService_1.getLoggedInUserIdFromReq)() }, { $set: settings }, { upsert: true, new: true, runValidators: true });
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: settings });
}));
//# sourceMappingURL=readerProgressSettingsController.js.map