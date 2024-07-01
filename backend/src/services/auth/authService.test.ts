import * as crypto from "crypto";
import { UserCredenitials } from "../../../../shared/types/user";
import authService from "./authService";
import { UserModel } from "../../models/user/userModel";
import tokenService from "../../services/token/tokenService";
import { AppError } from "../../services/error/errorService";
import { isValidMongoId, sendEmail } from "../../services/util/utilService";
import { IUser } from "../../types/iTypes";

jest.mock("crypto");
jest.mock("../../models/user/userModel");
jest.mock("../../services/token/tokenService");
jest.mock("../../services/util/utilService");

describe("auth Service", () => {
  describe("login", () => {
    let user: Partial<IUser>;

    beforeEach(() => {
      user = {
        id: "1",
        loginAttempts: 0,
        lockedUntil: 0,
        checkPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn(),
      };
      (UserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
      (tokenService.signToken as jest.Mock).mockReturnValue("token");
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if the user does not exist", async () => {
      (UserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      await expect(authService.login("username", "password")).rejects.toThrow(
        new AppError("User not found", 404)
      );
    });

    it("should throw an error if the password is incorrect", async () => {
      user.checkPassword = jest.fn().mockResolvedValue(false);
      await expect(authService.login("username", "password")).rejects.toThrow(
        new AppError("Incorrect password", 401)
      );
    });

    it("should return a user and a token if the username and password are correct", async () => {
      const result = await authService.login("username", "password");
      expect(result).toEqual({ user, token: "token" });
    });

    it("should increment loginAttempts if user is not locked", async () => {
      user.checkPassword = jest.fn().mockResolvedValue(false);
      await expect(authService.login("username", "password")).rejects.toThrow(
        new AppError("Incorrect password", 401)
      );
      expect(user.loginAttempts).toBe(1);
      expect(user.save).toHaveBeenCalled();
    });

    it("should lock the user for 1 hour if loginAttempts is 10 and user is not currently locked", async () => {
      user.loginAttempts = 10;
      user.lockedUntil = Date.now() - 1;
      const HOUR = 60 * 60 * 1000;

      await expect(authService.login("username", "password")).rejects.toThrow(
        new AppError("Too many failed login attempts. Try again in 1 hour", 400)
      );

      expect(user.lockedUntil).toBeGreaterThan(Date.now() + HOUR - 1000);
      expect(user.save).toHaveBeenCalled();
    });

    it("should throw an error if the user is currently locked", async () => {
      user.lockedUntil = Date.now() + 60000;
      await expect(authService.login("username", "password")).rejects.toThrow(
        new AppError("Account locked. Try again in 1 minutes", 400)
      );
      expect(user.save).not.toHaveBeenCalled();
    });

    it("should reset loginAttempts to 0 if the user is not locked", async () => {
      user.loginAttempts = 9;
      user.lockedUntil = Date.now() - 1;
      await authService.login("username", "password");
      expect(user.loginAttempts).toBe(0);
      expect(user.lockedUntil).toBe(0);
      expect(user.save).toHaveBeenCalledTimes(2);
    });

    it("should throw an error if the signToken function fails", async () => {
      (tokenService.signToken as jest.Mock).mockImplementation(() => {
        throw new Error("Token generation failed");
      });

      await expect(authService.login("username", "password")).rejects.toThrow(
        "Token generation failed"
      );
    });
  });

  describe("loginWithToken", () => {
    it("should return user and token if login is successful", async () => {
      const mockUser = { id: "123", name: "Test User" };
      (tokenService.verifyToken as jest.Mock).mockResolvedValue({ id: "123" });
      (isValidMongoId as jest.Mock).mockReturnValue(true);
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
      (tokenService.signToken as jest.Mock).mockReturnValue("validToken");
      const result = await authService.loginWithToken("validToken");
      expect(result).toEqual({ user: mockUser, token: "validToken" });
    });

    it("should throw an error if token is invalid", async () => {
      (tokenService.verifyToken as jest.Mock).mockResolvedValue(null);
      await expect(authService.loginWithToken("invalidToken")).rejects.toThrow(
        new AppError("Invalid token", 400)
      );
    });

    it("should throw an error if id is invalid", async () => {
      (tokenService.verifyToken as jest.Mock).mockResolvedValue({ id: "123" });
      (isValidMongoId as jest.Mock).mockReturnValue(false);
      await expect(authService.loginWithToken("validToken")).rejects.toThrow(
        new AppError("Invalid Id", 400)
      );
    });

    it("should throw an error if user is not found", async () => {
      (tokenService.verifyToken as jest.Mock).mockResolvedValue({ id: "123" });
      (isValidMongoId as jest.Mock).mockReturnValue(true);
      (UserModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(authService.loginWithToken("validToken")).rejects.toThrow(
        new AppError("User not found", 404)
      );
    });
  });

  describe("signup", () => {
    const mockUserCredenitials: UserCredenitials = {
      username: "Test User",
      fullname: "Test User",
      email: "test@example.com",
      password: "test-password",
      passwordConfirm: "test-password",
      birthdate: new Date(),
      gender: "male",
      height: 180,
      weight: 80,
    };

    const mockUser = { id: "1", username: "Test User", email: "test@example.com" };
    const mockToken = "test-token";

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create a new user and return the user and a token", async () => {
      (UserModel.create as jest.Mock).mockResolvedValue(mockUser);
      (tokenService.signToken as jest.Mock).mockReturnValue(mockToken);
      const result = await authService.signup(mockUserCredenitials as UserCredenitials);
      expect(UserModel.create).toHaveBeenCalledWith(mockUserCredenitials);
      expect(tokenService.signToken).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ user: mockUser, token: mockToken });
    });

    it("should throw an error if the passwords do not match", async () => {
      (UserModel.create as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Passwords do not match");
      });
      await expect(authService.signup(mockUserCredenitials as UserCredenitials)).rejects.toThrow(
        "Passwords do not match"
      );
      expect(tokenService.signToken).not.toHaveBeenCalled();
    });

    it("should throw an error if token generation fails", async () => {
      (UserModel.create as jest.Mock).mockResolvedValue(mockUser);
      (tokenService.signToken as jest.Mock).mockImplementation(() => {
        throw new Error("Token generation failed");
      });
      await expect(authService.signup(mockUserCredenitials)).rejects.toThrow(
        "Token generation failed"
      );
    });
  });

  describe("updatePassword", () => {
    it("should return user and token if password update is successful", async () => {
      const mockUser = {
        id: "123",
        name: "Test User",
        password: "oldPassword",
        checkPassword: jest.fn().mockReturnValue(true),
        save: jest.fn(),
      };
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      (tokenService.signToken as jest.Mock).mockReturnValue("validToken");

      const result = await authService.updatePassword(
        "123",
        "oldPassword",
        "newPassword",
        "newPassword"
      );

      expect(result).toEqual({ user: mockUser, token: "validToken" });
      expect(mockUser.password).toBe("newPassword");
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should throw an error if user is not found", async () => {
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.updatePassword("123", "oldPassword", "newPassword", "newPassword")
      ).rejects.toThrow(new AppError("User not found", 404));
    });

    it("should throw an error if current password is incorrect", async () => {
      const mockUser = {
        id: "123",
        name: "Test User",
        password: "oldPassword",
        checkPassword: jest.fn().mockReturnValue(false),
      };
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      await expect(
        authService.updatePassword("123", "wrongPassword", "newPassword", "newPassword")
      ).rejects.toThrow(
        new AppError("Current password is incorrect. Please enter the correct password", 400)
      );
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send a password reset email if user is found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockUser: any = {
        email: "test@example.com",
        passwordResetToken: undefined,
        passwordResetExpires: undefined,
        createPasswordResetToken: jest.fn().mockImplementationOnce(() => {
          const TEN_MINUTES = 10 * 60 * 1000;
          mockUser.passwordResetToken = "resetToken";
          mockUser.passwordResetExpires = Date.now() + TEN_MINUTES;
          return mockUser.passwordResetToken;
        }),
        save: jest.fn(),
      };
      (UserModel.findOne as jest.Mock).mockResolvedValue(mockUser);

      await authService.sendPasswordResetEmail("test@example.com", "resetURL/");

      expect(mockUser.createPasswordResetToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(mockUser.passwordResetToken).toBeDefined();
      expect(mockUser.passwordResetExpires).toBeGreaterThan(Date.now());

      expect(sendEmail).toHaveBeenCalledWith({
        email: "test@example.com",
        subject: "Your password reset token (valid for 10 min)",
        message: expect.stringContaining("resetURL/resetToken"),
      });
    });

    it("should throw an error if user is not found", async () => {
      (UserModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.sendPasswordResetEmail("test@example.com", "resetURL/")
      ).rejects.toThrow(new AppError("There is no user with email address", 404));
    });

    it("should reset passwordResetToken and passwordResetExpires if email sending fails", async () => {
      const mockUser = {
        email: "test@example.com",
        passwordResetToken: "oldToken",
        passwordResetExpires: "oldExpires",
        createPasswordResetToken: jest.fn().mockReturnValue("resetToken"),
        save: jest.fn(),
      };
      (UserModel.findOne as jest.Mock).mockResolvedValue(mockUser);
      (sendEmail as jest.Mock).mockRejectedValue(new Error("Email error"));

      await expect(
        authService.sendPasswordResetEmail("test@example.com", "resetURL/")
      ).rejects.toThrow(
        new AppError("There was an error sending the email. Try again later!", 500)
      );

      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });
  });

  describe("resetPassword", () => {
    const hashedToken = "hashedToken";
    const token = "token";
    const password = "newPassword";
    const passwordConfirm = "newPasswordConfirm";

    beforeEach(() => {
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(hashedToken),
      });
    });

    it("should reset password if token is valid and not expired", async () => {
      const mockUser = {
        password: "password",
        passwordConfirm: "passwordConfirm",
        passwordResetToken: "passwordResetToken",
        passwordResetExpires: "passwordResetExpires",
        save: jest.fn(),
      };
      (UserModel.findOne as jest.Mock).mockResolvedValue(mockUser);
      (tokenService.signToken as jest.Mock).mockReturnValue("newToken");

      const result = await authService.resetPassword(token, password, passwordConfirm);

      expect(mockUser.password).toBe(password);
      expect(mockUser.passwordConfirm).toBe(passwordConfirm);
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({ user: mockUser, token: "newToken" });
    });

    it("should throw an error if token is invalid or  if token has expired", async () => {
      (UserModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(authService.resetPassword(token, password, passwordConfirm)).rejects.toThrow(
        new AppError("Token is invalid or has expired", 400)
      );
    });
  });
});
