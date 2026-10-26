import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import readerRouter from "./readerRouter";
import { defaultReaderPreferences } from "../../services/reader/readerUtilService";

jest.mock("../../services/reader/googleTranslateService", () => ({
  translateReaderWord: jest.fn().mockResolvedValue(null),
}));

let mockUserId = "507f1f77bcf86cd799439011";
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockUserId }));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization ? next() : res.status(401).json({ status: "fail" }),
}));
jest.mock("../../models/reader/readerBookModel", () => ({
  ReaderBookModel: {
    exists: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use("/api/reader", readerRouter);
app.use(
  (
    err: { statusCode?: number; message: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    res.status(err.statusCode || 500).json({ status: "fail", message: err.message });
  },
);
const id = "507f191e810c19729de860ea";

describe("Reader access and isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = "507f1f77bcf86cd799439011";
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockUserId;
  });

  it("requires authentication even for the access endpoint", async () => {
    expect((await request(app).get("/api/reader/access")).status).toBe(401);
  });

  it("hides the feature and denies direct requests when disabled or unlisted", async () => {
    process.env.READER_ENABLED = "false";
    expect(
      (await request(app).get("/api/reader/access").set("Authorization", "test")).body.data.enabled,
    ).toBe(false);
    expect((await request(app).get("/api/reader").set("Authorization", "test")).status).toBe(403);
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = "another-user";
    expect(
      (
        await request(app)
          .get("/api/reader/" + id + "/file")
          .set("Authorization", "test")
      ).status,
    ).toBe(403);
    expect(ReaderBookModel.findOne).not.toHaveBeenCalled();
  });

  it("scopes the library to the current owner and forbids caching", async () => {
    (ReaderBookModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const response = await request(app).get("/api/reader").set("Authorization", "test");
    expect(response.status).toBe(200);
    expect(ReaderBookModel.find).toHaveBeenCalledWith({ userId: mockUserId });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it.each(["", "/file", "/state"])("never accesses another user's book on %s", async suffix => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const operation =
      suffix === "/state"
        ? request(app)
            .patch("/api/reader/" + id + suffix)
            .send({})
        : request(app).get("/api/reader/" + id + suffix);
    const response = await operation.set("Authorization", "test");
    expect(response.status).toBe(404);
    expect(ReaderBookModel.findOne).toHaveBeenCalledWith({ _id: id, userId: mockUserId });
  });

  it("validates state and persists only approved fields with a stale-save guard", async () => {
    const existing = { _id: id, state: { location: "", progress: 0 } };
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(existing),
    });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue(existing);
    const state = {
      location: "epubcfi(/6/2!/4/2/1:0)",
      progress: 0.2,
      savedAt: Date.now(),
      preferences: defaultReaderPreferences,
    };
    const invalid = await request(app)
      .patch("/api/reader/" + id + "/state")
      .set("Authorization", "test")
      .send({ ...state, preferences: { ...defaultReaderPreferences, fontSize: 900 } });
    expect(invalid.status).toBe(400);
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
    const valid = await request(app)
      .patch("/api/reader/" + id + "/state")
      .set("Authorization", "test")
      .send({ ...state, userId: "attacker", fileId: "attacker" });
    expect(valid.status).toBe(200);
    const [filter, update] = (ReaderBookModel.findOneAndUpdate as jest.Mock).mock.calls[0];
    expect(filter.userId).toBe(mockUserId);
    expect(filter.$or[0]["state.savedAt"].$lte).toBe(state.savedAt);
    expect(update).toEqual({ $set: { state } });
  });

  it.each(["screen", "publisher", undefined])("persists page numbering %s and supports older clients", async pageNumbering => {
    const existing = { _id: id, state: { location: "", progress: 0 } };
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(existing) });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue(existing);
    const response = await request(app).patch("/api/reader/" + id + "/state")
      .set("Authorization", "test")
      .send({ location: "epubcfi(/6/2!/4/2/1:0)", progress: .2, savedAt: Date.now(), preferences: { ...defaultReaderPreferences, pageNumbering } });
    expect(response.status).toBe(200);
    expect((ReaderBookModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set.state.preferences.pageNumbering).toBe(pageNumbering || "screen");
  });

  it("rejects unsupported page numbering", async () => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: id }) });
    const response = await request(app).patch("/api/reader/" + id + "/state")
      .set("Authorization", "test")
      .send({ location: "epubcfi(/6/2!/4/2/1:0)", progress: .2, savedAt: Date.now(), preferences: { ...defaultReaderPreferences, pageNumbering: "invented" } });
    expect(response.status).toBe(400);
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("reports oversized uploads before storage", async () => {
    const response = await request(app)
      .post("/api/reader")
      .set("Authorization", "test")
      .set("Content-Type", "application/epub+zip")
      .send(Buffer.alloc(25 * 1024 * 1024 + 1));
    expect(response.status).toBe(413);
    expect(response.body.message).toContain("25 MiB");
    expect(ReaderBookModel.create).not.toHaveBeenCalled();
  });

  it("rejects non-EPUB upload bodies before storage", async () => {
    const response = await request(app)
      .post("/api/reader")
      .set("Authorization", "test")
      .send({ filename: "book.epub" });
    expect(response.status).toBe(400);
    expect(ReaderBookModel.create).not.toHaveBeenCalled();
  });

  it("checks ownership before looking up dictionary words", async () => {
    (ReaderBookModel.exists as jest.Mock).mockResolvedValue(null);
    const response = await request(app)
      .post("/api/reader/" + id + "/dictionary")
      .set("Authorization", "test")
      .send({ word: "child", requestId: "dictionary-request-001" });
    expect(response.status).toBe(404);
    expect(ReaderBookModel.exists).toHaveBeenCalledWith({ _id: id, userId: mockUserId });
  });

  it("reports missing dictionary words without creating vocabulary", async () => {
    (ReaderBookModel.exists as jest.Mock).mockResolvedValue({ _id: id });
    const response = await request(app)
      .post("/api/reader/" + id + "/dictionary")
      .set("Authorization", "test")
      .send({ word: "zzzxxyy", requestId: "dictionary-request-002" });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ entry: null });
    expect(response.headers["cache-control"]).toContain("no-store");
  });

  it("rejects phrases and malformed lookup identifiers before database access", async () => {
    const response = await request(app)
      .post("/api/reader/" + id + "/dictionary")
      .set("Authorization", "test")
      .send({ word: "two words", requestId: "short" });
    expect(response.status).toBe(400);
    expect(ReaderBookModel.exists).not.toHaveBeenCalled();
  });

  it.each(["invalid", null, ["google"]])("rejects unsupported lookup provider %p before database access", async provider => {
    const response = await request(app)
      .post("/api/reader/" + id + "/dictionary")
      .set("Authorization", "test")
      .send({ word: "book", requestId: "dictionary-provider-test", provider });
    expect(response.status).toBe(400);
    expect(ReaderBookModel.exists).not.toHaveBeenCalled();
  });
});
