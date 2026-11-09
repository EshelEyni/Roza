import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import { updateBook } from "./bookController";
import { BookModel } from "../../models/books/bookModel";

jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: () => "111111111111111111111111",
}));
jest.mock("../../models/books/bookModel", () => ({
  BookModel: { collection: { findOne: jest.fn() }, findOneAndUpdate: jest.fn() },
}));
const app = express();
app.use(express.json());
app.patch("/:id", updateBook);
app.use(
  (
    error: { statusCode?: number; message: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(error.statusCode || 500).json({ message: error.message });
  },
);
const id = "222222222222222222222222";
const date = new Date("2026-11-01T12:00:00.000Z");
const read = BookModel.collection.findOne as jest.Mock;
const write = BookModel.findOneAndUpdate as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue({
    _id: new Types.ObjectId(id),
    updatedAt: date,
    chapters: [
      { _id: new Types.ObjectId("333333333333333333333333"), isArchived: true, name: "Archived" },
    ],
  });
  write.mockResolvedValue({ id, updatedAt: new Date(date.getTime() + 1) });
});
test("rejects stale whole-book updates without writing", async () => {
  const response = await request(app)
    .patch(`/${id}`)
    .send({ name: "stale", updatedAt: "2026-01-01T00:00:00.000Z" });
  expect(response.status).toBe(409);
  expect(write).not.toHaveBeenCalled();
});
test("preserves hidden archived chapters and normalizes stable new item IDs", async () => {
  const response = await request(app)
    .patch(`/${id}`)
    .send({
      updatedAt: date.toISOString(),
      chapters: [{ id: "444444444444444444444444", name: "New" }],
      userId: "attacker",
      $unset: { chapters: 1 },
    });
  expect(response.status).toBe(200);
  const [filter, update, options] = write.mock.calls[0];
  expect(filter.userId).toBe("111111111111111111111111");
  expect(filter.updatedAt).toEqual(date);
  expect(update.$set.chapters).toHaveLength(2);
  expect(update.$set.chapters[0]._id).toBe("444444444444444444444444");
  expect(update.$set.chapters[1].name).toBe("Archived");
  expect(update.$set.userId).toBeUndefined();
  expect(update.$set.$unset).toBeUndefined();
  expect(options.runValidators).toBe(true);
  expect(options.timestamps).toBe(false);
});
test("returns conflict if another writer wins the atomic update", async () => {
  write.mockResolvedValue(null);
  const response = await request(app)
    .patch(`/${id}`)
    .send({ updatedAt: date.toISOString(), name: "New" });
  expect(response.status).toBe(409);
});
test("does not duplicate an archived item restored by the client", async () => {
  await request(app)
    .patch(`/${id}`)
    .send({
      updatedAt: date.toISOString(),
      chapters: [{ id: "333333333333333333333333", isArchived: false, name: "Restored" }],
    });
  expect(write.mock.calls[0][1].$set.chapters).toHaveLength(1);
});
test("rejects missing or other-owner books and malformed arrays", async () => {
  read.mockResolvedValueOnce(null);
  expect((await request(app).patch(`/${id}`).send({ name: "Other" })).status).toBe(404);
  expect((await request(app).patch(`/${id}`).send({ chapters: "invalid" })).status).toBe(400);
  expect(write).not.toHaveBeenCalled();
});

test("requires a base version for manuscript array replacements", async () => {
  const response = await request(app).patch(`/${id}`).send({ chapters: [] });
  expect(response.status).toBe(409);
  expect(write).not.toHaveBeenCalled();
});

test("task boards require a version and preserve owner scoping and manuscript contents", async () => {
  const taskBoard = { lists: [{ id: "list", title: "Research", cards: [] }] };
  expect((await request(app).patch(`/${id}`).send({ taskBoard })).status).toBe(409);
  expect(write).not.toHaveBeenCalled();
  const response = await request(app).patch(`/${id}`).send({ taskBoard, updatedAt: date.toISOString(), userId: "attacker" });
  expect(response.status).toBe(200);
  expect(write.mock.calls[0][0].userId).toBe("111111111111111111111111");
  expect(write.mock.calls[0][1].$set.taskBoard).toEqual(taskBoard);
  expect(write.mock.calls[0][1].$set.chapters).toBeUndefined();
});
