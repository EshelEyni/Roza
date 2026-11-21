const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
process.env.TS_NODE_PROJECT = path.resolve(__dirname, "../backend/tsconfig.json");
require("../backend/node_modules/ts-node/register/transpile-only");
const mongoose = require("../backend/node_modules/mongoose");
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");
const { ReaderBookModel } = require("../backend/src/models/reader/readerBookModel");
const { asyncLocalStorage } = require("../backend/src/services/ALSService");
const {
  getReaderBooks, updateReaderBookArchive, updateReaderBookOrder,
  updateReaderBookPin, deleteReaderBook,
} = require("../backend/src/controllers/reader/readerController");

test("library pages, searches and mutations stay consistent in MongoDB", { timeout: 90000 }, async () => {
  const repl = process.env.READER_TEST_MONGO_URI ? null : await require(
    process.env.MONGODB_MEMORY_SERVER_MODULE || "mongodb-memory-server",
  ).MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const oid = () => new mongoose.Types.ObjectId();
  const owner = oid();
  const outsider = oid();
  const database = "reader_library_test_" + oid();
  try {
    await mongoose.connect(process.env.READER_TEST_MONGO_URI || repl.getUri(), { dbName: database });
    await ReaderBookModel.init();
    const base = { userId: owner, filename: "test.epub", size: 1, fileId: oid(), originalFileId: oid() };
    const rows = await ReaderBookModel.create(Array.from({ length: 17 }, (_, i) => ({
      ...base, title: "Book " + String(i).padStart(2, "0"),
      author: i === 16 ? "A.* Author" : "Writer", state: { savedAt: 100 - i, progress: i === 1 ? 1 : 0, location: i === 16 ? "saved-location" : "" },
      createdAt: new Date(1000 + i),
    })));
    const ids = rows.map(row => row.id);
    const hidden = await ReaderBookModel.create({ ...base, title: "Archived A.*", archived: true });
    const foreign = await ReaderBookModel.create({ ...base, userId: outsider, title: "Foreign A.*" });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => asyncLocalStorage.run({ loggedInUserId: String(owner) }, next));
    app.get("/", getReaderBooks);
    app.patch("/:id/archive", updateReaderBookArchive);
    app.patch("/:id/order", updateReaderBookOrder);
    app.patch("/:id/pin", updateReaderBookPin);
    app.delete("/:id", deleteReaderBook);
    app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
    const session = request.agent(app);
    const secondSession = request.agent(app);
    const page = async (query, client = session) => (await client.get("/").query(query).expect(200)).body.data;
    const all = async (query, client) => {
      let cursor;
      const books = [];
      const sizes = [];
      do {
        const result = await page(cursor ? { ...query, cursor } : query, client);
        books.push(...result.books.map(book => book.id));
        sizes.push(result.books.length);
        cursor = result.nextCursor;
        assert.ok(sizes.length <= 3, "pagination terminates");
      } while (cursor);
      assert.equal(new Set(books).size, books.length);
      return { books, sizes };
    };

    assert.deepEqual(await all({}), { books: ids, sizes: [8, 8, 1] });
    assert.deepEqual((await page({ counts: true, status: "reading", q: "Author" })).counts,
      { all: 17, reading: 1, unread: 15, finished: 1 });
    assert.deepEqual((await all({ status: "reading", q: "Author" })).books, [ids[16]]);
    assert.deepEqual((await all({ status: "finished" })).books, [ids[1]]);
    assert.equal((await page({ resume: true, sort: "title" })).resume.id, ids[16]);
    assert.equal((await page({ resume: true, q: "Author" })).resume, undefined);
    assert.deepEqual((await all({ sort: "added" })).books, [...ids].reverse());
    assert.deepEqual((await all({ status: "unread" })).sizes, [8, 7]);
    const unread = await page({ status: "unread", counts: true });
    const nextUnread = await page({ status: "unread", counts: true, cursor: unread.nextCursor });
    assert.equal(nextUnread.counts, undefined);
    await session.get("/").query({ status: "finished", cursor: unread.nextCursor }).expect(400);
    assert.deepEqual((await all({ q: "a.*", sort: "author" })).books, [ids[16]]);
    assert.deepEqual((await all({ q: "a.*", archived: true })).books, [hidden.id]);

    await session.patch("/" + foreign.id + "/pin").send({ pinned: true }).expect(404);
    await session.patch("/" + ids[16] + "/pin").send({ pinned: true }).expect(200);
    for (const sort of ["recent", "title", "author", "custom"]) {
      const pinned = await page({ sort }, secondSession);
      assert.equal(pinned.books[0].id, ids[16]);
      assert.equal(pinned.books[0].pinned, true);
    }
    await session.patch("/" + ids[16] + "/order")
      .send({ anchorId: ids[0], placement: "before", archived: false }).expect(409);
    await session.patch("/" + ids[16] + "/pin").send({ pinned: false }).expect(200);

    await session.patch("/" + ids[16] + "/order")
      .send({ anchorId: foreign.id, placement: "before", archived: false }).expect(404);
    const before = await all({ sort: "custom" });
    assert.deepEqual(before.books, ids);
    // Move across the batch boundary, then move between two visible search
    // results with other books between them in the full order.
    await session.patch("/" + ids[9] + "/order")
      .send({ anchorId: ids[2], placement: "before", archived: false }).expect(200);
    assert.deepEqual((await all({ sort: "custom" }, secondSession)).books,
      [...ids.slice(0, 2), ids[9], ...ids.slice(2, 9), ...ids.slice(10)]);
    await ReaderBookModel.updateMany({ _id: { $in: [ids[0], ids[16]] } }, { author: "Filtered" });
    assert.deepEqual((await all({ sort: "custom", q: "Filtered" })).books, [ids[0], ids[16]]);
    await session.patch("/" + ids[16] + "/order")
      .send({ anchorId: ids[0], placement: "before", archived: false }).expect(200);
    const ordered = [ids[16], ...ids.slice(0, 2), ids[9], ...ids.slice(2, 9), ...ids.slice(10, 16)];
    assert.deepEqual((await all({ sort: "custom" }, secondSession)).books, ordered);

    await session.patch("/" + ids[16] + "/pin").send({ pinned: true }).expect(200);
    await session.patch("/" + ids[16] + "/archive").send({ archived: true }).expect(200);
    const archived = await page({ archived: true, sort: "custom", q: "Filtered" }, secondSession);
    assert.deepEqual(archived.books.map(book => [book.id, book.pinned]), [[ids[16], true]]);
    assert.deepEqual((await all({ sort: "custom" })).books, ordered.slice(1));
    await session.patch("/" + ids[16] + "/archive").send({ archived: false }).expect(200);
    await session.patch("/" + ids[16] + "/pin").send({ pinned: false }).expect(200);
    await session.delete("/" + hidden.id).expect(200);
    const added = await ReaderBookModel.create({ ...base, title: "Newest" });
    assert.deepEqual((await all({ sort: "custom" }, secondSession)).books, [...ordered, added.id]);
  } finally {
    await mongoose.disconnect();
    await repl?.stop();
  }
});
