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
const ALSService_1 = require("../../services/ALSService");
const errorService_1 = require("../../services/error/errorService");
const tokenService_1 = __importDefault(require("../../services/token/tokenService"));
const setupAsyncLocalStorage = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const storage = {};
    ALSService_1.asyncLocalStorage.run(storage, () => __awaiter(void 0, void 0, void 0, function* () {
        const token = tokenService_1.default.getTokenFromRequest(req);
        if (!token)
            return next();
        const verifiedToken = yield tokenService_1.default.verifyToken(token);
        if (!verifiedToken)
            return next();
        const alsStore = ALSService_1.asyncLocalStorage.getStore();
        alsStore.loggedInUserId = verifiedToken.id;
        next();
    }));
}));
exports.default = setupAsyncLocalStorage;
//# sourceMappingURL=setupALSMiddleware.js.map