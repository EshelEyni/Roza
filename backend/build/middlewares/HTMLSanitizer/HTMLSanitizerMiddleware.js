"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sanitize_html_1 = __importDefault(require("sanitize-html"));
function _sanitizeBody(body) {
    for (const key in body) {
        const isValueString = typeof body[key] === "string";
        const isValueObject = typeof body[key] === "object";
        if (!isValueString && !isValueObject)
            continue;
        if (isValueString)
            body[key] = (0, sanitize_html_1.default)(body[key]);
        if (isValueObject)
            _sanitizeBody(body[key]);
    }
}
function _sanitizeParams(params) {
    for (const key in params) {
        if (typeof params[key] !== "string")
            continue;
        params[key] = (0, sanitize_html_1.default)(params[key]);
    }
}
function _sanitizeQuery(query) {
    for (const key in query) {
        if (typeof query[key] !== "string")
            continue;
        query[key] = (0, sanitize_html_1.default)(query[key]);
    }
}
function requestSanitizer(req, res, next) {
    const { body } = req;
    const { params } = req;
    const { query } = req;
    if (body)
        _sanitizeBody(body);
    if (params)
        _sanitizeParams(params);
    if (query)
        _sanitizeQuery(query);
    next();
}
exports.default = requestSanitizer;
//# sourceMappingURL=HTMLSanitizerMiddleware.js.map