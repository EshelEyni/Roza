/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import router from "./userRouter";
import { UserModel } from "../../../models/user/userModel";
import userService from "../service/userService";
import {
  connectToTestDB,
  disconnectFromTestDB,
  errorHandler,
  setupAsyncLocalStorage,
  createTestUser,
  getLoginTokenStrForTest,
} from "@rozaeyni/common";

import { User } from "@rozaeyni/common-types";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.all("*", setupAsyncLocalStorage);
app.use(router);
app.use(errorHandler);

describe("User Router: Logged In User Actions", () => {
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
    await disconnectFromTestDB();
  });

  describe("PATCH /loggedInUser", () => {
    beforeAll(async () => {
      await createAndSetTestLoggedInUserAndToken();
    });

    it("should successfully update logged in user", async () => {
      await UserModel.findByIdAndUpdate(testLoggedInUser.id, { bio: "" });
      const updateData = {
        fullname: "test update user fullname",
      };

      const res = await request(app).patch(`/loggedInUser`).send(updateData).set("Cookie", [token]);
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual("success");
      const updatedUser = res.body.data as User;
      expect(updatedUser.id).toEqual(testLoggedInUser.id);
      expect(updatedUser.fullname).toEqual(updateData.fullname);
    });

    it("should not update unallowed fields", async () => {
      const updateData = {
        isAdmin: true,
      };

      const res = await request(app).patch(`/loggedInUser`).send(updateData).set("Cookie", [token]);
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual("success");
      const updatedUser = res.body.data as User;
      expect(updatedUser.id).toEqual(testLoggedInUser.id);
    });

    it("should return 400 for invalid update data", async () => {
      const invalidUpdateData = {};

      const res = await request(app)
        .patch(`/loggedInUser`)
        .send(invalidUpdateData)
        .set("Cookie", [token]);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain(
        "No data received in the request. Please provide some properties to update.",
      );
    });

    it("should handle unexpected errors", async () => {
      jest.spyOn(userService, "update").mockRejectedValueOnce(new Error("Unexpected error"));

      const updateData = {
        bio: "testing update user bio",
      };

      const res = await request(app).patch(`/loggedInUser`).send(updateData).set("Cookie", [token]);
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toContain("Unexpected error");
    });

    it("should return 401 if the user is not logged in", async () => {
      const updateData = {
        username: "newUsername",
        email: "newEmail@example.com",
      };

      const res = await request(app).patch(`/loggedInUser`).send(updateData);
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain("You are not logged in! Please log in to get access.");
    });
  });

  describe("DELETE /loggedInUser", () => {
    async function setUserToActive() {
      await UserModel.findByIdAndUpdate(testLoggedInUser.id, { active: true }).setOptions({
        active: false,
        skipHooks: true,
      });
    }

    beforeAll(async () => {
      await createAndSetTestLoggedInUserAndToken();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should successfully deactivate the logged in user's account", async () => {
      await setUserToActive();
      const res = await request(app).delete(`/loggedInUser`).set("Cookie", [token]);
      expect(res.statusCode).toEqual(204);
      const deactivatedUser = await UserModel.findOne({
        _id: testLoggedInUser.id,
        active: false,
      }).setOptions({
        active: false,
        skipHooks: true,
      });

      expect(deactivatedUser?.id).toEqual(testLoggedInUser.id);
      await setUserToActive();
    });

    it("should return an error if user is not logged in", async () => {
      const res = await request(app).delete(`/loggedInUser`);
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual("You are not logged in! Please log in to get access.");
    });

    it("should return an error if there's an issue deleting the user", async () => {
      jest.spyOn(userService, "removeAccount").mockRejectedValueOnce(new Error("Deletion error"));

      const res = await request(app).delete(`/loggedInUser`).set("Cookie", [token]);
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toEqual("Deletion error");
    });
  });
});
