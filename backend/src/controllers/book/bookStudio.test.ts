import express from "express";
import request from "supertest";
import { model, Types } from "mongoose";
import { getBookById, updateBook } from "./bookController";
import { BookModel } from "../../models/books/bookModel";
import { bookSchema } from "../../models/books/schemas/bookSchema";

jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: () => "111111111111111111111111",
}));
jest.mock("../../models/books/bookModel", () => ({
  BookModel: { collection: { findOne: jest.fn() }, findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
const app = express();
app.use(express.json());
app.patch("/:id", updateBook);
app.get("/:id", getBookById);
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
const SchemaBook = model("WordGoalSchemaTest", bookSchema);
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

test("book schema stores a goal only when supplied and accepts the inclusive bounds", () => {
  const fields = { name: "Novel", userId: "111111111111111111111111" };
  const unset = new SchemaBook(fields);
  expect(unset.validateSync()).toBeUndefined();
  expect(unset.toJSON()).not.toHaveProperty("wordGoal");
  for (const wordGoal of [1, 10_000_000]) {
    const book = new SchemaBook({ ...fields, wordGoal });
    expect(book.validateSync()).toBeUndefined();
    expect(book.toJSON()).toHaveProperty("wordGoal", wordGoal);
  }
  for (const wordGoal of [0, 10_000_001, 2.5, null])
    expect(new SchemaBook({ ...fields, wordGoal }).validateSync()?.errors.wordGoal).toBeDefined();
});

test("updates and returns the book word goal through the existing endpoints", async () => {
  const wordGoal = 72_000;
  const book = { id, wordGoal, updatedAt: new Date(date.getTime() + 1) };
  write.mockResolvedValueOnce(book);
  (BookModel.findOne as jest.Mock).mockResolvedValueOnce(book);
  const response = await request(app).patch(`/${id}`).send({ wordGoal, updatedAt: date.toISOString() });
  expect(response.status).toBe(200);
  expect(response.body.data.wordGoal).toBe(wordGoal);
  expect(write.mock.calls[0][1].$set.wordGoal).toBe(wordGoal);
  const fetched = await request(app).get(`/${id}`);
  expect(fetched.status).toBe(200);
  expect(fetched.body.data.wordGoal).toBe(wordGoal);
});

test("rejects invalid goal updates before writing and leaves the goal alone when omitted", async () => {
  for (const wordGoal of [0, 10_000_001, 1.5, "50000", null]) {
    expect((await request(app).patch(`/${id}`).send({ wordGoal })).status).toBe(400);
  }
  expect(write).not.toHaveBeenCalled();
  expect((await request(app).patch(`/${id}`).send({ name: "Renamed" })).status).toBe(200);
  expect(write.mock.calls[0][1].$set).not.toHaveProperty("wordGoal");
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
  const response = await request(app)
    .patch(`/${id}`)
    .send({ taskBoard, updatedAt: date.toISOString(), userId: "attacker" });
  expect(response.status).toBe(200);
  expect(write.mock.calls[0][0].userId).toBe("111111111111111111111111");
  expect(write.mock.calls[0][1].$set.taskBoard).toEqual(taskBoard);
  expect(write.mock.calls[0][1].$set.chapters).toBeUndefined();
});

test("rejects cross-book planning and task references before writing", async () => {
  for (const change of [
    {
      chapters: [
        {
          id: "444444444444444444444444",
          planning: { themes: [{ entityId: "555555555555555555555555" }] },
        },
      ],
    },
    {
      taskBoard: {
        lists: [
          {
            id: "list",
            title: "Work",
            cards: [{ id: "task", chapterId: "555555555555555555555555" }],
          },
        ],
      },
    },
    { characters: [{ id: "444444444444444444444444", bookId: "555555555555555555555555" }] },
  ]) {
    const response = await request(app)
      .patch(`/${id}`)
      .send({ updatedAt: date.toISOString(), ...change });
    expect(response.status).toBe(400);
  }
  expect(write).not.toHaveBeenCalled();
});

test("preserves hidden archived story elements referenced by chapter plans", async () => {
  read.mockResolvedValueOnce({
    _id: new Types.ObjectId(id),
    updatedAt: date,
    characters: [
      {
        _id: new Types.ObjectId("555555555555555555555555"),
        bookId: new Types.ObjectId(id),
        isArchived: true,
      },
    ],
  });
  const response = await request(app)
    .patch(`/${id}`)
    .send({
      updatedAt: date.toISOString(),
      characters: [],
      chapters: [
        {
          id: "444444444444444444444444",
          bookId: id,
          planning: {
            characters: [{ entityId: "555555555555555555555555", note: "Keep recovery" }],
          },
        },
      ],
    });
  expect(response.status).toBe(200);
  expect(write.mock.calls[0][1].$set.characters).toHaveLength(1);
  expect(write.mock.calls[0][1].$set.chapters[0].planning.characters[0].note).toBe("Keep recovery");
});
