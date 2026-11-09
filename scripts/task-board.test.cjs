const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = (m, p) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(p, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    p,
  );
const {
  emptyBoard,
  moveTask,
} = require("../frontend/src/components/WritingStudio/taskBoardModel.ts");
const {
  DraftStore,
} = require("../frontend/src/components/WritingStudio/draftStore.ts");
const board = () => ({
  lists: [
    {
      id: "a",
      title: "To Do",
      cards: [
        { id: "1", title: "One" },
        { id: "2", title: "Two" },
        { id: "3", title: "Three" },
      ],
    },
    { id: "b", title: "Done", cards: [] },
  ],
});
test("independent default boards and unrestricted list ordering", () => {
  const a = emptyBoard(),
    b = emptyBoard();
  assert.deepEqual(
    a.lists.map((l) => l.title),
    ["To Do", "In Progress", "Done"],
  );
  assert.notEqual(a.lists[0].id, b.lists[0].id);
  a.lists.push({ id: "extra", title: "Research", cards: [] });
  assert.equal(moveTask(a, "extra", a.lists[0].id).lists[0].id, "extra");
});
test("moves cards down, up and into empty lists without mutating input", () => {
  const a = board();
  assert.deepEqual(
    moveTask(a, "1", "2").lists[0].cards.map((c) => c.id),
    ["2", "1", "3"],
  );
  assert.deepEqual(
    moveTask(a, "3", "1").lists[0].cards.map((c) => c.id),
    ["3", "1", "2"],
  );
  const b = moveTask(a, "1", "b");
  assert.equal(b.lists[1].cards[0].id, "1");
  assert.equal(b.lists[0].cards.length, 2);
  assert.equal(a.lists[0].cards.length, 3);
  assert.deepEqual(moveTask(a, "missing", "b"), a);
});
test("task edits use recovery, serialized persistence and book-scoped storage", async () => {
  let saved;
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
  const book = {
    id: "book-a",
    userId: "owner",
    chapters: [],
    updatedAt: "2026-01-01",
  };
  const store = new DraftStore(
    book,
    async (b) => {
      saved = b;
      return { ...b, updatedAt: "2026-01-02" };
    },
    storage,
  );
  store.edit((b) => ({ ...b, taskBoard: board() }));
  assert.ok(map.get(store.key).includes("taskBoard"));
  await store.flush();
  assert.equal(saved.taskBoard.lists[0].cards.length, 3);
  assert.equal(map.size, 0);
  const other = new DraftStore(
    { ...book, id: "book-b" },
    async (b) => b,
    storage,
  );
  assert.notEqual(store.key, other.key);
  assert.equal(other.book.taskBoard, undefined);
  store.dispose();
  other.dispose();
});
test("mongoose round trip preserves card fields and validates required titles and colors", () => {
  const { BookModel } = require("../backend/src/models/books/bookModel.ts");
  const base = {
    userId: "111111111111111111111111",
    name: "Novel",
    taskBoard: {
      lists: [
        {
          id: "list",
          title: "Research",
          cards: [
            {
              id: "card",
              title: "Read",
              description: "Multiline\ntext",
              dueDate: "2026-12-01",
              createdAt: "2026-11-09",
              updatedAt: "2026-11-09",
              checklist: [{ id: "item", title: "Library", done: true }],
              labels: [{ id: "label", title: "History", color: "#123456" }],
            },
          ],
        },
      ],
    },
  };
  const doc = new BookModel(base);
  assert.equal(doc.validateSync(), undefined);
  const output = doc.toJSON();
  assert.equal(output.taskBoard.lists[0].cards[0].checklist[0].done, true);
  base.taskBoard.lists[0].cards[0].title = " ";
  assert.ok(new BookModel(base).validateSync());
  base.taskBoard.lists[0].cards[0].title = "Valid";
  base.taskBoard.lists[0].cards[0].labels[0].color = "invalid";
  assert.ok(new BookModel(base).validateSync());
});
