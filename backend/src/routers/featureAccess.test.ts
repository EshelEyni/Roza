import express from "express";
import request from "supertest";
import authRouter from "./auth/authRouter";
import bookRouter from "./book/bookRouter";
import devBoardRouter from "./devBoard/devBoardRouter";
import readerRouter from "./reader/readerRouter";
import { UserModel } from "../models/user/userModel";
import tokenService from "../services/token/tokenService";
import { errorHandler } from "../services/error/errorService";

jest.mock("../services/token/tokenService");
jest.mock("../models/user/userModel", () => ({ UserModel: { findById: jest.fn(), create: jest.fn() } }));
jest.mock("../controllers/book/bookController", () => ({
  getBooks: (_req: express.Request, res: express.Response) => res.sendStatus(204),
  getManuscripts: (_req: express.Request, res: express.Response) => res.sendStatus(204),
  getBookById: jest.fn(), addBook: jest.fn(), updateBook: jest.fn(),
}));
jest.mock("../controllers/reader/studioPublicationController", () => ({
  downloadStudioEpub: (_req: express.Request, res: express.Response) => res.sendStatus(204),
  publishStudioBook: (_req: express.Request, res: express.Response) => res.sendStatus(204),
}));

const priorReaderId = "507f1f77bcf86cd799439011";
const otherId = "507f1f77bcf86cd799439012";
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/book", bookRouter);
app.use("/api/dev-board", devBoardRouter);
app.use("/api/reader", readerRouter);
app.use(errorHandler);

function account(id: string, roles?: unknown) {
  (tokenService.getTokenFromRequest as jest.Mock).mockImplementation(req => req.headers.authorization);
  (tokenService.verifyToken as jest.Mock).mockResolvedValue({ id, timeStamp: 1 });
  (UserModel.findById as jest.Mock).mockReturnValue({
    setOptions: () => ({ exec: async () => ({ roles, changedPasswordAfter: () => false }) }),
  });
}

const paths = [
  "/api/book",
  "/api/book/manuscripts",
  "/api/dev-board/access",
  "/api/auth/features/staging-room",
  "/api/auth/features/local-audiobooks",
];
const readerPath = "/api/reader/access";
const studio = "/api/reader/studio/" + otherId;

describe("role-based feature access", () => {
  it("requires a session for protected endpoints", async () => {
    account(otherId, ["admin"]);
    for (const path of [...paths, readerPath]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });

  it("enables the same features for admins with different IDs", async () => {
    for (const id of [priorReaderId, otherId]) {
      account(id, ["user", "admin"]);
      for (const path of paths) {
        expect((await request(app).get(path).set("Authorization", "session")).status).toBe(204);
      }
      const access = await request(app).get(readerPath).set("Authorization", "session");
      expect(access.body.data.enabled).toBe(true);
      expect(access.headers["cache-control"]).toBe("private, no-store");
      expect((await request(app).post(studio + "/epub").set("Authorization", "session")).status).toBe(204);
      expect((await request(app).put(studio + "/publication").set("Authorization", "session")).status).toBe(204);
    }
  });

  it.each([[["user"]], [undefined], ["admin"]])("denies a demoted or legacy account (%j) using its existing session", async roles => {
    account(priorReaderId, ["admin"]);
    expect((await request(app).get("/api/book").set("Authorization", "same-session")).status).toBe(204);
    account(priorReaderId, roles);
    for (const path of [...paths, "/api/reader", "/api/reader/" + otherId + "/file", "/api/reader/" + otherId + "/audiobook/config"]) {
      expect((await request(app).get(path).set("Authorization", "same-session").set("X-Role", "admin")).status).toBe(403);
    }
    expect((await request(app).get(readerPath).set("Authorization", "same-session")).body.data.enabled).toBe(false);
    expect((await request(app).post(studio + "/epub").set("Authorization", "same-session").send({ roles: ["admin"] })).status).toBe(403);
    expect((await request(app).put(studio + "/publication").set("Authorization", "same-session")).status).toBe(403);
    expect((await request(app).post("/api/book").set("Authorization", "same-session")).status).toBe(403);
    expect((await request(app).patch("/api/book/" + otherId).set("Authorization", "same-session")).status).toBe(403);
  });

  it("ignores roles submitted at signup", async () => {
    const credentials = { username: "reader", fullname: "Reader", email: "reader@example.com",
      password: "Example!23", passwordConfirm: "Example!23" };
    (UserModel.create as jest.Mock).mockResolvedValue({ id: otherId, ...credentials, roles: ["user"] });
    (tokenService.signToken as jest.Mock).mockReturnValue("session");
    const response = await request(app).post("/api/auth/signup").send({ ...credentials, roles: ["admin"] });
    expect(response.status).toBe(201);
    expect(UserModel.create).toHaveBeenCalledWith(credentials);
    expect(response.body.data.roles).toEqual(["user"]);
  });
});
