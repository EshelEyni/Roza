import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import readerRouter from "./readerRouter";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderAnnotationModel } from "../../models/reader/readerAnnotationModel";
const mockUser = "507f1f77bcf86cd799439011";
const bookId = "507f1f77bcf86cd799439012";
const annotationId = "507f1f77bcf86cd799439013";
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockUser }));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization ? next() : res.sendStatus(401),
}));
jest.mock("../../models/reader/readerBookModel", () => ({
  ReaderBookModel: { exists: jest.fn() },
}));
jest.mock("../../models/reader/readerAnnotationModel", () => ({
  ReaderAnnotationModel: {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));
const app = express();
app.use(express.json());
app.use("/reader", readerRouter);
app.use(
  (
    err: { statusCode?: number; message: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  },
);
const data = {
  cfi: "epubcfi(/6/2[c1]!/4/2,/1:0,/1:20)",
  text: "A selected sentence.",
  chapter: "Chapter 1",
  color: "yellow",
  note: "",
};
const base = "/reader/" + bookId + "/annotations";
describe("saved reader annotations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockUser;
    (ReaderBookModel.exists as jest.Mock).mockResolvedValue({ _id: bookId });
    (ReaderAnnotationModel.find as jest.Mock).mockResolvedValue([{ id: annotationId, ...data }]);
    (ReaderAnnotationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({
      id: annotationId,
      ...data,
    });
    (ReaderAnnotationModel.findOneAndDelete as jest.Mock).mockResolvedValue({ _id: annotationId });
  });
  it("requires authentication and enabled reader access", async () => {
    expect((await request(app).get(base)).status).toBe(401);
    process.env.READER_ENABLED = "false";
    expect((await request(app).put(base).set("Authorization", "test").send(data)).status).toBe(403);
    expect(ReaderBookModel.exists).not.toHaveBeenCalled();
  });
  it("lists annotations with no cache and scopes to authenticated owner and book", async () => {
    const res = await request(app).get(base).set("Authorization", "test");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(ReaderAnnotationModel.find).toHaveBeenCalledWith({ userId: mockUser, bookId });
  });
  it.each(["get", "put", "delete"])("rejects %s on another user's book", async method => {
    (ReaderBookModel.exists as jest.Mock).mockResolvedValue(null);
    const target = method === "delete" ? base + "/" + annotationId : base;
    const call =
      method === "get"
        ? request(app).get(target)
        : method === "put"
          ? request(app).put(target).send(data)
          : request(app).delete(target);
    expect((await call.set("Authorization", "test")).status).toBe(404);
    expect(ReaderBookModel.exists).toHaveBeenCalledWith({ _id: bookId, userId: mockUser });
    expect(ReaderAnnotationModel.find).not.toHaveBeenCalled();
    expect(ReaderAnnotationModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(ReaderAnnotationModel.findOneAndDelete).not.toHaveBeenCalled();
  });
  it.each(["yellow", "green", "blue", "pink"])(
    "saves and edits %s highlights and notes without accepting ownership fields",
    async color => {
      const value = { ...data, color, note: "My note" };
      expect(
        (
          await request(app)
            .put(base)
            .set("Authorization", "test")
            .send({ ...value, userId: "attacker", bookId: "other" })
        ).status,
      ).toBe(200);
      expect(ReaderAnnotationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockUser, bookId, cfi: data.cfi, endCfi: "" },
        { $set: { ...value, endCfi: "" } },
        expect.objectContaining({ upsert: true, new: true, runValidators: true }),
      );
    },
  );
  it.each([
    { color: "red" },
    { cfi: "page 3" },
    { endCfi: "bad" },
    { text: "" },
    { note: 5 },
    { note: "n".repeat(10001) },
    { chapter: {} },
  ])("rejects malformed annotation case %#", async invalid => {
    expect(
      (
        await request(app)
          .put(base)
          .set("Authorization", "test")
          .send({ ...data, ...invalid })
      ).status,
    ).toBe(400);
    expect(ReaderAnnotationModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("deletes only the authenticated user's annotation in the current book", async () => {
    expect(
      (
        await request(app)
          .delete(base + "/" + annotationId)
          .set("Authorization", "test")
      ).status,
    ).toBe(200);
    expect(ReaderAnnotationModel.findOneAndDelete).toHaveBeenCalledWith({
      _id: annotationId,
      userId: mockUser,
      bookId,
    });
    (ReaderAnnotationModel.findOneAndDelete as jest.Mock).mockResolvedValue(null);
    expect(
      (
        await request(app)
          .delete(base + "/" + annotationId)
          .set("Authorization", "test")
      ).status,
    ).toBe(404);
  });
  it("removes a note while keeping the highlight and supports a cross-section end CFI", async () => {
    const value = { ...data, endCfi: "epubcfi(/6/4[c2]!/4/2/1:50)" };
    expect((await request(app).put(base).set("Authorization", "test").send(value)).status).toBe(
      200,
    );
    expect(ReaderAnnotationModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: mockUser, bookId, cfi: data.cfi, endCfi: value.endCfi },
      { $set: value },
      expect.any(Object),
    );
  });
});
