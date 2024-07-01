/* eslint-disable @typescript-eslint/no-explicit-any */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import router from "./userRouter";
import { User } from "../../../../shared/types/user";
import { UserModel } from "../../models/user/userModel";
import {
  createTestUser,
  createValidUserCreds,
  deleteTestUser,
  getLoginTokenStrForTest,
  getMongoId,
} from "../../services/test/testUtilService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import { errorHandler } from "../../services/error/errorService";
import { assertUser } from "../../services/test/testAssertionService";
import setupAsyncLocalStorage from "../../middlewares/setupALS/setupALSMiddleware";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.all("*", setupAsyncLocalStorage);
app.use(router);
app.use(errorHandler);

describe("User Router: Admin Actions", () => {
  const mockedUserID = "64dd30f4937431fdad0f6d92";

  let testLoggedInUser: User, token: string;

  async function createAndSetTestLoggedInUserAndToken({ isAdmin = false } = {}) {
    testLoggedInUser = (await createTestUser({ id: mockedUserID, isAdmin })) as User;
    token = getLoginTokenStrForTest(testLoggedInUser.id);
  }

  beforeAll(async () => {
    await connectToTestDB();
  });

  afterAll(async () => {
    await deleteTestUser(mockedUserID);
    await disconnectFromTestDB();
  });

  describe("POST /", () => {
    const requiredUserProps = ["username", "fullname", "email", "password", "passwordConfirm"];

    const id = getMongoId();

    beforeAll(async () => {
      await createAndSetTestLoggedInUserAndToken({ isAdmin: true });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should successfully add a new user", async () => {
      await deleteTestUser(id);
      const userCreds = createValidUserCreds(id);
      const res = await request(app).post(`/`).send(userCreds).set("Cookie", [token]);
      expect(res.statusCode).toEqual(201); // 201 Created
      expect(res.body.status).toEqual("success");
      const user = res.body.data;

      assertUser(user);
      expect(user.username).toEqual(userCreds.username);
      expect(user.fullname).toEqual(userCreds.fullname);
      expect(user.email).toEqual(userCreds.email);

      await deleteTestUser(id);
    });

    it("should return 401 if the user is not logged in", async () => {
      const userCreds = createValidUserCreds(id);
      const res = await request(app).post(`/`).send(userCreds);
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual("You are not logged in! Please log in to get access.");
    });

    it("should return 403 if the user is not an admin", async () => {
      await createAndSetTestLoggedInUserAndToken({ isAdmin: false });
      const userCreds = createValidUserCreds(id);
      const res = await request(app).post(`/`).send(userCreds).set("Cookie", [token]);
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toEqual("You do not have permission to perform this action");
      await createAndSetTestLoggedInUserAndToken({ isAdmin: true });
    });

    it.each(requiredUserProps)("should return 400 if %s is not provided", async (prop: string) => {
      const invalidUserCreds = createValidUserCreds(id);
      delete invalidUserCreds[prop as keyof typeof invalidUserCreds];
      const res = await request(app).post(`/`).send(invalidUserCreds).set("Cookie", [token]);
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toContain(`User validation failed:`);
    });

    it("should return an error if there's an unexpected issue during user creation", async () => {
      const newUser = createValidUserCreds(id);
      jest.spyOn(UserModel, "create").mockRejectedValueOnce(new Error("Database error"));
      const res = await request(app).post(`/`).send(newUser).set("Cookie", [token]);
      expect(res.statusCode).toEqual(500); // Internal Server Error
      expect(res.body.message).toEqual("Database error");
    });
  });

  describe("User Router - PATCH /:id", () => {
    beforeAll(async () => {
      await createAndSetTestLoggedInUserAndToken({ isAdmin: true });
    });

    const updateData = { fullname: "test fullname" };

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should successfully update a user by id", async () => {
      const userId = getMongoId();
      const testUser = await createTestUser({ id: userId });
      testUser.fullname = "test fullname";

      const res = await request(app).patch(`/${userId}`).send(testUser).set("Cookie", [token]);
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual("success");
      const user = res.body.data as User;
      expect(user.id).toEqual(userId);
      expect(user.fullname).toEqual(testUser.fullname);
      await deleteTestUser(userId);
    });

    it("should return 401 if the user is not logged in", async () => {
      const userId = getMongoId();
      const testUser = await createTestUser({ id: userId });

      const res = await request(app).patch(`/${userId}`).send(testUser);

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual("You are not logged in! Please log in to get access.");
      await deleteTestUser(userId);
    });

    it("should return 403 if the user is not an admin", async () => {
      await createAndSetTestLoggedInUserAndToken({ isAdmin: false });
      const userId = getMongoId();
      const testUser = await createTestUser({ id: userId });

      const res = await request(app).patch(`/${userId}`).send(testUser).set("Cookie", [token]);

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toEqual("You do not have permission to perform this action");
      await createAndSetTestLoggedInUserAndToken({ isAdmin: true });
      await deleteTestUser(userId);
    });

    it("should return 400 if provided id is not a valid MongoDB ObjectId", async () => {
      const invalidUserId = "invalidId";

      const res = await request(app)
        .patch(`/${invalidUserId}`)
        .send(updateData)
        .set("Cookie", [token]);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain("Invalid user id: invalidId");
    });

    it("should return 404 if user with provided id is not found", async () => {
      const nonExistentUserId = getMongoId();
      await deleteTestUser(nonExistentUserId);

      const res = await request(app)
        .patch(`/${nonExistentUserId}`)
        .send(updateData)
        .set("Cookie", [token]);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain(`No user was found with the id: ${nonExistentUserId}`);
    });

    it("should return 500 if an internal server error occurs", async () => {
      const userId = getMongoId();

      jest.spyOn(UserModel, "findByIdAndUpdate").mockImplementationOnce(() => {
        throw new Error("Internal server error");
      });

      const res = await request(app).patch(`/${userId}`).send(updateData).set("Cookie", [token]);

      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toContain("Internal server error");
    });
  });

  describe("DELETE /:id", () => {
    const mockId = getMongoId();
    beforeAll(async () => {
      await createAndSetTestLoggedInUserAndToken({ isAdmin: true });
    });

    afterAll(async () => {
      await deleteTestUser(mockId);
    });

    it("should successfully delete a user by ID", async () => {
      await createTestUser({ id: mockId });

      const res = await request(app).delete(`/${mockId}`).set("Cookie", [token]);
      expect(res.statusCode).toEqual(204);
    });

    it("should return 401 if the user is not logged in", async () => {
      const res = await request(app).delete(`/${mockId}`);
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual("You are not logged in! Please log in to get access.");
    });

    it("should return 403 if the user is not an admin", async () => {
      await createAndSetTestLoggedInUserAndToken({ isAdmin: false });
      const res = await request(app).delete(`/${mockId}`).set("Cookie", [token]);
      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toEqual("You do not have permission to perform this action");
      await createAndSetTestLoggedInUserAndToken({ isAdmin: true });
    });

    it("should return 404 if user is not found", async () => {
      await deleteTestUser(mockId);

      const res = await request(app).delete(`/${mockId}`).set("Cookie", [token]);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toEqual(`No user was found with the id: ${mockId}`);
    });

    it("should return 400 for invalid MongoDB ID", async () => {
      const invalidId = "invalidId";
      const res = await request(app).delete(`/${invalidId}`).set("Cookie", [token]);
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(`Invalid user id: ${invalidId}`);
    });

    it("should handle unexpected errors", async () => {
      jest.spyOn(UserModel, "findByIdAndDelete").mockImplementationOnce(() => {
        throw new Error("Unexpected error");
      });

      const res = await request(app).delete(`/${mockId}`).set("Cookie", [token]);
      expect(res.statusCode).toEqual(500);
    });
  });
});
