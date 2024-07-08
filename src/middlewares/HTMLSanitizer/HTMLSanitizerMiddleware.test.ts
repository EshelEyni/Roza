import requestSanitizer from "./HTMLSanitizerMiddleware";
import { Request, Response, NextFunction } from "express";

const mockRequest = (body = {}, params = {}, query = {}) => {
  return {
    body,
    params,
    query,
  } as Request;
};

const mockResponse = () => {
  const res = {} as Response;
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe("requestSanitizer Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should sanitize request body", () => {
    const req = mockRequest({ key: "<script>Alert('XSS Attack!')</script>" });
    requestSanitizer(req, mockResponse(), mockNext);
    expect(req.body.key).not.toContain("<script>");
    expect(mockNext).toHaveBeenCalled();
  });

  it("should sanitize request body recursively", () => {
    const req = mockRequest({
      key: "<script>Alert('XSS Attack!')</script>",
      nested: {
        key: "<script>Alert('XSS Attack!')</script>",
      },
    });
    requestSanitizer(req, mockResponse(), mockNext);
    expect(req.body.key).not.toContain("<script>");
    expect(req.body.nested.key).not.toContain("<script>");
    expect(mockNext).toHaveBeenCalled();
  });

  it("should sanitize request params", () => {
    const req = mockRequest({}, { key: "<script>Alert('XSS Attack!')</script>" });
    requestSanitizer(req, mockResponse(), mockNext);
    expect(req.params.key).not.toContain("<script>");
    expect(mockNext).toHaveBeenCalled();
  });

  it("should sanitize request query", () => {
    const req = mockRequest({}, {}, { key: "<script>Alert('XSS Attack!')</script>" });
    requestSanitizer(req, mockResponse(), mockNext);
    expect(req.query.key).not.toContain("<script>");
    expect(mockNext).toHaveBeenCalled();
  });

  it("should pass through request if no string fields to sanitize", () => {
    const req = mockRequest();
    requestSanitizer(req, mockResponse(), mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
