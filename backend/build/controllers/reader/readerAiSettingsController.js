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
exports.updateAiSettings = exports.getAiSettings = void 0;
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const readerAiSettingsService_1 = require("../../services/reader/readerAiSettingsService");
const getAiSettings = (0, errorService_1.asyncErrorCatcher)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: yield (0, readerAiSettingsService_1.getReaderAiSettings)((0, ALSService_1.getLoggedInUserIdFromReq)()) });
}));
exports.getAiSettings = getAiSettings;
const updateAiSettings = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "success",
        data: yield (0, readerAiSettingsService_1.saveReaderAiSettings)((0, ALSService_1.getLoggedInUserIdFromReq)(), req.body),
    });
}));
exports.updateAiSettings = updateAiSettings;
//# sourceMappingURL=readerAiSettingsController.js.map