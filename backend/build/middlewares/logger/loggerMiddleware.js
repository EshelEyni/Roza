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
exports.requestLogger = void 0;
const errorService_1 = require("../../services/error/errorService");
const loggerService_1 = require("../../services/logger/loggerService");
exports.requestLogger = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { method, originalUrl } = req;
    const start = Date.now();
    const str = `${method} ${originalUrl}`;
    loggerService_1.logger.info(str);
    res.on("finish", () => {
        if (res.statusCode >= 400)
            return;
        const duration = Date.now() - start;
        const str = `${method} ${originalUrl} ${res.statusCode} ${duration}ms`;
        loggerService_1.logger.success(str);
    });
    next();
}));
//# sourceMappingURL=loggerMiddleware.js.map