/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import {
  loginWithToken,
  login,
  logout,
  resetPassword,
  sendPasswordResetEmail,
  signup,
  updatePassword,
} from "./authController";
import authService from "../service/authService";
import {
  AppError,
  asyncErrorCatcher,
  getLoggedInUserIdFromReq,
  getMongoId,
} from "@rozaeyni/common";
import { UserCredenitials } from "@rozaeyni/common-types";

jest.mock("../../services/auth/authService");
jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: jest.fn().mockReturnValue("userId"),
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

describe("auth Controller", () => {
  const mockUser = { id: "1", username: "username" };
  const mockToken = "token";

  let req: Partial<Request>;
  const res: Partial<Response> = {
    cookie: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    clearCookie: jest.fn(),
    send: jest.fn(),
  };
  const next: jest.Mock = jest.fn();

  function assertUserTokenSuccesRes() {
    expect(res.cookie).toHaveBeenCalledWith("rozaJwt", mockToken, {
      httpOnly: true,
      expires: expect.any(Date),
      secure: false,
    });

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: mockUser,
        token: mockToken,
      }),
    );
  }

  function assertBadRequestError(msg: string, statusCode = 400) {
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode,
        status: "fail",
        message: msg,
      }),
    );
  }

  describe("login", () => {
    beforeEach(() => {
      req = { body: {} };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if no username is provided", async () => {
      const sut = login as any;
      await sut(req as Request, res as Response, next);
      assertBadRequestError("Username and password are required");
    });

    it("should throw an error if no password is provided", async () => {
      req.body!.username = "username";
      const sut = login as any;
      await sut(req as Request, res as Response, next);
      assertBadRequestError("Username and password are required");
    });

    it("should call login if username and password are provided", async () => {
      req.body!.username = "username";
      req.body!.password = "password";
      (authService.login as jest.Mock).mockResolvedValue({});
      const sut = login as any;
      await sut(req as Request, res as Response, next);
      expect(authService.login).toHaveBeenCalledWith("username", "password");
    });

    it("should send a response with the user", async () => {
      req.body!.username = "username";
      req.body!.password = "password";

      (authService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: mockToken,
      });
      const sut = login as any;
      await sut(req as Request, res as Response, next);
      assertUserTokenSuccesRes();
    });
  });

  describe("loginWithToken", () => {
    beforeEach(() => {
      req = { body: {}, cookies: {} };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should send a succesfull response with the user if a valid token is provided", async () => {
      req.cookies = { rozaJwt: mockToken };
      (authService.loginWithToken as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: mockToken,
      });

      const sut = loginWithToken as any;
      await sut(req as Request, res as Response, next);
      assertUserTokenSuccesRes();
    });

    it("should send a succesfull response with no user if no token is provided in production environment", async () => {
      process.env.NODE_ENV = "production";
      const sut = loginWithToken as any;
      await sut(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: null,
        }),
      );
      process.env.NODE_ENV = "test";
    });

    it("should return an error with no user if no token is provided in development environment", async () => {
      const sut = loginWithToken as any;
      await sut(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      assertBadRequestError("You are not logged in", 401);
    });

    it("should return a succesfull response with no user if an error occurs in production environment", async () => {
      process.env.NODE_ENV = "production";
      req.cookies = { rozaJwt: mockToken };
      (authService.loginWithToken as jest.Mock).mockRejectedValue(new Error("error"));

      const sut = loginWithToken as any;
      await sut(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: null,
        }),
      );
      process.env.NODE_ENV = "test";
    });

    it("should return an error failed response if an error occurs in development environment", async () => {
      process.env.NODE_ENV = "development";
      req.cookies = { rozaJwt: mockToken };
      (authService.loginWithToken as jest.Mock).mockImplementationOnce(() => {
        throw new AppError("error", 400);
      });

      const sut = loginWithToken as any;
      await sut(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      assertBadRequestError("error");
      process.env.NODE_ENV = "test";
    });
  });

  describe("signup", () => {
    const mockUserCredenitials: UserCredenitials = {
      username: "testUser",
      password: "testPassword",
      passwordConfirm: "testPassword",
      email: "test@example.com",
      fullname: "Test User",
    };

    beforeEach(() => {
      req = { body: mockUserCredenitials };

      (authService.signup as jest.Mock).mockResolvedValue({ user: mockUser, token: mockToken });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should sign up successfully with valid user credentials", async () => {
      const sut = signup as any;
      await sut(req as Request, res as Response, next);
      expect(authService.signup).toHaveBeenCalledWith(mockUserCredenitials);
      assertUserTokenSuccesRes();
    });

    it("should throw an error if user credentials are missing", async () => {
      req.body = {};
      const sut = signup as any;
      await sut(req as Request, res as Response, next);
      assertBadRequestError("User credentials are required");
    });

    it.each(Object.keys(mockUserCredenitials))(
      "should throw an error if %s is missing",
      async field => {
        req.body = { ...mockUserCredenitials };
        delete req.body[field];
        const sut = signup as any;
        await sut(req as Request, res as Response, next);
        assertBadRequestError(`${field} is required`);
      },
    );
  });

  describe("logout", () => {
    beforeEach(() => {
      req = { body: {}, cookies: {} };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should clear loginToken cookie and send a successful response", async () => {
      const sut = logout as any;
      await sut(req as Request, res as Response, next);
      expect(res.clearCookie).toHaveBeenCalledWith("rozaJwt");
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: {
            msg: "Logged out successfully",
          },
        }),
      );
    });
  });

  describe("updatePassword", () => {
    beforeEach(() => {
      req = {
        body: {
          currentPassword: "currentPassword",
          newPassword: "newPassword",
          newPasswordConfirm: "newPassword",
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if any required field is missing", async () => {
      const sut = updatePassword as any;
      for (const field of ["currentPassword", "newPassword", "newPasswordConfirm"]) {
        req.body[field] = undefined;
        await sut(req as Request, res as Response, next);
        assertBadRequestError(`${field} is required`);
        req.body[field] = field; // Reset the field for the next iteration
      }
    });

    it("should throw an error if newPassword and newPasswordConfirm do not match", async () => {
      req.body.newPasswordConfirm = "notMatchingPassword";
      const sut = updatePassword as any;
      await sut(req as Request, res as Response, next);
      assertBadRequestError("Passwords do not match");
      req.body.newPasswordConfirm = "newPasswordConfirm";
    });

    it("should throw an error if user is not logged in", async () => {
      (getLoggedInUserIdFromReq as jest.Mock).mockReturnValueOnce(undefined);
      const sut = updatePassword as any;
      await sut(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          status: "fail",
          message: "You are not logged in",
        }),
      );
    });

    it("should update the password and send a successful response", async () => {
      const id = getMongoId();
      (getLoggedInUserIdFromReq as jest.Mock).mockReturnValueOnce(id);
      (authService.updatePassword as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: mockToken,
      });
      const sut = updatePassword as any;
      await sut(req as Request, res as Response, next);
      expect(authService.updatePassword).toHaveBeenCalledWith(
        id,
        req.body.currentPassword,
        req.body.newPassword,
        req.body.newPasswordConfirm,
      );
      assertUserTokenSuccesRes();
    });
  });

  describe("sendPasswordResetEmail", () => {
    const validEmail = "test@example.com";
    beforeEach(() => {
      req = {
        body: { email: validEmail },
        protocol: "http",
        get: jest.fn().mockReturnValue("localhost"),
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if email is missing", async () => {
      req.body.email = undefined;
      const sut = sendPasswordResetEmail as any;
      await sut(req as Request, res as Response, next);
      assertBadRequestError("Email is required");
    });

    it("should throw an error if email is invalid", async () => {
      req.body.email = "invalidEmail";
      const sut = sendPasswordResetEmail as any;
      await sut(req as Request, res as Response, next);
      assertBadRequestError("Email is invalid");
      req.body.email = validEmail;
    });

    it("should send a password reset email and send a successful response", async () => {
      const resetURL = `${req.protocol}://${req.get!("host")}/api/auth/resetPassword/`;
      (authService.sendPasswordResetEmail as jest.Mock) = jest.fn();

      const sut = sendPasswordResetEmail as any;
      await sut(req as Request, res as Response, next);

      expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith(req.body.email, resetURL);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          message: "Password reset email sent successfully",
        }),
      );
    });
  });

  describe("resetPassword", () => {
    beforeEach(() => {
      req = {
        params: { token: "token" },
        body: {
          password: "newPassword",
          passwordConfirm: "newPasswordConfirm",
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if any required field is missing", async () => {
      const sut = resetPassword as any;
      for (const field of ["password", "passwordConfirm"]) {
        req.body[field] = undefined;
        await sut(req as Request, res as Response, next);
        assertBadRequestError(`${field} is required`);
        req.body[field] = field; // Reset the field for the next iteration
      }
    });

    it("should reset the password and send a successful response", async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: mockToken,
      });
      const sut = resetPassword as any;
      await sut(req as Request, res as Response, next);
      expect(authService.resetPassword).toHaveBeenCalledWith(
        req.params!.token,
        req.body.password,
        req.body.passwordConfirm,
      );
      assertUserTokenSuccesRes();
    });
  });
});
