const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
process.env.TS_NODE_PROJECT = path.resolve(
  __dirname,
  "../backend/tsconfig.json",
);
require("../backend/node_modules/ts-node/register/transpile-only");
const mongoose = require("../backend/node_modules/mongoose");
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");
const { MongoMemoryReplSet } = require(
  process.env.MONGODB_MEMORY_SERVER_MODULE || "mongodb-memory-server",
);
const {
  ReaderBookModel: Books,
} = require("../backend/src/models/reader/readerBookModel");
const {
  ReaderAnnotationModel: Annotations,
} = require("../backend/src/models/reader/readerAnnotationModel");
const {
  ReaderFlagModel: Flags,
} = require("../backend/src/models/reader/readerFlagModel");
const {
  ReaderConversationModel: Chats,
} = require("../backend/src/models/reader/readerConversationModel");
const {
  ReaderVocabularyModel: Words,
  ReaderLookupModel: Lookups,
} = require("../backend/src/models/reader/readerVocabularyModel");
const { asyncLocalStorage } = require("../backend/src/services/ALSService");
const {
  renameReaderBook,
  updateReaderBookArchive,
  deleteReaderBook,
} = require("../backend/src/controllers/reader/readerController");
const {
  saveReaderFile,
  getReaderBucket,
} = require("../backend/src/services/reader/readerStorageService");
test(
  "real MongoDB persistence, isolation, shared file/vocabulary cleanup and rollback",
  { timeout: 180000 },
  async () => {
    const repl = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ storageEngine: "wiredTiger" }],
    });
    try {
      await mongoose.connect(repl.getUri(), { dbName: "ticket35_test" });
      for (const model of [Books, Annotations, Flags, Chats, Words, Lookups])
        await model.init();
      const owner = new mongoose.Types.ObjectId(),
        otherOwner = new mongoose.Types.ObjectId();
      const fileId = await saveReaderFile(
        Buffer.from("epub-original"),
        "test.epub",
        String(owner),
      );
      const safeFile = await saveReaderFile(
        Buffer.from("epub-shared"),
        "shared.epub",
        String(owner),
      );
      const base = {
        userId: owner,
        title: "Original",
        filename: "test.epub",
        size: 13,
        fileId,
        originalFileId: safeFile,
        state: { progress: 0.5, savedAt: 7, location: "epubcfi(/6/2)" },
      };
      const book = await Books.create(base),
        id = String(book._id);
      const sibling = await Books.create({
        ...base,
        title: "Other owner",
        userId: otherOwner,
        fileId: safeFile,
        originalFileId: safeFile,
      });
      const related = { userId: owner, bookId: book._id };
      for (const model of [Annotations, Flags, Chats])
        await model.collection.insertOne({ ...related, marker: "owned" });
      await Annotations.collection.insertOne({
        userId: otherOwner,
        bookId: sibling._id,
        marker: "private",
      });
      const dates = [new Date(1000), new Date(2000)];
      await Lookups.collection.insertMany([
        {
          ...related,
          headword: "shared",
          word: "Shared",
          requestId: "one",
          createdAt: dates[0],
        },
        {
          userId: owner,
          bookId: sibling._id,
          headword: "shared",
          word: "shared",
          requestId: "two",
          createdAt: dates[1],
        },
        {
          ...related,
          headword: "exclusive",
          word: "exclusive",
          requestId: "three",
          createdAt: dates[0],
        },
      ]);
      await Words.collection.insertMany([
        {
          userId: owner,
          headword: "shared",
          bookIds: [book._id, sibling._id],
          reviewedBookIds: [book._id],
          reviewHiddenBookIds: [book._id],
          lookupCount: 2,
        },
        {
          userId: owner,
          headword: "exclusive",
          bookIds: [book._id],
          lookupCount: 1,
        },
      ]);
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) =>
        asyncLocalStorage.run(
          { loggedInUserId: req.headers["x-owner"] || String(owner) },
          next,
        ),
      );
      app.patch("/:id/title", renameReaderBook);
      app.patch("/:id/archive", updateReaderBookArchive);
      app.delete("/:id", deleteReaderBook);
      app.use((err, _req, res, _next) =>
        res.status(err.statusCode || 500).json({ message: err.message }),
      );
      assert.equal(
        (
          await request(app)
            .patch("/" + id + "/title")
            .send({ title: " New name " })
        ).status,
        200,
      );
      let persisted = await Books.findById(id).select(
        "+fileId +originalFileId",
      );
      assert.equal(persisted.title, "New name");
      assert.equal(persisted.state.progress, 0.5);
      assert.equal(String(persisted.fileId), String(fileId));
      assert.equal(await Annotations.countDocuments(related), 1);
      assert.equal(await Flags.countDocuments(related), 1);
      assert.equal(await Chats.countDocuments(related), 1);
      assert.equal(await Lookups.countDocuments(related), 2);
      assert.equal(
        (
          await request(app)
            .patch("/" + id + "/title")
            .set("x-owner", String(otherOwner))
            .send({ title: "Intrusion" })
        ).status,
        404,
      );
      assert.equal((await request(app).delete("/" + id)).status, 404);
      assert.ok(await Books.exists({ _id: id }));
      for (const archived of [true, false, true]) {
        assert.equal(
          (
            await request(app)
              .patch("/" + id + "/archive")
              .send({ archived })
          ).status,
          200,
        );
        assert.equal((await Books.findById(id)).archived, archived);
      }
      assert.equal(
        (
          await request(app)
            .delete("/" + id)
            .set("x-owner", String(otherOwner))
        ).status,
        404,
      );
      // Inject a real failure AFTER transactional deletes, then verify all records roll back.
      const originalFind = Words.find;
      Words.find = () => {
        throw new Error("injected cleanup failure");
      };
      try {
        assert.equal((await request(app).delete("/" + id)).status, 500);
      } finally {
        Words.find = originalFind;
      }
      assert.ok(await Books.exists({ _id: id, archived: true }));
      assert.equal(await Annotations.countDocuments(related), 1);
      assert.equal(await Lookups.countDocuments(related), 2);
      assert.equal(await getReaderBucket().find({ _id: fileId }).count(), 1);
      assert.equal((await request(app).delete("/" + id)).status, 200);
      assert.equal(await Books.exists({ _id: id }), null);
      for (const model of [Annotations, Flags, Chats, Lookups])
        assert.equal(await model.countDocuments(related), 0);
      assert.equal(
        await Words.countDocuments({ userId: owner, headword: "exclusive" }),
        0,
      );
      const shared = await Words.findOne({ userId: owner, headword: "shared" });
      assert.deepEqual(shared.bookIds.map(String), [String(sibling._id)]);
      assert.equal(shared.lookupCount, 1);
      assert.equal(shared.reviewedBookIds.length, 0);
      assert.equal(shared.reviewHiddenBookIds.length, 0);
      assert.deepEqual([...shared.observedForms], ["shared"]);
      assert.equal(await getReaderBucket().find({ _id: fileId }).count(), 0);
      assert.equal(
        await mongoose.connection.db
          .collection("reader_files.chunks")
          .countDocuments({ files_id: fileId }),
        0,
      );
      assert.equal(await getReaderBucket().find({ _id: safeFile }).count(), 1);
      assert.ok(await Books.exists({ _id: sibling._id }));
      assert.equal(await Annotations.countDocuments({ userId: otherOwner }), 1);
    } finally {
      await mongoose.disconnect();
      await repl.stop();
    }
  },
);
