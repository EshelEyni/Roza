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
    aggregate: jest.fn(),
    hydrate: (book: any) => ({ toJSON: () => ({ ...book, id: String(book._id) }) }),
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
    (ReaderBookModel.aggregate as jest.Mock).mockResolvedValue([]);
    const response = await request(app).get("/api/reader").set("Authorization", "test");
    expect(response.status).toBe(200);
    expect(ReaderBookModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      { $match: { userId: expect.anything(), archived: { $ne: true } } }, { $limit: 9 },
    ]));
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("lists archived books separately for the current owner", async () => {
    (ReaderBookModel.aggregate as jest.Mock).mockResolvedValue([]);
    const response = await request(app).get("/api/reader?archived=true").set("Authorization", "test");
    expect(response.status).toBe(200);
    expect((ReaderBookModel.aggregate as jest.Mock).mock.calls[0][0][0].$match).toEqual({ userId: expect.anything(), archived: true });
  });

  it.each([0, 1, 8, 9, 17])("returns eight books and an accurate continuation for %s books", async count => {
    const rows = Array.from({ length: Math.min(count, 9) }, (_, i) => ({
      _id: (100 - i).toString(16).padStart(24, "0"), pin: 0, key: 1000 - i, title: "Book " + i,
    }));
    (ReaderBookModel.aggregate as jest.Mock).mockResolvedValue(rows);
    const response = await request(app).get("/api/reader").set("Authorization", "test");
    expect(response.status).toBe(200);
    expect(response.body.data.books).toHaveLength(Math.min(count, 8));
    if (count <= 8) expect(response.body.data.nextCursor).toBeNull();
    else {
      const cursor = JSON.parse(Buffer.from(response.body.data.nextCursor, "base64url").toString());
      expect(cursor).toMatchObject({ pin: 0, key: rows[7].key, id: rows[7]._id });
      (ReaderBookModel.aggregate as jest.Mock).mockResolvedValue(rows.slice(8));
      const next = await request(app).get("/api/reader?cursor=" + response.body.data.nextCursor).set("Authorization", "test");
      expect(next.body.data.books[0].id).toBe(rows[8]._id);
      const pipeline = (ReaderBookModel.aggregate as jest.Mock).mock.calls[1][0];
      expect(pipeline[2].$match.$or[0]).toEqual({ pin: { $lt: 0 } });
      expect(pipeline[2].$match.$or[1]).toEqual({ pin: 0, key: { $lt: rows[7].key } });
      expect(String(pipeline[2].$match.$or[2]._id.$lt)).toBe(rows[7]._id);
    }
    const pipeline = (ReaderBookModel.aggregate as jest.Mock).mock.calls[0][0];
    expect(pipeline[1]).toEqual({ $addFields: { pin: { $cond: ["$pinned", 1, 0] }, key: { $cond: [
      { $gt: ["$state.savedAt", 0] }, "$state.savedAt", { $toLong: "$createdAt" },
    ] } } });
    expect(pipeline[2]).toEqual({ $sort: { pin: -1, key: -1, _id: -1 } });
  });

  it("traverses a 17-book library with equal activity timestamps without duplicates", async () => {
    const rows = Array.from({ length: 17 }, (_, i) => ({
      _id: (100 - i).toString(16).padStart(24, "0"), pin: i < 10 ? 1 : 0, key: 1000, title: "Book " + i,
    }));
    (ReaderBookModel.aggregate as jest.Mock).mockImplementation(async pipeline => {
      const boundary = pipeline.find((stage: any) => stage.$match?.$or)?.$match.$or;
      const remaining = boundary ? rows.filter(book => book.pin < boundary[0].pin.$lt ||
        (book.pin === boundary[2].pin && book.key === boundary[2].key && book._id < String(boundary[2]._id.$lt))) : rows;
      return remaining.slice(0, 9);
    });
    const ids: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    do {
      const response: request.Response = await request(app).get("/api/reader" + (cursor ? "?cursor=" + cursor : "")).set("Authorization", "test");
      expect(response.status).toBe(200);
      sizes.push(response.body.data.books.length);
      ids.push(...response.body.data.books.map((book: any) => book.id));
      cursor = response.body.data.nextCursor;
    } while (cursor && sizes.length < 10);
    expect(sizes).toEqual([8, 8, 1]);
    expect(ids).toEqual(rows.map(book => book._id));
    expect(new Set(ids).size).toBe(17);
  });

  it.each(["bad", Buffer.from(JSON.stringify({ activity: -1, id })).toString("base64url")])("rejects invalid cursor %s", async cursor => {
    const response = await request(app).get("/api/reader?cursor=" + cursor).set("Authorization", "test");
    expect(response.status).toBe(400);
    expect(ReaderBookModel.aggregate).not.toHaveBeenCalled();
  });

  it("scopes literal title and author search to the database query before pagination", async () => {
    (ReaderBookModel.aggregate as jest.Mock).mockResolvedValue([]);
    const response = await request(app).get("/api/reader")
      .query({ archived: "true", q: "A.*", sort: "author" }).set("Authorization", "test");
    expect(response.status).toBe(200);
    const [filter, keys, sort, limit] = (ReaderBookModel.aggregate as jest.Mock).mock.calls[0][0];
    const literal = { $regex: "A\\.\\*", $options: "i" };
    expect(filter.$match).toEqual({
      userId: expect.anything(), archived: true, $or: [{ title: literal }, { author: literal }],
    });
    expect(keys.$addFields.key).toEqual({ $toLower: { $ifNull: ["$author", ""] } });
    expect(sort.$sort).toEqual({ pin: -1, key: 1, _id: 1 });
    expect(limit).toEqual({ $limit: 9 });
  });

  it.each([true, false])("writes pin status %s for the current owner", async pinned => {
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue({ id, pinned });
    const response = await request(app).patch("/api/reader/" + id + "/pin")
      .set("Authorization", "test").send({ pinned, userId: "another-user" });
    expect(response.status).toBe(200);
    expect(response.body.data.pinned).toBe(pinned);
    expect(ReaderBookModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, userId: mockUserId }, { $set: { pinned } },
      { new: true, runValidators: true, timestamps: false },
    );
  });

  it.each([true, false])("persists archive status %s without changing book content or reading state", async archived => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: id }) });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue({ id, archived });
    const response = await request(app).patch("/api/reader/" + id + "/archive")
      .set("Authorization", "test").send({ archived, userId: "attacker", state: {} });
    expect(response.status).toBe(200);
    expect(response.body.data.archived).toBe(archived);
    expect(ReaderBookModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, userId: mockUserId }, { $set: { archived } }, { new: true, runValidators: true },
    );
  });

  it("rejects malformed archive status before writing", async () => {
    const response = await request(app).patch("/api/reader/" + id + "/archive")
      .set("Authorization", "test").send({ archived: "true" });
    expect(response.status).toBe(400);
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(["", "/file", "/state", "/archive"])("never accesses another user's book on %s", async suffix => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const operation =
      suffix === "/state" || suffix === "/archive"
        ? request(app)
            .patch("/api/reader/" + id + suffix)
            .send(suffix === "/archive" ? { archived: true } : {})
        : request(app).get("/api/reader/" + id + suffix);
    const response = await operation.set("Authorization", "test");
    expect(response.status).toBe(404);
    expect(ReaderBookModel.findOne).toHaveBeenCalledWith({ _id: id, userId: mockUserId });
  });

  it.each(Array.from({ length: 43 }, (_, index) => index + 14))("validates state and persists font size %spx with a stale-save guard", async fontSize => {
    const existing = { _id: id, state: { location: "", progress: 0 } };
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(existing),
    });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue(existing);
    const state = {
      location: "epubcfi(/6/2!/4/2/1:0)",
      progress: 0.2,
      savedAt: Date.now(),
      preferences: { ...defaultReaderPreferences, fontSize },
    };
    const invalid = await request(app)
      .patch("/api/reader/" + id + "/state")
      .set("Authorization", "test")
      .send({ ...state, preferences: { ...defaultReaderPreferences, fontSize: 57 } });
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

  it.each(["backgroundColor", "selectionColor", "selectionTextColor", "passageColor", "passageTextColor", "translationColor", "translationTextColor"])("persists and validates %s", async key => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: id }) });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue({ state: {} });
    const state = { location: "", progress: 0, savedAt: Date.now(), preferences: { ...defaultReaderPreferences, [key]: "#12abEF" } };
    const response = await request(app).patch("/api/reader/" + id + "/state").set("Authorization", "test").send(state);
    expect(response.status).toBe(200);
    expect((ReaderBookModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set.state.preferences[key]).toBe("#12abEF");
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockClear();
    for (const invalid of ["red", "#fff", "url(bad)", 123, null]) {
      const rejected = await request(app).patch("/api/reader/" + id + "/state").set("Authorization", "test")
        .send({ ...state, preferences: { ...state.preferences, [key]: invalid } });
      expect(rejected.status).toBe(400);
    }
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(["page", "sentence", "audiobook"])("persists reading mode %s", async mode => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: id }) });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue({ state: {} });
    const response = await request(app).patch("/api/reader/" + id + "/state").set("Authorization", "test")
      .send({ location: "", progress: 0, savedAt: Date.now(), preferences: defaultReaderPreferences, mode });
    expect(response.status).toBe(200);
    expect((ReaderBookModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set.state.mode).toBe(mode);
  });

  it("keeps older clients without a mode and rejects unknown modes", async () => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: id }) });
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockResolvedValue({ state: {} });
    const state = { location: "", progress: 0, savedAt: Date.now(), preferences: defaultReaderPreferences };
    const legacy = await request(app).patch("/api/reader/" + id + "/state").set("Authorization", "test").send(state);
    expect(legacy.status).toBe(200);
    expect((ReaderBookModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set.state).not.toHaveProperty("mode");
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockClear();
    for (const mode of ["rsvp", "", 1, null]) {
      const rejected = await request(app).patch("/api/reader/" + id + "/state").set("Authorization", "test").send({ ...state, mode });
      expect(rejected.status).toBe(400);
    }
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
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
