import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderConversationModel } from "../../models/reader/readerConversationModel";
import { askReaderAi } from "../../services/reader/readerAiService";
import readerRouter from "./readerRouter";

const mockOwner = "507f1f77bcf86cd799439011";
const mockRetrieve = jest.fn(() => ({
  passage: "garden",
  context: [{ label: "Current passage", text: "A quiet garden." }],
}));
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockOwner }));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization ? next() : res.status(401).json({ status: "fail" }),
}));
jest.mock("../../models/reader/readerBookModel", () => ({
  ReaderBookModel: { findOne: jest.fn() },
}));
jest.mock("../../models/reader/readerConversationModel", () => ({
  ReaderConversationModel: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock("../../services/reader/readerStorageService", () => ({
  getReaderBucket: () => ({
    openDownloadStream: () => ({ toArray: async () => [Buffer.from("fixture")] }),
  }),
}));
jest.mock("../../services/reader/readerContextService", () => ({
  ReaderContext: jest.fn().mockImplementation(() => ({
    retrieve: mockRetrieve,
    passage: (cfi: string, endCfi?: string) => ({
      cfi,
      text: "garden",
      ...(endCfi ? { endCfi } : {}),
    }),
    isAtOrBefore: () => true,
  })),
}));
jest.mock("../../services/reader/readerAiService", () => ({ askReaderAi: jest.fn() }));
jest.mock("../../services/reader/readerAiSettingsService", () => ({
  ...jest.requireActual("../../services/reader/readerAiSettingsService"),
  getReaderAiSettings: jest
    .fn()
    .mockResolvedValue({ model: "gpt-6.1-terra", answerLength: "short", simpleLanguage: true, customInstructions: "" }),
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
const bookId = "507f191e810c19729de860ea",
  chatId = "507f191e810c19729de860eb";
const base = "/api/reader/" + bookId + "/conversations",
  url = base + "/" + chatId;
const body = {
  requestId: "request-id-123456789",
  question: "What does this mean?",
  currentCfi: "epubcfi(/6/2!/4/2/1:20)",
  spoilersAllowed: false,
};
const conversation = () => ({
  id: chatId,
  passage: { cfi: "selected-cfi", text: "garden" },
  turns: [],
  lockedUntil: new Date(0),
});
describe("Reader conversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockOwner;
    process.env.OPENAI_API_KEY = "test-only";
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue({ _id: bookId, fileId: bookId, title: "Book", author: "Author" }),
    });
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(conversation()),
      then: (resolve: (value: unknown) => unknown) => resolve(conversation()),
    });
    (ReaderConversationModel.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    (askReaderAi as jest.Mock).mockResolvedValue("A clear answer.");
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  it("requires authentication and the existing reader allowlist", async () => {
    expect((await request(app).get(base)).status).toBe(401);
    process.env.READER_ENABLED = "false";
    expect((await request(app).post(base).set("Authorization", "test").send({})).status).toBe(403);
    expect(ReaderBookModel.findOne).not.toHaveBeenCalled();
  });
  it("rejects another user's book before touching conversations", async () => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send(body)
      ).status,
    ).toBe(404);
    expect(ReaderBookModel.findOne).toHaveBeenCalledWith({ _id: bookId, userId: mockOwner });
    expect(ReaderConversationModel.findOne).not.toHaveBeenCalled();
  });
  it("derives selected text from the owned EPUB, ignoring client-provided text and ownership", async () => {
    (ReaderConversationModel.create as jest.Mock).mockResolvedValue(conversation());
    expect(
      (
        await request(app)
          .post(base)
          .set("Authorization", "test")
          .send({ passageCfi: "selected-cfi", passage: { text: "injected" }, userId: "attacker" })
      ).status,
    ).toBe(201);
    expect(ReaderConversationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockOwner,
        bookId,
        passage: { cfi: "selected-cfi", text: "garden" },
      }),
    );
    expect(askReaderAi).not.toHaveBeenCalled();
  });
  it("persists validated cross-section passage endpoints", async () => {
    (ReaderConversationModel.create as jest.Mock).mockResolvedValue(conversation());
    expect(
      (
        await request(app)
          .post(base)
          .set("Authorization", "test")
          .send({
            passageCfi: "selected-cfi",
            passageEndCfi: "end-cfi",
            passage: { text: "injected" },
          })
      ).status,
    ).toBe(201);
    expect(ReaderConversationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        passage: { cfi: "selected-cfi", endCfi: "end-cfi", text: "garden" },
      }),
    );
  });
  it("rejects an end CFI without a starting passage or with an invalid type", async () => {
    for (const payload of [
      { passageEndCfi: "end-cfi" },
      { passageCfi: "selected-cfi", passageEndCfi: {} },
    ]) {
      expect(
        (await request(app).post(base).set("Authorization", "test").send(payload)).status,
      ).toBe(400);
    }
    expect(ReaderConversationModel.create).not.toHaveBeenCalled();
  });
  it("returns completed retries without another paid call", async () => {
    const saved = {
      ...conversation(),
      turns: [
        { id: body.requestId, question: body.question, status: "completed", answer: "Saved" },
      ],
    };
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(saved),
    });
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send(body)
      ).status,
    ).toBe(200);
    expect(askReaderAi).not.toHaveBeenCalled();
    expect(ReaderConversationModel.findOne).toHaveBeenCalledWith({
      _id: chatId,
      bookId,
      userId: mockOwner,
    });
  });
  it("does not call the provider when another request holds the conversation lock", async () => {
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send(body)
      ).status,
    ).toBe(409);
    expect(askReaderAi).not.toHaveBeenCalled();
  });
  it("persists successful answers and instructs question-language responses with no spoilers", async () => {
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(conversation());
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send(body)
      ).status,
    ).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith(
      body.question,
      "selected-cfi",
      false,
      conversation().passage,
    );
    const [instructions, input, model] = (askReaderAi as jest.Mock).mock.calls[0];
    expect(model).toBe("gpt-6.1-terra");
    expect(instructions).toContain("language of the current question");
    expect(instructions).toContain("Avoid ALL spoilers");
    expect(instructions).toContain("2–4 short sentences");
    expect(instructions).toContain("simple everyday words");
    expect(input[input.length - 1]).toEqual({ role: "user", content: body.question });
    expect(
      (ReaderConversationModel.findOneAndUpdate as jest.Mock).mock.calls[1][1].$set[
        "turns.$[turn].status"
      ],
    ).toBe("completed");
  });
  it("accepts a long question without changing the model or discarding its text", async () => {
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(conversation());
    const question = "Explain this sentence. ".repeat(200);
    const result = await request(app).post(url + "/messages").set("Authorization", "test")
      .send({ ...body, question });
    expect(result.status).toBe(200);
    const [, input] = (askReaderAi as jest.Mock).mock.calls[0];
    expect(input[input.length - 1].content).toBe(question.trim());
  });
  it("attaches a new server-resolved passage to the same conversation and turn", async () => {
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(conversation());
    const result = await request(app).post(url + "/messages").set("Authorization", "test")
      .send({ ...body, passageCfi: "new-passage", passageEndCfi: "new-end" });
    expect(result.status).toBe(200);
    const update = (ReaderConversationModel.findOneAndUpdate as jest.Mock).mock.calls[0][1];
    expect(update.$set.passage.cfi).toBe("new-passage");
    expect(update.$push.turns.passage.cfi).toBe("new-passage");
    expect(update.$push.turns.excerpts).toHaveLength(1);
    expect(ReaderConversationModel.create).not.toHaveBeenCalled();
  });
  it("rejects malformed attached passage endpoints before a paid call", async () => {
    const result = await request(app).post(url + "/messages").set("Authorization", "test")
      .send({ ...body, passageEndCfi: "end-only" });
    expect(result.status).toBe(400);
    expect(askReaderAi).not.toHaveBeenCalled();
  });
  it("saves a rolling summary before answering and reuses it on a failed answer retry", async () => {
    const original = {
      ...conversation(),
      turns: Array.from({ length: 7 }, (_, i) => ({
        id: "old-" + i, question: "Earlier question " + i, answer: "Earlier answer " + i,
        status: "completed", currentCfi: body.currentCfi, spoilersAllowed: false,
      })),
    };
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(original) });
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(original);
    (askReaderAi as jest.Mock).mockReset()
      .mockResolvedValueOnce("Stored older discussion")
      .mockRejectedValueOnce(new Error("Answer failed"));
    expect((await request(app).post(url + "/messages").set("Authorization", "test").send(body)).status).toBe(500);
    const summary = (ReaderConversationModel.findOneAndUpdate as jest.Mock).mock.calls[1][1].$set.memorySummary;
    expect(summary.turnIds).toHaveLength(3);
    expect((askReaderAi as jest.Mock).mock.calls[0][3]).toBe("summary");
    expect((ReaderConversationModel.findOneAndUpdate as jest.Mock).mock.calls[1][0].lockToken).toBeTruthy();
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ ...original, memorySummary: summary }) });
    (askReaderAi as jest.Mock).mockClear().mockResolvedValue("Final answer");
    expect((await request(app).post(url + "/messages").set("Authorization", "test").send(body)).status).toBe(200);
    expect(askReaderAi).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((askReaderAi as jest.Mock).mock.calls[0][1])).toContain("Stored older discussion");
  });
  it("answers with recent history when summary generation fails and reports that fallback", async () => {
    const original = { ...conversation(), turns: Array.from({ length: 7 }, (_, i) => ({
      id: "old-" + i, question: "Question " + i, answer: "Answer " + i,
      status: "completed", currentCfi: body.currentCfi, spoilersAllowed: false,
    })) };
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(original) });
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(original);
    (askReaderAi as jest.Mock).mockReset().mockRejectedValueOnce(new Error("Summary failed")).mockResolvedValue("Answer");
    expect((await request(app).post(url + "/messages").set("Authorization", "test").send(body)).status).toBe(200);
    const finalUpdate = (ReaderConversationModel.findOneAndUpdate as jest.Mock).mock.calls[1][1].$set;
    expect(finalUpdate.contextSummaryFailed).toBe(true);
    expect(finalUpdate["turns.$[turn].status"]).toBe("completed");
    expect(askReaderAi).toHaveBeenCalledTimes(2);
  });
  it("marks failed requests retryable and releases only its own lock", async () => {
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(conversation());
    (askReaderAi as jest.Mock).mockRejectedValue(new Error("Mock provider failure"));
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send(body)
      ).status,
    ).toBe(500);
    const [filter, update] = (ReaderConversationModel.updateOne as jest.Mock).mock.calls[0];
    expect(filter).toMatchObject({ userId: mockOwner, bookId, _id: chatId });
    expect(filter.lockToken).toBeTruthy();
    expect(update.$set["turns.$[turn].status"]).toBe("failed");
    expect(update.$unset.lockToken).toBe(1);
  });
  it("retries with the persisted position and spoiler setting after navigation", async () => {
    const originalCfi = "epubcfi(/6/2!/4/2/1:10)";
    const saved = {
      ...conversation(),
      passage: undefined,
      turns: [
        {
          id: body.requestId,
          question: body.question,
          status: "failed",
          currentCfi: originalCfi,
          spoilersAllowed: false,
        },
      ],
    };
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(saved),
    });
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(saved);
    const response = await request(app)
      .post(url + "/messages")
      .set("Authorization", "test")
      .send({ ...body, currentCfi: "epubcfi(/6/4!/4/2/1:50)", spoilersAllowed: true });
    expect(response.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith(body.question, originalCfi, false, undefined);
    const update = (ReaderConversationModel.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update["turns.$[turn].currentCfi"]).toBeUndefined();
    expect(update["turns.$[turn].spoilersAllowed"]).toBeUndefined();
  });
  it("uses the saved passage when the current renderer has no reading boundary", async () => {
    (ReaderConversationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(conversation());
    const response = await request(app)
      .post(url + "/messages")
      .set("Authorization", "test")
      .send({ ...body, currentCfi: "" });
    expect(response.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith(
      body.question,
      "selected-cfi",
      false,
      conversation().passage,
    );
  });
  it("does not substitute today's page for a legacy retry with no saved position", async () => {
    const saved = {
      ...conversation(),
      turns: [{ id: body.requestId, question: body.question, status: "failed" }],
    };
    (ReaderConversationModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(saved),
    });
    const response = await request(app)
      .post(url + "/messages")
      .set("Authorization", "test")
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("original reading position");
    expect(askReaderAi).not.toHaveBeenCalled();
  });
  it("rejects a missing book before using a saved passage", async () => {
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send(body)
      ).status,
    ).toBe(404);
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(askReaderAi).not.toHaveBeenCalled();
  });
  it("rejects oversized questions before loading context or calling AI", async () => {
    expect(
      (
        await request(app)
          .post(url + "/messages")
          .set("Authorization", "test")
          .send({ ...body, question: "x".repeat(10001) })
      ).status,
    ).toBe(400);
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(askReaderAi).not.toHaveBeenCalled();
  });
});
