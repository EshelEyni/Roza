import jwt from "jsonwebtoken";
import { Request } from "express";
require("dotenv").config();
import tokenService from "./tokenService";
import { AppError } from "../error/errorService";

jest.mock("jsonwebtoken");

const mockRequest = (headers = {}, cookies = {}) =>
  ({
    headers,
    cookies,
  } as Request);

describe("Token Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTokenFromRequest", () => {
    it("should return token from cookies if present", () => {
      const req = mockRequest({}, { loginToken: "test_token" });
      const token = tokenService.getTokenFromRequest(req);
      expect(token).toBe("test_token");
    });

    it("should return token from headers if present", () => {
      const req = mockRequest({ authorization: "Bearer test_token" });
      const token = tokenService.getTokenFromRequest(req);
      expect(token).toBe("test_token");
    });

    it("should return null if token is not present", () => {
      const req = mockRequest();
      const token = tokenService.getTokenFromRequest(req);
      expect(token).toBeNull();
    });
  });

  describe("signToken", () => {
    it("should sign and return a token", () => {
      (jwt.sign as jest.Mock).mockReturnValue("signed_token");
      const token = tokenService.signToken("test_id");
      expect(jwt.sign).toHaveBeenCalledWith({ id: "test_id" }, process.env.JWT_SECRET_CODE, {
        expiresIn: process.env.JWT_EXPIRATION_TIME,
      });
      expect(token).toBe("signed_token");
    });

    it("should throw an error if jwtSecretCode is not in config", () => {
      const temp = process.env.JWT_SECRET_CODE;
      delete process.env.JWT_SECRET_CODE;
      expect(() => tokenService.signToken("test_id")).toThrow(AppError);
      process.env.JWT_SECRET_CODE = temp;
    });

    it("should throw an error if jwtExpirationTime is not in config", () => {
      const temp = process.env.JWT_EXPIRATION_TIME;
      delete process.env.JWT_EXPIRATION_TIME;
      expect(() => tokenService.signToken("test_id")).toThrow(AppError);
      process.env.JWT_EXPIRATION_TIME = temp;
    });
  });

  describe("verifyToken", () => {
    it("should verify and return the payload of a token", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: "test_id", iat: 1234567890 });
      const payload = await tokenService.verifyToken("test_token");
      expect(jwt.verify).toHaveBeenCalledWith("test_token", process.env.JWT_SECRET_CODE);
      expect(payload).toEqual({ id: "test_id", timeStamp: 1234567890 });
    });

    it("should return null if verification fails", async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error("Token verification failed");
      });
      const payload = await tokenService.verifyToken("test_token");
      expect(payload).toBeNull();
    });

    it("should return null if jwtSecretCode is not in config", async () => {
      const temp = process.env.JWT_SECRET_CODE;
      delete process.env.JWT_SECRET_CODE;
      const payload = await tokenService.verifyToken("test_token");
      expect(payload).toBeNull();
      process.env.JWT_SECRET_CODE = temp;
    });
  });
});
