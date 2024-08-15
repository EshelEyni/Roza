/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createValidUserCreds, getMongoId } from "../../services/test/testUtilService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import { UserModel } from "./userModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";

jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: jest.fn(),
}));

describe("User Model", () => {
  function mockGetLoggedInUserIdFromReq(val?: string) {
    const userId = val ?? getMongoId();
    (getLoggedInUserIdFromReq as jest.Mock).mockReturnValue(userId);
  }

  beforeAll(async () => {
    await connectToTestDB();
    mockGetLoggedInUserIdFromReq();
  });

  afterAll(async () => {
    const TEN_MINUTES = 1000 * 60 * 10;
    await UserModel.deleteMany({
      createdAt: { $gte: Date.now() - TEN_MINUTES },
    });
    await disconnectFromTestDB();
  });

  describe("User Schema", () => {
    const requiredFields = [
      {
        field: "username",
        msg: "Please provide a username",
      },
      {
        field: "password",
        msg: "Please provide a password",
      },
      {
        field: "passwordConfirm",
        msg: "Please confirm your password",
      },
      {
        field: "email",
        msg: "Please provide your email",
      },
      {
        field: "fullname",
        msg: "Please provide your full name",
      },
    ];

    it.each(requiredFields)("should enforce required $field", async required => {
      const userCreds = createValidUserCreds();
      delete userCreds[required.field as keyof typeof userCreds];
      const user = new UserModel(userCreds);

      await expect(user.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(required.msg),
        }),
      );
    });

    it("should enforce username length constraints", async () => {
      const [userCredsWithShortName, userCredsWithLongName] = [
        createValidUserCreds(),
        createValidUserCreds(),
      ];
      userCredsWithShortName.username = "a";
      userCredsWithLongName.username = "a".repeat(21);
      const userWithShortName = new UserModel(userCredsWithShortName);
      const userWithLongName = new UserModel(userCredsWithLongName);

      const expectedErrMsg = "username must be between 3 and 20 characters";

      await expect(userWithShortName.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );
      await expect(userWithLongName.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );
    });

    it("should enforce password length constraints", async () => {
      const [userCredsWithShortPassword, userCredsWithLongPassword] = [
        createValidUserCreds(),
        createValidUserCreds(),
      ];
      userCredsWithShortPassword.password = "a";
      userCredsWithLongPassword.password = "a".repeat(21);
      const userWithShortPassword = new UserModel(userCredsWithShortPassword);
      const userWithLongPassword = new UserModel(userCredsWithLongPassword);

      const expectedErrMsg = "password must be between 8 and 20 characters";

      await expect(userWithShortPassword.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );
      await expect(userWithLongPassword.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );
    });

    it("should enforce password and passwordConfirm equality", async () => {
      const [userCredsWithMatchingPasswords, userCredsWithNonMatchingPasswords] = [
        createValidUserCreds(),
        createValidUserCreds(),
      ];

      userCredsWithNonMatchingPasswords.passwordConfirm = "notMatching";

      const userWithMatchingPasswords = new UserModel(userCredsWithMatchingPasswords);
      const userWithNonMatchingPasswords = new UserModel(userCredsWithNonMatchingPasswords);

      const expectedErrMsg = "passwords must match";

      await expect(userWithMatchingPasswords.save()).resolves.toBeDefined();

      await expect(userWithNonMatchingPasswords.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );

      await UserModel.findByIdAndDelete(userWithMatchingPasswords._id);
    });

    it("should enforce email format", async () => {
      const [userCredsWithInvalidEmail, userCredsWithValidEmail] = [
        createValidUserCreds(),
        createValidUserCreds(),
      ];
      userCredsWithInvalidEmail.email = "invalidEmail";
      const userWithInvalidEmail = new UserModel(userCredsWithInvalidEmail);
      const userWithValidEmail = new UserModel(userCredsWithValidEmail);

      const expectedErrMsg = "Please provide a valid email";

      await expect(userWithInvalidEmail.save()).rejects.toThrow(
        expect.objectContaining({
          name: "ValidationError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );

      await expect(userWithValidEmail.save()).resolves.toBeDefined();

      await UserModel.findByIdAndDelete(userWithValidEmail._id);
    });

    it("should enforce unique email", async () => {
      const [userCredsWithUniqueEmail, userCredsWithDuplicateEmail] = [
        createValidUserCreds(),
        createValidUserCreds(),
      ];

      userCredsWithDuplicateEmail.email = userCredsWithUniqueEmail.email;

      const userWithUniqueEmail = new UserModel(userCredsWithUniqueEmail);
      const userWithDuplicateEmail = new UserModel(userCredsWithDuplicateEmail);
      const expectedErrMsg = "E11000 duplicate key error collection";

      await expect(userWithUniqueEmail.save()).resolves.toBeDefined();

      await expect(userWithDuplicateEmail.save()).rejects.toThrow(
        expect.objectContaining({
          name: "MongoServerError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );

      await UserModel.findByIdAndDelete(userWithUniqueEmail._id);
    });

    it("should enforce unique username", async () => {
      const [userCredsWithUniqueUsername, userCredsWithDuplicateUsername] = [
        createValidUserCreds(),
        createValidUserCreds(),
      ];

      userCredsWithDuplicateUsername.username = userCredsWithUniqueUsername.username;

      const userWithUniqueUsername = new UserModel(userCredsWithUniqueUsername);
      const userWithDuplicateUsername = new UserModel(userCredsWithDuplicateUsername);

      const expectedErrMsg = "E11000 duplicate key error collection";

      await expect(userWithUniqueUsername.save()).resolves.toBeDefined();

      await expect(userWithDuplicateUsername.save()).rejects.toThrow(
        expect.objectContaining({
          name: "MongoServerError",
          message: expect.stringContaining(expectedErrMsg),
        }),
      );

      await UserModel.findByIdAndDelete(userWithUniqueUsername._id);
    });

    it("should set default values", async () => {
      const userCreds = createValidUserCreds();

      const user = new UserModel(userCreds);

      expect(user.active).toEqual(true);
      expect(user.loginAttempts).toEqual(0);
      expect(user.lockedUntil).toEqual(0);
    });
  });

  describe("User Model Pre-find Hook", () => {
    it("should only find active users when options.active is not false", async () => {
      const numOfCurrentActiveUsers = await UserModel.countDocuments({
        active: { $ne: false },
      });
      const inactiveUser = new UserModel({
        ...createValidUserCreds(),
        active: false,
      });
      await inactiveUser.save();

      const users = await UserModel.find();
      expect(users).toHaveLength(numOfCurrentActiveUsers);

      await UserModel.findByIdAndDelete(inactiveUser._id);
    });

    it("should find all users, including inactive ones, when options.active is false", async () => {
      const numOfCurrentUsers = await UserModel.countDocuments();
      const inactiveUser = new UserModel({
        ...createValidUserCreds(),
        active: false,
      });
      await inactiveUser.save();

      const users = await UserModel.find({}, {}, { active: false });
      expect(users).toHaveLength(numOfCurrentUsers + 1);
      await UserModel.findByIdAndDelete(inactiveUser._id);
    });
  });

  describe("1) Pre-save Hook - Hash Password", () => {
    it("should hash password before saving if password was modified", async () => {
      const spyHashPassword = jest.spyOn(bcrypt, "hash");
      const userCreds = createValidUserCreds();
      const user = new UserModel(userCreds);

      await user.save();

      expect(spyHashPassword).toHaveBeenCalledTimes(1);
      expect(spyHashPassword).toHaveBeenCalledWith(userCreds.password, 12);
      expect(user.password).not.toEqual(userCreds.password);
      expect(user.passwordConfirm).toEqual("");
      await UserModel.findByIdAndDelete(user._id);
      spyHashPassword.mockRestore();
    });

    it("should not hash password before saving if password was not modified", async () => {
      const spyHashPassword = jest.spyOn(bcrypt, "hash");
      const userCreds = createValidUserCreds();
      const user = new UserModel(userCreds);

      await user.save();
      const spyHashPasswordCalls = spyHashPassword.mock.calls.length;
      await UserModel.findByIdAndUpdate(user._id, { username: "newUsername" });

      expect(spyHashPassword).toHaveBeenCalledTimes(spyHashPasswordCalls);
      expect(user.password).not.toEqual(userCreds.password);
      expect(user.passwordConfirm).toEqual("");
      await UserModel.findByIdAndDelete(user._id);
      spyHashPassword.mockRestore();
    });
  });

  describe("User Model Methods", () => {
    describe("User Model Methods - checkPassword", () => {
      it("should return true if the candidate password matches the user password", async () => {
        const candidatePassword = "password123";
        const userPassword = await bcrypt.hash(candidatePassword, 12);

        const user = new UserModel();
        const isMatch = await user.checkPassword(candidatePassword, userPassword);

        expect(isMatch).toBe(true);
      });

      it("should return false if the candidate password does not match the user password", async () => {
        const candidatePassword = "wrongPassword";
        const userPassword = await bcrypt.hash("password123", 12);

        const user = new UserModel();
        const isMatch = await user.checkPassword(candidatePassword, userPassword);

        expect(isMatch).toBe(false);
      });

      it("should call bcrypt.compare with the correct arguments", async () => {
        const candidatePassword = "password123";
        const userPassword = await bcrypt.hash(candidatePassword, 12);
        const bcryptCompareSpy = jest.spyOn(bcrypt, "compare");

        const user = new UserModel();
        await user.checkPassword(candidatePassword, userPassword);

        expect(bcryptCompareSpy).toHaveBeenCalledWith(candidatePassword, userPassword);
      });
    });

    describe("User Schema changedPasswordAfter method", () => {
      it("should return false if passwordChangedAt is not set", () => {
        const user = new UserModel();
        user.passwordChangedAt = undefined;
        const result = user.changedPasswordAfter(1629456432);
        expect(result).toBe(false);
      });

      it("should return false if the JWT timestamp is greater than or equal to the passwordChangedAt timestamp", () => {
        const user = new UserModel();
        user.passwordChangedAt = new Date("2022-01-01T00:00:00Z");
        const result = user.changedPasswordAfter(1672448400); // Timestamp for '2022-01-01T00:00:00Z'
        expect(result).toBe(false);

        const user2 = new UserModel();
        user2.passwordChangedAt = new Date("2022-01-01T00:00:00Z");
        const result2 = user2.changedPasswordAfter(1672448399); // Timestamp for '2022-01-01T00:00:00Z'
        expect(result2).toBe(false);
      });

      it("should return true if the JWT timestamp is less than the passwordChangedAt timestamp", () => {
        const user = new UserModel();
        user.passwordChangedAt = new Date("2022-01-01T00:00:00Z");

        const result = user.changedPasswordAfter(1609459200); // Timestamp for '2021-01-01T00:00:00Z'

        expect(result).toBe(true);
      });
    });

    describe("User Schema createPasswordResetToken method", () => {
      it("should create a reset token and set passwordResetToken and passwordResetExpires", async () => {
        const user = new UserModel();
        const resetToken = user.createPasswordResetToken();

        // Check that the reset token is defined and has the expected length
        expect(resetToken).toBeDefined();
        expect(resetToken.length).toBe(64); // Hex string from 32-byte buffer

        // Check that the passwordResetToken is a sha256 hash of the resetToken
        const expectedResetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        expect(user.passwordResetToken).toEqual(expectedResetTokenHash);

        const TEN_MINUTES = 10 * 60 * 1000;
        const expectedExpiryTime = Date.now() + TEN_MINUTES;

        expect(user.passwordResetExpires?.getTime()).toBeGreaterThanOrEqual(
          expectedExpiryTime - 500,
        );
        expect(user.passwordResetExpires?.getTime()).toBeLessThanOrEqual(expectedExpiryTime + 500);
      });

      it("should return the reset token", () => {
        const user = new UserModel();
        const resetToken = user.createPasswordResetToken();
        const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        expect(resetTokenHash).toEqual(user.passwordResetToken);
      });
    });
  });
});
