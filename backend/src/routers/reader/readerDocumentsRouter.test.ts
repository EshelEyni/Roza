import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import readerRouter from "./readerRouter";
import requestSanitizer from "../../middlewares/HTMLSanitizer/HTMLSanitizerMiddleware";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderDocumentModel } from "../../models/reader/readerDocumentModel";
import { ReaderAnnotationModel } from "../../models/reader/readerAnnotationModel";

const mockUser = "507f1f77bcf86cd799439011";
const bookId = "507f1f77bcf86cd799439012";
const documentId = "507f1f77bcf86cd799439014";
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockUser }));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization ? next() : res.sendStatus(401),
}));
jest.mock("../../models/reader/readerBookModel", () => ({
  ReaderBookModel: { exists: jest.fn() },
}));
jest.mock("../../models/reader/readerAnnotationModel", () => ({
  ReaderAnnotationModel: { find: jest.fn(), findOneAndUpdate: jest.fn(), findOneAndDelete: jest.fn() },
}));
jest.mock("../../models/reader/readerDocumentModel", () => ({
  ReaderDocumentModel: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

const app = express();
app.use(express.json({ limit: "5000kb" }));
app.use(requestSanitizer);
app.use("/api/reader", readerRouter);
app.use((err: { statusCode?: number; message: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ message: err.message });
});

const base = "/api/reader/" + bookId + "/documents";
const content = [
  { type: "heading-one", children: [{ text: "Chapter 3 & the <garden>" }] },
  { type: "paragraph", align: "right", children: [{ text: "Bold", bold: true }, { text: " plain" }] },
  { type: "bulleted-list", children: [{ type: "list-item", children: [{ text: "Point" }] }] },
];
const selectChain = (value: unknown) => {
  const chain = { select: jest.fn(), sort: jest.fn() };
  chain.select.mockReturnValue(chain);
  chain.sort.mockResolvedValue(value);
  return chain;
};

describe("reader book documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockUser;
    (ReaderBookModel.exists as jest.Mock).mockResolvedValue({ _id: bookId });
    (ReaderDocumentModel.countDocuments as jest.Mock).mockResolvedValue(0);
    (ReaderDocumentModel.create as jest.Mock).mockImplementation(async value => ({ id: documentId, ...value }));
    (ReaderDocumentModel.findOne as jest.Mock).mockResolvedValue({ id: documentId, title: "Summary", content });
    (ReaderDocumentModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ id: documentId, title: "Summary" }),
    });
    (ReaderDocumentModel.findOneAndDelete as jest.Mock).mockResolvedValue({ _id: documentId });
  });

  it("requires authentication and a book owned by the user", async () => {
    expect((await request(app).get(base)).status).toBe(401);
    (ReaderBookModel.exists as jest.Mock).mockResolvedValue(null);
    expect((await request(app).get(base).set("Authorization", "t")).status).toBe(404);
    expect(ReaderBookModel.exists).toHaveBeenCalledWith({ _id: bookId, userId: mockUser });
    expect(ReaderDocumentModel.find).not.toHaveBeenCalled();
  });

  it("lists the user's documents for the book without their content", async () => {
    const chain = selectChain([{ id: documentId, title: "Summary" }]);
    (ReaderDocumentModel.find as jest.Mock).mockReturnValue(chain);
    const result = await request(app).get(base).set("Authorization", "t");
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(ReaderDocumentModel.find).toHaveBeenCalledWith({ userId: mockUser, bookId });
    expect(chain.select).toHaveBeenCalledWith("-content");
    expect(chain.sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it("creates a document with an empty paragraph and a trimmed title", async () => {
    const result = await request(app).post(base).set("Authorization", "t")
      .send({ title: "  Chapter   summaries ", userId: "attacker" });
    expect(result.status).toBe(201);
    expect(ReaderDocumentModel.create).toHaveBeenCalledWith({
      userId: mockUser, bookId, title: "Chapter summaries",
      content: [{ type: "paragraph", children: [{ text: "" }] }], preview: "",
    });
  });

  it("rejects empty titles and too many documents", async () => {
    expect((await request(app).post(base).set("Authorization", "t").send({ title: "  " })).status).toBe(400);
    (ReaderDocumentModel.countDocuments as jest.Mock).mockResolvedValue(200);
    expect((await request(app).post(base).set("Authorization", "t").send({ title: "x" })).status).toBe(400);
    expect(ReaderDocumentModel.create).not.toHaveBeenCalled();
  });

  it("reopens a single document scoped to the user and book", async () => {
    const result = await request(app).get(base + "/" + documentId).set("Authorization", "t");
    expect(result.status).toBe(200);
    expect(result.body.data.content).toEqual(content);
    expect(ReaderDocumentModel.findOne).toHaveBeenCalledWith({ userId: mockUser, bookId, _id: documentId });
    (ReaderDocumentModel.findOne as jest.Mock).mockResolvedValue(null);
    expect((await request(app).get(base + "/" + documentId).set("Authorization", "t")).status).toBe(404);
    expect((await request(app).get(base + "/not-an-id").set("Authorization", "t")).status).toBe(404);
  });

  it("saves rich text verbatim, without HTML escaping, and updates the preview", async () => {
    const result = await request(app).patch(base + "/" + documentId).set("Authorization", "t")
      .send({ content });
    expect(result.status).toBe(200);
    expect(ReaderDocumentModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: mockUser, bookId, _id: documentId },
      { $set: { content, preview: "Chapter 3 & the <garden> Bold plain Point" } },
      expect.objectContaining({ new: true, runValidators: true }),
    );
  });

  it("drops unknown keys and rejects unknown blocks or malformed marks", async () => {
    await request(app).patch(base + "/" + documentId).set("Authorization", "t").send({
      content: [{ type: "paragraph", onclick: "x", children: [{ text: "a", bold: false, href: "x" }] }],
    });
    expect((ReaderDocumentModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set.content)
      .toEqual([{ type: "paragraph", children: [{ text: "a" }] }]);
    for (const bad of [
      [],
      [{ type: "script", children: [{ text: "a" }] }],
      [{ type: "paragraph", children: [{ text: "a", bold: "yes" }] }],
      [{ type: "paragraph", align: "middle", children: [{ text: "a" }] }],
      [{ type: "bulleted-list", children: [{ type: "paragraph", children: [{ text: "a" }] }] }],
      [{ type: "paragraph", children: [{ text: "x".repeat(500_001) }] }],
    ]) {
      const result = await request(app).patch(base + "/" + documentId).set("Authorization", "t")
        .send({ content: bad });
      expect(result.status).toBe(400);
    }
    expect(ReaderDocumentModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("renames a document and rejects empty updates", async () => {
    await request(app).patch(base + "/" + documentId).set("Authorization", "t").send({ title: "Themes" });
    expect((ReaderDocumentModel.findOneAndUpdate as jest.Mock).mock.calls[0][1]).toEqual({ $set: { title: "Themes" } });
    expect((await request(app).patch(base + "/" + documentId).set("Authorization", "t").send({})).status).toBe(400);
  });

  it("deletes only the user's document", async () => {
    expect((await request(app).delete(base + "/" + documentId).set("Authorization", "t")).status).toBe(200);
    expect(ReaderDocumentModel.findOneAndDelete).toHaveBeenCalledWith({ userId: mockUser, bookId, _id: documentId });
    (ReaderDocumentModel.findOneAndDelete as jest.Mock).mockResolvedValue(null);
    expect((await request(app).delete(base + "/" + documentId).set("Authorization", "t")).status).toBe(404);
  });

  it("keeps HTML sanitizing other reader writes such as annotations", async () => {
    (ReaderAnnotationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    await request(app).put("/api/reader/" + bookId + "/annotations").set("Authorization", "t").send({
      cfi: "epubcfi(/6/2[c1]!/4/2,/1:0,/1:20)", text: "Text", chapter: "", color: "yellow",
      note: "<script>alert(1)</script>ok",
    });
    expect((ReaderAnnotationModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set.note).toBe("ok");
  });
});
