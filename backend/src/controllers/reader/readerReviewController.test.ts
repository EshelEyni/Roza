import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import {
  saveFlag,
  listFlags,
  updateFlag,
  translateFlag,
  getReview,
  updateVocabularyReview,
} from "./readerReviewController";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderFlagModel } from "../../models/reader/readerFlagModel";
import {
  ReaderVocabularyModel,
  ReaderLookupModel,
} from "../../models/reader/readerVocabularyModel";
import { lookupReaderWordWithTranslation } from "../../services/reader/readerDictionaryService";
jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: () => "owner",
}));
jest.mock("../../models/reader/readerBookModel", () => ({
  ReaderBookModel: { exists: jest.fn(), find: jest.fn() },
}));
jest.mock("../../models/reader/readerFlagModel", () => ({
  ReaderFlagModel: {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    find: jest.fn(),
  },
}));
jest.mock("../../models/reader/readerVocabularyModel", () => ({
  ReaderVocabularyModel: {
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  ReaderLookupModel: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../services/reader/readerDictionaryService", () => ({
  lookupReaderWordWithTranslation: jest.fn(),
}));
const app = express();
app.use(express.json());
app.get("/:id/review", getReview);
app.patch("/:id/review/vocabulary/:vocabularyId", updateVocabularyReview);
app.delete("/:id/review/vocabulary/:vocabularyId", updateVocabularyReview);
app.get("/:id/flags", listFlags);
app.put("/:id/flags", saveFlag);
app.patch("/:id/flags/:flagId", updateFlag);
app.delete("/:id/flags/:flagId", updateFlag);
app.post("/:id/flags/:flagId/translation", translateFlag);
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
const id = "507f191e810c19729de860ea",
  flagId = "507f191e810c19729de860eb";
const cfi = "epubcfi(/6/2!/4/2/1:0)",
  base = "/" + id + "/flags";
const input = {
  cfi,
  endCfi: "",
  text: "Unfamiliar",
  chapter: "Chapter 1",
  context: "Unfamiliar words appear here.",
};
beforeEach(() => {
  jest.resetAllMocks();
  (ReaderBookModel.exists as jest.Mock).mockResolvedValue(true);
});
test("save is scoped and idempotent, retaining text, context and endpoints", async () => {
  (ReaderFlagModel.findOneAndUpdate as jest.Mock).mockResolvedValue({
    id: flagId,
    ...input,
  });
  const response = await request(app)
    .put(base)
    .send({ ...input, userId: "attacker" });
  expect(response.status).toBe(200);
  expect(ReaderFlagModel.findOneAndUpdate).toHaveBeenCalledWith(
    { userId: "owner", bookId: id, cfi, endCfi: "" },
    { $setOnInsert: { userId: "owner", bookId: id, ...input } },
    expect.objectContaining({ upsert: true, new: true }),
  );
});
test("racing duplicate insert returns the existing flag", async () => {
  (ReaderFlagModel.findOneAndUpdate as jest.Mock).mockRejectedValue({
    code: 11000,
  });
  (ReaderFlagModel.findOne as jest.Mock).mockResolvedValue({
    id: flagId,
    ...input,
  });
  expect((await request(app).put(base).send(input)).body.data.id).toBe(flagId);
});
test.each(["bad", "epubcfi(<script>)", ""])(
  "rejects invalid location %s",
  async (cfi) => {
    expect(
      (
        await request(app)
          .put(base)
          .send({ ...input, cfi })
      ).status,
    ).toBe(400);
    expect(ReaderFlagModel.findOneAndUpdate).not.toHaveBeenCalled();
  },
);
test("rejects an unowned book before reading or writing flags", async () => {
  (ReaderBookModel.exists as jest.Mock).mockResolvedValue(false);
  expect((await request(app).put(base).send(input)).status).toBe(404);
  expect((await request(app).get(base)).status).toBe(404);
  expect(ReaderFlagModel.findOneAndUpdate).not.toHaveBeenCalled();
  expect(ReaderFlagModel.find).not.toHaveBeenCalled();
});
test("review and deletion are scoped to user, book and flag", async () => {
  (ReaderFlagModel.findOneAndUpdate as jest.Mock).mockResolvedValue({
    reviewed: true,
  });
  (ReaderFlagModel.findOneAndDelete as jest.Mock).mockResolvedValue({
    id: flagId,
  });
  expect(
    (
      await request(app)
        .patch(base + "/" + flagId)
        .send({ reviewed: true })
    ).status,
  ).toBe(200);
  expect(ReaderFlagModel.findOneAndUpdate).toHaveBeenCalledWith(
    { userId: "owner", bookId: id, _id: flagId },
    { $set: { reviewed: true } },
    { new: true },
  );
  expect((await request(app).delete(base + "/" + flagId)).status).toBe(200);
  expect(ReaderFlagModel.findOneAndDelete).toHaveBeenCalledWith({
    userId: "owner",
    bookId: id,
    _id: flagId,
  });
});
test("existing translations are reused without provider calls or lookup writes", async () => {
  const entry = { headword: "unfamiliar", senses: [] };
  (ReaderFlagModel.findOne as jest.Mock).mockResolvedValue(input);
  (ReaderVocabularyModel.findOne as jest.Mock).mockResolvedValue({ entry });
  const response = await request(app).post(
    base + "/" + flagId + "/translation",
  );
  expect(response.body.data).toEqual(entry);
  expect(lookupReaderWordWithTranslation).not.toHaveBeenCalled();
  expect(ReaderLookupModel.updateOne).not.toHaveBeenCalled();
  expect(ReaderVocabularyModel.updateOne).not.toHaveBeenCalled();
});
test("explicit pending word translation does not record a lookup", async () => {
  (ReaderFlagModel.findOne as jest.Mock).mockResolvedValue(input);
  (ReaderVocabularyModel.findOne as jest.Mock).mockResolvedValue(null);
  (lookupReaderWordWithTranslation as jest.Mock).mockResolvedValue({
    senses: [],
  });
  expect(
    (await request(app).post(base + "/" + flagId + "/translation")).status,
  ).toBe(200);
  expect(lookupReaderWordWithTranslation).toHaveBeenCalledWith(
    "Unfamiliar",
    "auto",
  );
  expect(ReaderLookupModel.updateOne).not.toHaveBeenCalled();
  expect(ReaderVocabularyModel.updateOne).not.toHaveBeenCalled();
});
test("passages cannot trigger word translation", async () => {
  (ReaderFlagModel.findOne as jest.Mock).mockResolvedValue({
    text: "A complex passage.",
  });
  expect(
    (await request(app).post(base + "/" + flagId + "/translation")).status,
  ).toBe(400);
  expect(lookupReaderWordWithTranslation).not.toHaveBeenCalled();
});
test("vocabulary removal hides review item while preserving history and counts", async () => {
  (ReaderVocabularyModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
  expect(
    (await request(app).delete("/" + id + "/review/vocabulary/" + flagId))
      .status,
  ).toBe(200);
  expect(ReaderVocabularyModel.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: flagId, userId: "owner", bookIds: id },
    { $addToSet: { reviewHiddenBookIds: id } },
    { new: true },
  );
  expect(ReaderLookupModel.updateOne).not.toHaveBeenCalled();
});

test("review reads existing vocabulary and location history with owner isolation and no statistics writes", async () => {
  const books = [{ _id: id, title: "Owned book" }];
  const entry = { headword: "note", senses: [] };
  (ReaderBookModel.find as jest.Mock).mockReturnValue({
    select: () => ({ lean: async () => books }),
  });
  (ReaderFlagModel.find as jest.Mock).mockReturnValue({
    sort: async () => [{ id: flagId, ...input }],
  });
  (ReaderVocabularyModel.find as jest.Mock).mockReturnValue({
    sort: () => ({
      lean: async () => [
        { _id: flagId, headword: "note", entry, bookIds: [id], lookupCount: 8 },
      ],
    }),
  });
  (ReaderLookupModel.find as jest.Mock).mockReturnValue({
    sort: () => ({
      lean: async () => [{ bookId: id, headword: "note", location: cfi }],
    }),
  });
  const response = await request(app).get("/" + id + "/review");
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.body.data.vocabulary[0].entry).toEqual(entry);
  expect(response.body.data.vocabulary[0].books).toEqual([
    { bookId: id, title: "Owned book", location: cfi },
  ]);
  expect(ReaderFlagModel.find).toHaveBeenCalledWith({
    userId: "owner",
    bookId: { $in: [id] },
  });
  expect(ReaderLookupModel.find).toHaveBeenCalledWith({
    userId: "owner",
    bookId: { $in: [id] },
  });
  expect(ReaderVocabularyModel.find).toHaveBeenCalledWith({
    userId: "owner",
    bookIds: id,
    reviewHiddenBookIds: { $ne: id },
  });
  expect(ReaderLookupModel.updateOne).not.toHaveBeenCalled();
  expect(ReaderVocabularyModel.updateOne).not.toHaveBeenCalled();
});

test("book review rejects another user's book before reading history", async () => {
  (ReaderBookModel.exists as jest.Mock).mockResolvedValue(false);
  expect((await request(app).get("/" + id + "/review")).status).toBe(404);
  expect(ReaderVocabularyModel.find).not.toHaveBeenCalled();
  expect(ReaderFlagModel.find).not.toHaveBeenCalled();
});
test("vocabulary review status changes only the current book", async () => {
  (ReaderVocabularyModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
  expect(
    (
      await request(app)
        .patch("/" + id + "/review/vocabulary/" + flagId)
        .send({ reviewed: true })
    ).status,
  ).toBe(200);
  expect(ReaderVocabularyModel.findOneAndUpdate).toHaveBeenLastCalledWith(
    { _id: flagId, userId: "owner", bookIds: id },
    { $addToSet: { reviewedBookIds: id } },
    { new: true },
  );
  await request(app)
    .patch("/" + id + "/review/vocabulary/" + flagId)
    .send({ reviewed: false });
  expect(ReaderVocabularyModel.findOneAndUpdate).toHaveBeenLastCalledWith(
    { _id: flagId, userId: "owner", bookIds: id },
    { $pull: { reviewedBookIds: id } },
    { new: true },
  );
});
