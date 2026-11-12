import express from "express";
import request from "supertest";
import { editChapterText, editingRequest } from "./writingAiController";
import { BookModel } from "../../models/books/bookModel";
import { askReaderAi } from "../../services/reader/readerAiService";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import requestSanitizer from "../../middlewares/HTMLSanitizer/HTMLSanitizerMiddleware";
jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: jest.fn(() => "111111111111111111111111"),
}));
jest.mock("../../models/books/bookModel", () => ({
  BookModel: { findOne: jest.fn() },
}));
jest.mock("../../services/reader/readerAiService", () => ({
  askReaderAi: jest.fn(),
}));
jest.mock("../../services/reader/readerAiSettingsService", () => ({
  getReaderAiSettings: async () => ({ model: "default" }),
}));
const bookId = "222222222222222222222222",
  chapterId = "333333333333333333333333";
const path = `/api/book/${bookId}/chapters/${chapterId}/ai-edit`;
const app = express();
app.use(express.json());
app.use(requestSanitizer);
app.post("/api/book/:id/chapters/:chapterId/ai-edit", editChapterText);
app.use(
  (
    error: { statusCode?: number; message: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => res.status(error.statusCode || 500).json({ message: error.message }),
);
beforeEach(() => {
  jest.clearAllMocks();
  (getLoggedInUserIdFromReq as jest.Mock).mockReturnValue(
    "111111111111111111111111",
  );
  (BookModel.findOne as jest.Mock).mockResolvedValue({
    chapters: [{ _id: chapterId }],
  });
  (askReaderAi as jest.Mock).mockResolvedValue("She is here.");
});
test("sends only requested passage and concise editing instructions with saved model", async () => {
  const response = await request(app)
    .post(path)
    .send({ action: "grammar", text: "She are here." });
  expect(response.status).toBe(200);
  expect(response.body.data.text).toBe("She is here.");
  const [prompt, input, selectedModel, purpose, limit] = (
    askReaderAi as jest.Mock
  ).mock.calls[0];
  expect(prompt).toContain("smallest necessary changes");
  expect(prompt).toContain("Hebrew or English");
  expect(input).toEqual([{ role: "user", content: "She are here." }]);
  expect(selectedModel).toBe("default");
  expect(purpose).toBe("edit");
  expect(limit).toBeLessThan(1100);
  expect((BookModel.findOne as jest.Mock).mock.calls[0][0]).toEqual({
    _id: bookId,
    userId: "111111111111111111111111",
    isArchived: false,
  });
});
test("all five actions work, custom instruction is required and bounded", () => {
  for (const action of ["grammar", "clarity", "flow", "concise", "custom"])
    expect(
      editingRequest({
        action,
        text: "היא הלך.",
        instruction: "Preserve rhythm",
      }).text,
    ).toBe("היא הלך.");
  for (const body of [
    { action: "custom", text: "x" },
    { action: "custom", text: "x", instruction: "x".repeat(2001) },
    { action: "unknown", text: "x" },
    { action: "grammar", text: "x".repeat(30001) },
    { action: "grammar", text: " " },
  ])
    expect(() => editingRequest(body)).toThrow();
});
test("unauthenticated, foreign-book, foreign-chapter and archived access cannot call AI", async () => {
  (getLoggedInUserIdFromReq as jest.Mock).mockReturnValueOnce("");
  expect(
    (await request(app).post(path).send({ action: "grammar", text: "x" }))
      .status,
  ).toBe(401);
  for (const result of [
    null,
    { chapters: [] },
    { chapters: [{ _id: chapterId, isArchived: true }] },
  ]) {
    (BookModel.findOne as jest.Mock).mockResolvedValueOnce(result);
    expect(
      (await request(app).post(path).send({ action: "grammar", text: "x" }))
        .status,
    ).toBe(404);
  }
  expect(askReaderAi).not.toHaveBeenCalled();
});
test("plain manuscript symbols survive sanitizer and AI errors leave persistence untouched", async () => {
  await request(app)
    .post(path)
    .send({ action: "grammar", text: "She wrote <draft> & שלום." });
  expect((askReaderAi as jest.Mock).mock.calls[0][1][0].content).toBe(
    "She wrote <draft> & שלום.",
  );
  (askReaderAi as jest.Mock).mockRejectedValueOnce(
    new Error("provider unavailable"),
  );
  expect(
    (await request(app).post(path).send({ action: "grammar", text: "x" }))
      .status,
  ).toBe(500);
});
