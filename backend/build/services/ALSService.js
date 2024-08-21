"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLoggedInUserIdFromReq = exports.asyncLocalStorage = void 0;
const async_hooks_1 = require("async_hooks");
const asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
exports.asyncLocalStorage = asyncLocalStorage;
function getLoggedInUserIdFromReq() {
    var _a, _b;
    return (_b = (_a = asyncLocalStorage.getStore()) === null || _a === void 0 ? void 0 : _a.loggedInUserId) !== null && _b !== void 0 ? _b : "";
}
exports.getLoggedInUserIdFromReq = getLoggedInUserIdFromReq;
//# sourceMappingURL=ALSService.js.map