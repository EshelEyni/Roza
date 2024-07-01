/* eslint-disable @typescript-eslint/no-explicit-any */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { User } from "../../../../shared/types/user";
import router from "./userRouter";
import { errorHandler } from "../../services/error/errorService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import { createTestUser, deleteTestUser } from "../../services/test/testUtilService";
import { assertUser } from "../../services/test/testAssertionService";
import setupAsyncLocalStorage from "../../middlewares/setupALS/setupALSMiddleware";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.all("*", setupAsyncLocalStorage);
app.use(router);
app.use(errorHandler);

describe("User Router: GET Actions", () => {
  let validUser: User;

  beforeAll(async () => {
    await connectToTestDB();
    validUser = await createTestUser({});
  });

  afterAll(async () => {
    await deleteTestUser(validUser.id);
    await disconnectFromTestDB();
  });

  describe("GET /", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should return 200 and an array of users if users match the query", async () => {
      const res = await request(app).get("/");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        status: "success",
        requestedAt: expect.any(String),
        results: expect.any(Number),
        data: expect.any(Array),
      });
      const users = res.body.data;
      expect(users.length).toBeGreaterThan(0);
      users.forEach(assertUser);
    });
  });

  describe("GET /:id", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should return 200 and a user if a user with the given ID exists", async () => {
      const res = await request(app).get(`/${validUser.id}`);
      expect(res.statusCode).toEqual(200);
      const user = res.body.data;
      assertUser(user);
      expect(user.username).toEqual(validUser.username);
      expect(user.email).toEqual(validUser.email);
    });
  });

  describe("GET /username/:username", () => {
    it("should return 200 and the user data if the user is found", async () => {
      const res = await request(app).get(`/username/${validUser.username}`);
      expect(res.statusCode).toEqual(200);
      const user = res.body.data;
      assertUser(user);
      expect(user.username).toEqual(validUser.username);
      expect(user.email).toEqual(validUser.email);
    });
  });
});
