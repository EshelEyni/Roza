import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import router from "./authRouter";
import { errorHandler } from "../../services/error/errorService";
import { UserCredenitials } from "../../../../shared/types/user";
import { getLoginTokenStrForTest } from "../../services/test/testUtilService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import { UserModel } from "../../models/user/userModel";
import setupAsyncLocalStorage from "../../middlewares/setupALS/setupALSMiddleware";
import { assertUser } from "../../services/test/testAssertionService";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.all("*", setupAsyncLocalStorage);
app.use(router);
app.use(errorHandler);

jest.mock("../../services/rateLimiterService", () => ({
  authRequestLimiter: jest.fn().mockImplementation((req, res, next) => next()),
}));

jest.mock("../../services/util/utilService", () => ({
  ...jest.requireActual("../../services/util/utilService"),
  sendEmail: jest.fn(),
}));

describe("auth Router", () => {
  const username = "test-user";
  const password = "password";
  const email = "email@testemail.com";
  let token: string, cleanToken: string, resetToken: string;

  async function createTestUserAndToken({ createResetToken = false } = {}) {
    await deleteTestUser();
    const createdUser = await UserModel.create({
      username,
      fullname: "Test User",
      email,
      password,
      passwordConfirm: password,
      weight: 120,
      height: 180,
      gender: "male",
      birthdate: new Date("1990-01-01"),
    });
    token = getLoginTokenStrForTest(createdUser.id);
    cleanToken = token.replace("loginToken=", "");

    if (!createResetToken) return;
    resetToken = createdUser.createPasswordResetToken();
    await createdUser.save({ validateBeforeSave: false });
  }

  async function deleteTestUser() {
    await UserModel.findOneAndDelete({ username });
  }

  beforeAll(async () => {
    await connectToTestDB();
  });

  afterAll(async () => {
    await deleteTestUser();
    await disconnectFromTestDB();
  });

  describe("POST /login/with-token", () => {
    beforeAll(async () => {
      await createTestUserAndToken();
    });

    it("should handle auto-login", async () => {
      const response = await request(app).post("/login/with-token").set("Cookie", [token]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: expect.any(Object),
        token: cleanToken,
      });
      assertUser(response.body.data);
    });

    it("should send a succesfull response with no user if an invalid token is provided in production environment", async () => {
      process.env.NODE_ENV = "production";
      const response = await request(app)
        .post("/login/with-token")
        .set("Cookie", ["loginToken=invalid-token"]);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: null,
      });
      process.env.NODE_ENV = "test";
    });

    it("should send a a 400 error if an invalid token is provided in test or development evnironment", async () => {
      const response = await request(app)
        .post("/login/with-token")
        .set("Cookie", ["loginToken=invalid-token"]);
      expect(response.body.status).toBe("fail");
      expect(response.body.message).toBe("Invalid token");
    });

    it("should send a succesfull response with no user if an invalid token is provided in production environment", async () => {
      process.env.NODE_ENV = "production";
      const response = await request(app).post("/login/with-token");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: null,
      });
      process.env.NODE_ENV = "test";
    });

    it("should send a 401 error if no token is provided", async () => {
      const response = await request(app).post("/login/with-token");
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("You are not logged in");
    });
  });

  describe("POST /login", () => {
    beforeAll(async () => {
      await createTestUserAndToken();
    });

    afterAll(async () => {
      await deleteTestUser();
    });

    it("should handle login", async () => {
      const response = await request(app).post("/login").send({ username, password });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: expect.any(Object),
        token: expect.any(String),
      });
      const user = response.body.data;
      assertUser(user);
      expect(user.username).toEqual(username);
      expect(user.email).toEqual(email);
    });

    it("should send a 400 error if no username is provided", async () => {
      const response = await request(app).post("/login").send({ password });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Username and password are required");
    });

    it("should send a 400 error if no password is provided", async () => {
      const response = await request(app).post("/login").send({ username });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Username and password are required");
    });

    it("should send a 400 error if no username and password are provided", async () => {
      const response = await request(app).post("/login");
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Username and password are required");
    });

    it("should send a 404 error if the user is not found", async () => {
      await UserModel.findOneAndDelete({ username: "userToRemove" });
      const response = await request(app)
        .post("/login")
        .send({ username: "userToRemove", password: "password" });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it("should send a 401 error if the username or password is incorrect", async () => {
      const response = await request(app)
        .post("/login")
        .send({ username, password: "wrongPassword" });
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Incorrect password");
    });
  });

  describe("POST /signup", () => {
    const mockUserCredenitials: UserCredenitials = {
      username: username,
      fullname: "Test User",
      email: email,
      password,
      passwordConfirm: password,
    };

    beforeAll(async () => {
      await deleteTestUser();
    });

    afterAll(async () => {
      await deleteTestUser();
    });

    it("should handle signup", async () => {
      const response = await request(app).post("/signup").send(mockUserCredenitials);
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        status: "success",
        data: expect.any(Object),
        token: expect.any(String),
      });
      const user = response.body.data;
      assertUser(user);
      expect(user.username).toEqual(username);
      expect(user.email).toEqual(email);
    });

    it("should send a 400 error if no userCredentials is provided", async () => {
      const response = await request(app).post("/signup");
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("User credentials are required");
    });

    fit.each(Object.keys(mockUserCredenitials))(
      "should send a 400 error if %s is not provided",
      async key => {
        const userCredentials = { ...mockUserCredenitials };
        delete userCredentials[key as keyof UserCredenitials];
        const response = await request(app).post("/signup").send(userCredentials);
        expect(response.status).toBe(400);
        expect(response.body.message).toBe(`${key} is required`);
      },
    );
  });

  describe("POST /logout", () => {
    beforeAll(async () => {
      await createTestUserAndToken();
    });

    it("should handle logout", async () => {
      const response = await request(app).post("/logout");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: {
          msg: "Logged out successfully",
        },
      });
      expect(response.get("Set-Cookie")).toEqual([
        "loginToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      ]);
    });
  });

  describe("POST /updatePassword", () => {
    beforeAll(async () => {
      await createTestUserAndToken();
    });

    afterAll(async () => {
      await deleteTestUser();
    });

    const mockReqBody = {
      currentPassword: password,
      newPassword: "newPassword",
      newPasswordConfirm: "newPassword",
    };

    it("should handle update password", async () => {
      const response = await request(app)
        .patch("/updatePassword")
        .set("Cookie", [token])
        .send(mockReqBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: expect.any(Object),
        token: expect.any(String),
      });

      const user = response.body.data;
      assertUser(user);
      expect(user.username).toEqual(username);
      expect(user.email).toEqual(email);
    });

    it.each(Object.keys(mockReqBody))(
      "should send a 400 error if %s is not provided",
      async key => {
        const reqBody = { ...mockReqBody };
        delete reqBody[key as keyof typeof mockReqBody];
        const response = await request(app)
          .patch("/updatePassword")
          .set("Cookie", [token])
          .send(reqBody);
        expect(response.status).toBe(400);
        expect(response.body.message).toBe(`${key} is required`);
      },
    );

    it("should send a 400 error if newPassword and newPasswordConfirm do not match", async () => {
      const response = await request(app)
        .patch("/updatePassword")
        .set("Cookie", [token])
        .send({
          ...mockReqBody,
          newPasswordConfirm: "wrongNewPasswordConfirm",
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Passwords do not match");
    });
  });

  describe("POST /forgotPassword", () => {
    beforeAll(async () => {
      await createTestUserAndToken();
    });

    afterAll(async () => {
      await deleteTestUser();
    });

    it("should handle forgot password", async () => {
      const response = await request(app).post("/forgotPassword").send({ email });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        message: "Password reset email sent successfully",
      });
    });

    it("should send a 400 error if no email is provided", async () => {
      const response = await request(app).post("/forgotPassword");
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email is required");
    });

    it("should send a 400 error if email is invalid", async () => {
      const response = await request(app).post("/forgotPassword").send({
        email: "invalid-email",
      });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email is invalid");
    });

    it("should send a 404 error if there is no user with email address", async () => {
      const email = "removedUserEmail@email.com";
      await UserModel.findOneAndDelete({ email });
      const response = await request(app).post("/forgotPassword").send({ email });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("There is no user with email address");
    });
  });

  describe("POST /resetPassword", () => {
    afterAll(async () => {
      await deleteTestUser();
    });

    const mockReqBody = {
      password,
      passwordConfirm: password,
    };

    it("should handle reset password", async () => {
      await createTestUserAndToken({ createResetToken: true });

      const response = await request(app).patch(`/resetPassword/${resetToken}`).send(mockReqBody);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "success",
        data: expect.any(Object),
        token: expect.any(String),
      });
      const user = response.body.data;
      assertUser(user);
      expect(user.username).toEqual(username);
      expect(user.email).toEqual(email);
      await deleteTestUser();
    });

    it.each(Object.keys(mockReqBody))(
      "should send a 400 error if %s is not provided",
      async key => {
        const reqBody = { ...mockReqBody };
        delete reqBody[key as keyof typeof mockReqBody];
        const response = await request(app).patch("/resetPassword/some-token").send(reqBody);
        expect(response.status).toBe(400);
        expect(response.body.message).toBe(`${key} is required`);
      },
    );
  });
});
