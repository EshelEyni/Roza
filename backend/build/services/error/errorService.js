"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePatchRequestBody = exports.asyncErrorCatcher = exports.errorHandler = exports.AppError = void 0;
const loggerService_1 = require("../logger/loggerService");
var ErrorType;
(function (ErrorType) {
    ErrorType["ValidationError"] = "ValidationError";
    ErrorType["TokenExpiredError"] = "TokenExpiredError";
    ErrorType["CastError"] = "CastError";
    ErrorType["JsonWebTokenError"] = "JsonWebTokenError";
})(ErrorType || (ErrorType = {}));
class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, next) {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";
    const isDevEnv = process.env.NODE_ENV === "development";
    const isTestEnv = process.env.NODE_ENV === "test";
    if (isDevEnv || isTestEnv)
        _sendErrorDev(err, res);
    else
        _sendErrorProd(_refineErrorForProd(err), res);
    if (!isTestEnv)
        loggerService_1.logger.error(err.message);
}
exports.errorHandler = errorHandler;
function _refineErrorForProd(err) {
    let error = Object.assign(Object.assign({}, err), { message: err.message, name: err.name });
    const { name } = error;
    switch (name) {
        case ErrorType.CastError:
            error = _handleCastErrorDB(error);
            break;
        case ErrorType.ValidationError:
            error = _handleValidationErrorDB(error);
            break;
        case ErrorType.JsonWebTokenError:
            error = _handleJWTError();
            break;
        case ErrorType.TokenExpiredError:
            error = _handleJWTExpiredError();
            break;
        default:
            break;
    }
    if (error.code === 11000)
        error = _handleDuplicateFieldsDB(error);
    return error;
}
function _handleCastErrorDB(err) {
    const dbProperty = err.path === "_id" ? "id" : err.path;
    const message = `Invalid ${dbProperty}: ${err.value}.`;
    return new AppError(message, 400);
}
function _handleValidationErrorDB(err) {
    const { message } = err;
    return new AppError(message, 400);
}
function _handleJWTError() {
    return new AppError("Invalid token. Please log in again!", 401);
}
function _handleJWTExpiredError() {
    return new AppError("Your token has expired! Please log in again.", 401);
}
function _handleDuplicateFieldsDB(err) {
    const { keyValue } = err;
    if (!keyValue)
        return new AppError("Duplicate field error without specific field information", 400);
    const [key, value] = Object.entries(keyValue)[0];
    const message = `Duplicate ${key} value: ${value}. Please use another value!`;
    return new AppError(message, 400);
}
function _sendErrorDev(err, res) {
    res.status(err.statusCode).send({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
}
function _sendErrorProd(err, res) {
    if (err.isOperational)
        res.status(err.statusCode).send({
            status: err.status,
            message: err.message,
        });
    else
        res.status(500).send({
            status: "error",
            message: "Something went wrong!",
        });
}
function asyncErrorCatcher(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch((err) => next(err));
    };
}
exports.asyncErrorCatcher = asyncErrorCatcher;
function validatePatchRequestBody(body) {
    if (Object.keys(body).length === 0) {
        throw new AppError("No data received in the request. Please provide some properties to update.", 400);
    }
}
exports.validatePatchRequestBody = validatePatchRequestBody;
// Path: src\services\logger\logger.service.ts
//# sourceMappingURL=errorService.js.map