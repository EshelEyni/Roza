import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { renameReaderBook, updateReaderBookArchive, deleteReaderBook } from "./readerController";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { permanentlyDeleteReaderBook } from "../../services/reader/readerBookManagementService";
import { ReaderAnnotationModel } from "../../models/reader/readerAnnotationModel";
import { ReaderFlagModel } from "../../models/reader/readerFlagModel";
import { ReaderDocumentModel } from "../../models/reader/readerDocumentModel";
import { ReaderConversationModel } from "../../models/reader/readerConversationModel";
import {
  ReaderLookupModel,
  ReaderVocabularyModel,
} from "../../models/reader/readerVocabularyModel";
jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: () => "111111111111111111111111",
}));
const userId = "111111111111111111111111",
  id = "222222222222222222222222";
const fileId = new mongoose.Types.ObjectId(),
  originalFileId = new mongoose.Types.ObjectId();
const session = {
  withTransaction: jest.fn(async (run: () => Promise<void>) => run()),
  endSession: jest.fn(),
};
const book = { _id: id, id, title: "Original", fileId, originalFileId, state: { progress: 0.5 } };
const app = express();
app.use(express.json());
app.patch("/:id/title", renameReaderBook);
app.patch("/:id/archive", updateReaderBookArchive);
app.delete("/:id", deleteReaderBook);
app.use((error: any, _req: any, res: any, _next: any) =>
  res.status(error.statusCode || 500).json({ message: error.message }),
);
let cleanFiles: jest.Mock, cleanChunks: jest.Mock;
beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(mongoose, "startSession").mockResolvedValue(session as any);
  jest
    .spyOn(ReaderBookModel, "findOne")
    .mockReturnValue({ select: jest.fn().mockResolvedValue(book) } as any);
  jest
    .spyOn(ReaderBookModel, "findOneAndUpdate")
    .mockImplementation(((_scope: any, update: any) =>
      Promise.resolve({ ...book, ...update.$set })) as any);
  jest
    .spyOn(ReaderBookModel, "findOneAndDelete")
    .mockReturnValue({ select: jest.fn().mockResolvedValue(book) } as any);
  for (const model of [
    ReaderAnnotationModel,
    ReaderFlagModel,
    ReaderDocumentModel,
    ReaderConversationModel,
    ReaderLookupModel,
  ] as any[])
    jest.spyOn(model, "deleteMany").mockResolvedValue({ deletedCount: 1 });
  jest
    .spyOn(ReaderVocabularyModel, "find")
    .mockReturnValue({ session: jest.fn().mockResolvedValue([]) } as any);
  jest
    .spyOn(ReaderBookModel, "exists")
    .mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as any);
  cleanFiles = jest.fn().mockResolvedValue({ deletedCount: 1 });
  cleanChunks = jest.fn().mockResolvedValue({ deletedCount: 2 });
  Object.defineProperty(mongoose.connection, "db", {
    configurable: true,
    value: {
      collection: (name: string) =>
        name.endsWith(".chunks") ? { deleteMany: cleanChunks } : { deleteOne: cleanFiles },
    },
  });
});
afterAll(() => {
  jest.restoreAllMocks();
  Object.defineProperty(mongoose.connection, "db", { configurable: true, value: undefined });
});
test("rename trims and writes only title, preserving progress and related data", async () => {
  const response = await request(app)
    .patch("/" + id + "/title")
    .send({ title: "  New title  ", state: {}, archived: true });
  expect(response.status).toBe(200);
  expect(response.body.data.title).toBe("New title");
  expect(response.body.data.state.progress).toBe(0.5);
  expect(ReaderBookModel.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: id, userId },
    { $set: { title: "New title" } },
    { new: true, runValidators: true },
  );
  expect(ReaderLookupModel.deleteMany).not.toHaveBeenCalled();
  expect(ReaderBookModel.findOneAndDelete).not.toHaveBeenCalled();
});
test.each(["", "   ", null, {}, "a".repeat(501)])("rejects invalid title %p", async title => {
  expect(
    (
      await request(app)
        .patch("/" + id + "/title")
        .send({ title })
    ).status,
  ).toBe(400);
  expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
});
test("rename scopes to owner and rejects foreign book", async () => {
  (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  });
  expect(
    (
      await request(app)
        .patch("/" + id + "/title")
        .send({ title: "Private" })
    ).status,
  ).toBe(404);
  expect(ReaderBookModel.findOne).toHaveBeenCalledWith({ _id: id, userId });
  expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
});
test.each([true, false])("archive/restore changes only archived to %p", async archived => {
  expect(
    (
      await request(app)
        .patch("/" + id + "/archive")
        .send({ archived })
    ).status,
  ).toBe(200);
  expect(ReaderBookModel.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: id, userId },
    { $set: { archived } },
    { new: true, runValidators: true },
  );
});
test("rejects deletion of active or foreign book before cleanup", async () => {
  (ReaderBookModel.findOneAndDelete as jest.Mock).mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  });
  expect((await request(app).delete("/" + id)).status).toBe(404);
  expect(ReaderBookModel.findOneAndDelete).toHaveBeenCalledWith(
    { _id: id, userId, archived: true },
    { session },
  );
  expect(ReaderLookupModel.deleteMany).not.toHaveBeenCalled();
  expect(cleanFiles).not.toHaveBeenCalled();
});
test("deletes owned data and unreferenced files in one transaction", async () => {
  await permanentlyDeleteReaderBook(id, userId);
  for (const model of [
    ReaderAnnotationModel,
    ReaderFlagModel,
    ReaderDocumentModel,
    ReaderConversationModel,
    ReaderLookupModel,
  ])
    expect(model.deleteMany).toHaveBeenCalledWith({ userId, bookId: id }, { session });
  expect(cleanFiles).toHaveBeenCalledTimes(2);
  expect(cleanChunks).toHaveBeenCalledWith({ files_id: fileId }, { session });
  expect(session.endSession).toHaveBeenCalled();
});
test("preserves files referenced across users and either file field", async () => {
  (ReaderBookModel.exists as jest.Mock).mockReturnValue({
    session: jest.fn().mockResolvedValue({ _id: "another-owner" }),
  });
  await permanentlyDeleteReaderBook(id, userId);
  expect(ReaderBookModel.exists).toHaveBeenCalledWith({
    $or: [{ fileId }, { originalFileId: fileId }],
  });
  expect(cleanFiles).not.toHaveBeenCalled();
  expect(cleanChunks).not.toHaveBeenCalled();
});
test("removes exclusive vocabulary and recomputes shared vocabulary", async () => {
  (ReaderVocabularyModel.find as jest.Mock).mockReturnValue({
    session: jest.fn().mockResolvedValue([
      { _id: "exclusive", headword: "one", bookIds: [id] },
      { _id: "shared", headword: "two", bookIds: [id, "other"] },
    ]),
  });
  jest
    .spyOn(ReaderLookupModel, "find")
    .mockImplementation(((filter: any) => ({
      sort: () => ({
        session: async () =>
          filter.headword === "one" ? [] : [{ word: "two", createdAt: new Date(1) }],
      }),
    })) as any);
  const remove = jest
    .spyOn(ReaderVocabularyModel, "deleteOne")
    .mockResolvedValue({ deletedCount: 1 } as any);
  const update = jest.spyOn(ReaderVocabularyModel, "updateOne").mockResolvedValue({} as any);
  await permanentlyDeleteReaderBook(id, userId);
  expect(remove).toHaveBeenCalledWith({ _id: "exclusive", userId }, { session });
  expect(update).toHaveBeenCalledWith(
    { _id: "shared", userId },
    expect.objectContaining({
      $pull: { bookIds: id, reviewedBookIds: id, reviewHiddenBookIds: id },
      $set: expect.objectContaining({ lookupCount: 1, observedForms: ["two"] }),
    }),
    { session },
  );
});
test("propagates cleanup failure for transaction rollback and closes session", async () => {
  cleanChunks.mockRejectedValue(new Error("storage failure"));
  await expect(permanentlyDeleteReaderBook(id, userId)).rejects.toThrow("storage failure");
  expect(session.endSession).toHaveBeenCalled();
});
