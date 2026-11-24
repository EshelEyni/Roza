const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Writing Studio saves: the browser diff, the real middleware chain and the
// /changes endpoint against MongoDB. Set BOOK_TEST_MONGO_URI to use a running
// server; otherwise mongodb-memory-server starts one.
process.env.TS_NODE_PROJECT = path.resolve(__dirname, "../backend/tsconfig.json");
require("../backend/node_modules/ts-node/register/transpile-only");
const ts = require("../frontend/node_modules/typescript");
const mongoose = require("../backend/node_modules/mongoose");
const express = require("../backend/node_modules/express");
const mongoSanitize = require("../backend/node_modules/express-mongo-sanitize");
const request = require("../backend/node_modules/supertest");
const { BookModel } = require("../backend/src/models/books/bookModel");
const { asyncLocalStorage } = require("../backend/src/services/ALSService");
const requestSanitizer = require("../backend/src/middlewares/HTMLSanitizer/HTMLSanitizerMiddleware").default;
const { startServerTiming } = require("../backend/src/services/serverTiming");
const { saveBookChanges } = require("../backend/src/controllers/book/bookChangesController");
const { getBookById } = require("../backend/src/controllers/book/bookController");
const { errorHandler } = require("../backend/src/services/error/errorService");

function loadDiff() {
  const file = path.join(__dirname, "../frontend/src/components/WritingStudio/bookChanges.ts");
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", outputText)(module, module.exports, require);
  return module.exports;
}
const { diffBook } = loadDiff();

const oid = () => new mongoose.Types.ObjectId();
const para = text => ({ _id: oid(), type: "paragraph", children: [{ text }] });
function storedBook(userId) {
  const bookId = oid();
  const chapters = [0, 1, 2].map(n => {
    const _id = oid();
    return {
      _id, bookId, name: `Chapter ${n}`, type: "chapters", format: "prose", isArchived: false,
      text: Array.from({ length: 50 }, (_, i) => para(`Line ${i}`)), description: [para("")],
      drafts: [0, 1].map(d => ({ id: `d${n}${d}`, chapterId: String(_id), name: `Draft ${d}`, text: [para("draft")],
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" })),
      createdAt: new Date(), updatedAt: new Date(),
    };
  });
  const item = (type, name, field) => ({ _id: oid(), bookId, name, type, isArchived: false, [field]: [para(name)], createdAt: new Date(), updatedAt: new Date() });
  return {
    _id: bookId, userId, name: "Ann and Allan", isArchived: false, isReadMode: false, filterBy: "chapters",
    taskBoard: { lists: [{ id: "l", title: "To do", cards: [] }] }, chapters,
    characters: [item("characters", "Ann", "description")], themes: [item("themes", "Home", "description")], plotlines: [],
    notes: [item("notes", "Old note", "text"), item("notes", "Archived", "text")].map((n, i) => ({ ...n, isArchived: i === 1 })),
    createdAt: new Date(), updatedAt: new Date("2026-11-24T00:00:00.000Z"),
  };
}

test("saves send only changes and keep the book consistent", { timeout: 120000 }, async () => {
  const uri = process.env.BOOK_TEST_MONGO_URI;
  const repl = uri ? null : await require(process.env.MONGODB_MEMORY_SERVER_MODULE || "mongodb-memory-server")
    .MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const userId = oid();
  await mongoose.connect(uri || repl.getUri(), { dbName: "bc_test_" + oid() });
  try {
    const raw = storedBook(userId);
    await BookModel.collection.insertOne(raw);
    const app = express();
    app.use("/api/book", startServerTiming);
    app.use(express.json({ limit: "5000kb" }));
    app.use(mongoSanitize());
    app.use(requestSanitizer);
    app.use((_req, _res, next) => asyncLocalStorage.run({ loggedInUserId: String(userId) }, next));
    app.get("/api/book/:id", getBookById);
    app.patch("/api/book/:id([a-fA-F0-9]{24})/changes", saveBookChanges);
    app.use(errorHandler);
    const url = `/api/book/${raw._id}`;
    const load = async () => (await request(app).get(url)).body.data;
    let client = await load();

    async function save(change) {
      const next = change(structuredClone(client));
      const body = { updatedAt: client.updatedAt, changes: diffBook(client, next) };
      const response = await request(app).patch(url + "/changes").send(body);
      assert.equal(response.status, 200, response.body.message);
      assert.deepEqual(Object.keys(response.body.data).sort(), ["id", "updatedAt", "wordGoal"].filter(k => k in response.body.data).sort());
      assert.match(response.headers["server-timing"], /read;dur=.*write;dur=/);
      client = { ...next, updatedAt: response.body.data.updatedAt };
      return JSON.stringify(body).length;
    }

    assert.ok(await save(b => { b.notes[0].name = "Renamed"; return b; }) < 300);
    await save(b => { b.taskBoard.lists[0].cards.push({ id: "c", title: "Call Allan", chapterId: b.chapters[0].id, completed: false, description: "", dueDate: "", checklist: [], labels: [], createdAt: "2026-11-24", updatedAt: "2026-11-24" }); return b; });
    await save(b => { b.chapters[1].text[2] = { type: "paragraph", children: [{ text: "Ann opened the door." }] }; return b; });
    await save(b => { b.chapters[1].drafts[1].text = [{ type: "paragraph", children: [{ text: "Draft line" }] }]; return b; });
    await save(b => { b.chapters[1].drafts.push({ id: "new", chapterId: b.chapters[1].id, name: "Draft 3", text: [{ type: "paragraph", children: [{ text: "x" }] }], createdAt: "2026-11-24", updatedAt: "2026-11-24" }); return b; });
    await save(b => { b.chapters[1].drafts.shift(); b.chapters.reverse(); return b; });
    await save(b => { b.chapters[0].planning = { themes: [{ entityId: b.themes[0].id, note: "" }], plotlines: [], characters: [] }; return b; });
    await save(b => { b.notes[0].isArchived = true; b.name = "$name"; b.wordGoal = 90000; return b; });

    const stored = await load();
    const view = book => JSON.stringify(book, (key, value) =>
      ["_id", "createdAt", "updatedAt"].includes(key) ? undefined
        : value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
    const expected = { ...client, notes: client.notes.filter(note => !note.isArchived) };
    assert.equal(view(stored), view(expected));
    // The archived note is kept in storage; paragraphs saved here carry no ids.
    const rawAfter = await BookModel.collection.findOne({ _id: raw._id });
    assert.equal(rawAfter.notes.length, 2);
    assert.equal(rawAfter.chapters.find(c => c.name === "Chapter 1").text[2]._id, undefined);

    const stale = await request(app).patch(url + "/changes").send({ updatedAt: "2026-01-01T00:00:00.000Z", changes: [{ type: "book", set: { name: "x" } }] });
    assert.equal(stale.status, 409);
    for (const changes of [
      [{ type: "item", collection: "chapters", id: client.chapters[0].id, set: { planning: { characters: [{ entityId: String(oid()) }] } } }],
      [{ type: "item", collection: "notes", id: client.notes[0].id, set: { bookId: String(oid()) } }],
      [{ type: "order", collection: "notes", ids: [String(oid())] }],
      [{ type: "draft", chapterId: client.chapters[0].id, id: "z", set: { name: "No text", createdAt: "2026-01-01", updatedAt: "2026-01-01" } }],
      [{ type: "book", set: { isArchived: true } }],
    ]) {
      const response = await request(app).patch(url + "/changes").send({ updatedAt: client.updatedAt, changes });
      assert.equal(response.status, 400, JSON.stringify(changes));
    }
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await repl?.stop();
  }
});
