"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLimiter = exports.authRequestLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const getRequestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: "Too many GET requests, please try again later",
});
const postRequestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Too many POST requests, please try again later",
});
const patchRequestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: "Too many PATCH requests, please try again later",
});
const putRequestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: "Too many PATCH requests, please try again later",
});
const deleteRequestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many DELETE requests, please try again later",
});
const authRequestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many authentication requests, please try again later",
});
exports.authRequestLimiter = authRequestLimiter;
const requestLimiter = (req, res, next) => {
    switch (req.method) {
        case "GET":
            getRequestLimiter(req, res, next);
            break;
        case "POST":
            postRequestLimiter(req, res, next);
            break;
        case "PATCH":
            patchRequestLimiter(req, res, next);
            break;
        case "PUT":
            putRequestLimiter(req, res, next);
            break;
        case "DELETE":
            deleteRequestLimiter(req, res, next);
            break;
        default:
            next();
    }
};
exports.requestLimiter = requestLimiter;
/*
Notes:
- This file is used to limit the number of requests a user can make to the server.
- No Test Cases needed. This is just a Wrapper for express-rate-limit.
*/
//# sourceMappingURL=rateLimiterService.js.map