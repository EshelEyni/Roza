"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReaderEnabled = isReaderEnabled;
exports.checkReaderAccess = checkReaderAccess;
const ALSService_1 = require("../ALSService");
const errorService_1 = require("../error/errorService");
function isReaderEnabled(userId) {
    const allowedIds = (process.env.READER_ALLOWED_USER_IDS || "").split(",").map(id => id.trim());
    return process.env.READER_ENABLED === "true" && !!userId && allowedIds.includes(userId);
}
function checkReaderAccess(_req, _res, next) {
    if (!isReaderEnabled((0, ALSService_1.getLoggedInUserIdFromReq)()))
        return next(new errorService_1.AppError("Reader is not enabled for this account.", 403));
    next();
}
//# sourceMappingURL=readerAccessService.js.map