/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import userService from "../service/userService";
import { getUserByUsername, removeLoggedInUser, updateLoggedInUser } from "./userController";
import { AppError, asyncErrorCatcher, getLoggedInUserIdFromReq } from "@rozaeyni/common";

jest.mock("../../services/user/userService");
jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: jest.fn().mockReturnValue("12345"),
}));

const nextMock = jest.fn() as jest.MockedFunction<NextFunction>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
(asyncErrorCatcher as jest.Mock) = jest.fn().mockImplementation(fn => {
  return async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      return nextMock(error);
    }
  };
});

describe("User Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  describe("getUserByUsername", () => {
    beforeEach(() => {
      req = { params: {} };
      res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if no username is provided", async () => {
      const sut = getUserByUsername as any;
      await sut(req as Request, res as Response, nextMock);

      expect(nextMock).toHaveBeenCalledWith(new AppError("No user username provided", 400));
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "No user username provided",
          statusCode: 400,
        }),
      );
    });

    it("should throw an error if user is not found", async () => {
      const username = "testuser";
      req = { params: { username } };
      (userService.getByUsername as jest.Mock).mockImplementationOnce(() => {
        throw new AppError(`User with username ${username} not found`, 404);
      });
      const sut = getUserByUsername as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalled();
      expect(nextMock).toHaveBeenCalledWith(
        new AppError("User with username testuser not found", 404),
      );
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User with username testuser not found",
          statusCode: 404,
        }),
      );
    });

    it("should return user data if user is found", async () => {
      const mockUser = { id: "1", username: "testuser" };
      req = { params: { username: "testuser" } };
      (userService.getByUsername as jest.Mock).mockResolvedValue(mockUser);

      const sut = getUserByUsername as any;
      await sut(req as Request, res as Response, nextMock);

      expect(res.send).toHaveBeenCalledWith({
        status: "success",
        requestedAt: expect.any(String),
        data: mockUser,
      });
    });
  });

  describe("updateLoggedInUser", () => {
    beforeEach(() => {
      req = { body: {} };
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      nextMock.mockClear();
    });

    it("should throw an error if no data is provided in the request body", async () => {
      const sut = updateLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "No data received in the request. Please provide some properties to update.",
          statusCode: 400,
        }),
      );
    });

    it("should throw an error if user is not logged in", async () => {
      (getLoggedInUserIdFromReq as jest.Mock).mockReturnValueOnce(undefined);
      req.body = { name: "Updated Name" };
      const sut = updateLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not logged in",
          statusCode: 401,
        }),
      );
    });

    it("should update the user and return the updated data", async () => {
      const mockUpdatedUser = { id: "12345", name: "Updated Name" };
      (userService.update as jest.Mock).mockResolvedValue(mockUpdatedUser);
      req.body = { name: "Updated Name" };
      const sut = updateLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(userService.update).toHaveBeenCalledWith("12345", { name: "Updated Name" });
      expect(res.send).toHaveBeenCalledWith({
        status: "success",
        data: mockUpdatedUser,
      });
    });

    it("should pass errors from the userService to the next middleware", async () => {
      (userService.update as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Test error");
      });
      req.body = { name: "Updated Name" };
      const sut = updateLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledWith(new Error("Test error"));
    });
  });

  describe("removeLoggedInUser", () => {
    beforeEach(() => {
      req = {};
      res = {
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      nextMock.mockClear();
      jest.clearAllMocks();
    });

    it("should throw an error if user is not logged in", async () => {
      (getLoggedInUserIdFromReq as jest.Mock).mockReturnValueOnce(undefined);

      const sut = removeLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not logged in",
          statusCode: 401,
        }),
      );
    });

    it("should throw an error if user is not found", async () => {
      (userService.removeAccount as jest.Mock).mockImplementationOnce(() => {
        throw new AppError("User not found", 404);
      });
      const sut = removeLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not found",
          statusCode: 404,
        }),
      );
    });

    it("should remove the user and return a 204 status", async () => {
      const mockRemovedUser = { id: "12345", username: "TestUser" };
      (userService.removeAccount as jest.Mock).mockResolvedValue(mockRemovedUser);
      const sut = removeLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(userService.removeAccount).toHaveBeenCalledWith("12345");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith({
        status: "success",
        data: null,
      });
    });

    it("should pass errors from the userService to the next middleware", async () => {
      (userService.removeAccount as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Test error");
      });
      const sut = removeLoggedInUser as any;
      await sut(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledWith(new Error("Test error"));
    });
  });
});

/*
Notes: 

this function are not tested, because they are factory functions and are tested in the service test file
- getById
- addUser
- updateUser
- removeUser

*/
