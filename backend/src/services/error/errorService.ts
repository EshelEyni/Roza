import { Response, Request, NextFunction } from "express";
import { logger } from "../logger/loggerService";

type AsyncExpressMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;

enum ErrorType {
  ValidationError = "ValidationError",
  TokenExpiredError = "TokenExpiredError",
  CastError = "CastError",
  JsonWebTokenError = "JsonWebTokenError",
}

interface CustomError extends Error {
  path?: string;
  value?: string;
  keyValue?: { [key: string]: string };
  statusCode?: number;
}

class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: number;

  constructor(message: string, statusCode: number, code?: number) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  const isDevEnv = process.env.NODE_ENV === "development";
  const isTestEnv = process.env.NODE_ENV === "test";
  if (isDevEnv || isTestEnv) _sendErrorDev(err, res);
  else _sendErrorProd(_refineErrorForProd(err), res);
  if (!isTestEnv) logger.error(err.message);
}

function _refineErrorForProd(err: any) {
  let error = { ...err, message: err.message, name: err.name };
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

  if (error.code === 11000) error = _handleDuplicateFieldsDB(error);
  return error;
}

function _handleCastErrorDB(err: CustomError): AppError {
  const dbProperty = err.path === "_id" ? "id" : (err.path as string);
  const message = `Invalid ${dbProperty}: ${err.value}.`;
  return new AppError(message, 400);
}

function _handleValidationErrorDB(err: CustomError): AppError {
  const { message } = err;
  return new AppError(message, 400);
}

function _handleJWTError() {
  return new AppError("Invalid token. Please log in again!", 401);
}

function _handleJWTExpiredError() {
  return new AppError("Your token has expired! Please log in again.", 401);
}

function _handleDuplicateFieldsDB(err: CustomError): AppError {
  const { keyValue } = err;
  if (!keyValue)
    return new AppError("Duplicate field error without specific field information", 400);

  const [key, value] = Object.entries(keyValue)[0];
  const message = `Duplicate ${key} value: ${value}. Please use another value!`;
  return new AppError(message, 400);
}

function _sendErrorDev(err: AppError, res: Response): void {
  res.status(err.statusCode).send({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
}

function _sendErrorProd(err: AppError, res: Response): void {
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

function asyncErrorCatcher(fn: AsyncExpressMiddleware) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err: Error) => next(err));
  };
}

function validatePatchRequestBody(body: object) {
  if (Object.keys(body).length === 0) {
    throw new AppError(
      "No data received in the request. Please provide some properties to update.",
      400
    );
  }
}

export { CustomError, AppError, errorHandler, asyncErrorCatcher, validatePatchRequestBody };

// Path: src\services\logger\logger.service.ts
