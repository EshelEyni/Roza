import { logger } from "../../services/logger/loggerService";
import { requestLogger } from "./loggerMiddleware";
import { NextFunction, Request, Response } from "express";

jest.mock("../../services/logger/loggerService");

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe("requestLogger Middleware", () => {
  const mockRequest = {
    method: "GET",
    originalUrl: "/test",
  } as Request;

  const mockResponse = {
    on: jest.fn((event, callback) => callback()),
    statusCode: 200,
  } as unknown as Response;

  const mockNext = jest.fn() as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should log the request info and calls next", () => {
    requestLogger(mockRequest, mockResponse, mockNext);
    expect(mockedLogger.info).toHaveBeenCalledWith("GET /test");
    expect(mockNext).toHaveBeenCalled();
  });

  it("should log the request info and response info when the response finishes", () => {
    requestLogger(mockRequest, mockResponse, mockNext);
    expect(mockedLogger.info).toHaveBeenCalledWith("GET /test");
    expect(mockedLogger.success).toHaveBeenCalledWith(
      expect.stringMatching(/GET \/test 200 \d+ms/),
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it("should log the request info but not the response info when the response finishes with an error", () => {
    mockResponse.statusCode = 400;
    requestLogger(mockRequest, mockResponse, mockNext);
    expect(mockedLogger.info).toHaveBeenCalledWith("GET /test");
    expect(mockedLogger.success).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });
});

/* 
Notes: even though the requestLogger function is an async function, we don't need to use await when calling it in the test.
*/
