// src/__tests__/appError.test.ts
import {
  AppError,
  asyncErrorCatcher,
  errorHandler,
  validatePatchRequestBody,
} from "./errorService";
import { Request, Response, NextFunction } from "express";
import { logger } from "../logger/loggerService";
import { CustomError } from "./errorService";

jest.mock("../logger/loggerService");

describe("Error Service", () => {
  describe("AppError", () => {
    it("should correctly set properties", () => {
      const errorMessage = "An error occurred";
      const statusCode = 400;
      const errorCode = 123;

      const error = new AppError(errorMessage, statusCode, errorCode);

      expect(error.message).toEqual(errorMessage);
      expect(error.statusCode).toEqual(statusCode);
      expect(error.code).toEqual(errorCode);
      expect(error.isOperational).toBeTruthy();
    });

    it("should set status to fail if statusCode starts with 4", () => {
      const errorMessage = "Another error occurred";
      const statusCode = 404;

      const error = new AppError(errorMessage, statusCode);

      expect(error.status).toEqual("fail");
    });

    it("should set status to error if statusCode does not start with 4", () => {
      const errorMessage = "Yet another error occurred";
      const statusCode = 500;

      const error = new AppError(errorMessage, statusCode);

      expect(error.status).toEqual("error");
    });
  });

  describe("errorHandler", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    const nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
      mockRequest = {};
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should handle errors correctly in development environment", () => {
      process.env.NODE_ENV = "development";

      const error = new Error("Some error");
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: "error",
        error: error,
        message: error.message,
        stack: error.stack,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should handle operational errors correctly in development environment", () => {
      process.env.NODE_ENV = "development";

      const error = new AppError("Some error", 401);
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(error.statusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: "fail",
        error: error,
        message: error.message,
        stack: error.stack,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should respond with 500 status and error message in production environment", () => {
      process.env.NODE_ENV = "production";

      const error = new Error("Some error");
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const expectedStatusCode = 500;
      const expectedStatus = "error";
      const expectedMessage = "Something went wrong!";

      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: expectedStatus,
        message: expectedMessage,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should handle CastError correctly in production environment", () => {
      process.env.NODE_ENV = "production";

      const error = {
        message: "Invalid id: 123123.",
        name: "CastError",
        path: "_id",
        value: "id123123",
        status: "error",
        statusCode: 500,
      } as CustomError;

      Error.captureStackTrace(error);
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const expectedStatusCode = 400;
      const dbProperty = error.path === "_id" ? "id" : (error.path as string);
      const expectedMessage = `Invalid ${dbProperty}: ${error.value}.`;
      const expectedStatus = "fail";

      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: expectedStatus,
        message: expectedMessage,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should handle ValidationError correctly in production environment", () => {
      process.env.NODE_ENV = "production";

      const error = {
        message: "Validation failed: name: Please provide a name.",
        name: "ValidationError",
        status: "error",
        statusCode: 500,
      } as CustomError;
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const expectedStatusCode = 400;
      const expectedStatus = "fail";
      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: expectedStatus,
        message: error.message,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should handle JsonWebTokenError correctly in production environment", () => {
      process.env.NODE_ENV = "production";

      const error = {
        message: "error message",
        name: "JsonWebTokenError",
        status: "error",
        statusCode: 500,
      } as CustomError;
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const expectedStatusCode = 401;
      const expectedStatus = "fail";
      const expectedMessage = "Invalid token. Please log in again!";
      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: expectedStatus,
        message: expectedMessage,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should handle TokenExpiredError correctly in production environment", () => {
      process.env.NODE_ENV = "production";

      const error = {
        message: "error message",
        name: "TokenExpiredError",
        status: "error",
        statusCode: 500,
      } as CustomError;
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const expectedStatusCode = 401;
      const expectedStatus = "fail";
      const expectedMessage = "Your token has expired! Please log in again.";
      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: expectedStatus,
        message: expectedMessage,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });

    it("should handle duplicate key error correctly in production environment", () => {
      process.env.NODE_ENV = "production";

      const error = {
        message: "error message",
        name: "MongoError",
        status: "error",
        statusCode: 500,
        code: 11000,
        keyValue: { fieldKey: "fieldValue" },
      } as CustomError;
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const expectedStatusCode = 400;
      const expectedStatus = "fail";
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const [key, value] = Object.entries(error.keyValue!)[0];
      const expectedMessage = `Duplicate ${key} value: ${value}. Please use another value!`;
      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockResponse.send).toHaveBeenCalledWith({
        status: expectedStatus,
        message: expectedMessage,
      });
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });
  });

  describe("asyncErrorCatcher", () => {
    let mockRequest: Request;
    let mockResponse: Response;

    beforeEach(() => {
      mockRequest = {} as Request;
      mockResponse = {} as Response;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should catch and forward errors from async middleware", done => {
      const middlewareThatThrows = async (_req: Request, _res: Response, _next: NextFunction) => {
        throw new Error("test error");
      };
      const wrappedMiddleware = asyncErrorCatcher(middlewareThatThrows);

      wrappedMiddleware(mockRequest, mockResponse, err => {
        try {
          expect(err).toBeInstanceOf(Error);
          expect(err).toHaveProperty("message", "test error");
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  describe("validatePatchRequestBody", () => {
    it("should throw an error if body object is empty", () => {
      const resultFn = () => validatePatchRequestBody({});

      expect(resultFn).toThrow();
      expect(resultFn).toThrowError(
        new AppError(
          "No data received in the request. Please provide some properties to update.",
          400
        )
      );
    });

    it("should not throw an error if body object is not empty", () => {
      const resultFn = () => validatePatchRequestBody({ key: "value" });
      expect(resultFn).not.toThrow();
    });
  });
});
