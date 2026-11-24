const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");

// Writing Studio saves send only what changed. These tests pin the diff.
function load() {
  const file = path.join(__dirname, "../frontend/src/components/WritingStudio/bookChanges.ts");
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", outputText)(module, module.exports, require);
  return module.exports;
}
const { diffBook, applyBookChanges, withoutNodeIds } = load();

const id = n => String(n).padStart(24, "0");
const para = (text, _id) => ({ ...(_id && { _id }), type: "paragraph", children: [{ text }] });
function book() {
  return {
    id: id(1), userId: id(2), name: "Ann and Allan", updatedAt: "2026-11-24T00:00:00.000Z",
    filterBy: "chapters", isArchived: false, isReadMode: false, wordGoal: 120000,
    taskBoard: { lists: [{ id: "l", title: "To do", cards: [] }] },
    chapters: [1, 2, 3].map(n => ({
      id: id(10 + n), bookId: id(1), name: `Chapter ${n}`, type: "chapters", isArchived: false,
      text: Array.from({ length: 200 }, (_, i) => para(`Line ${i} of chapter ${n}`, id(1000 + i))),
      description: [para("")],
      drafts: [1, 2].map(d => ({ id: `d${n}${d}`, chapterId: id(10 + n), name: `Draft ${d}`,
        text: [para(`Draft ${d}`)], createdAt: "2026-01-01", updatedAt: "2026-01-01" })),
    })),
    characters: [{ id: id(20), bookId: id(1), name: "Ann", type: "characters", isArchived: false, description: [para("")] }],
    themes: [], plotlines: [],
    notes: [1, 2].map(n => ({ id: id(30 + n), bookId: id(1), name: `Note ${n}`, type: "notes", isArchived: false, text: [para("x")] })),
  };
}

test("an unchanged book has no changes", () => {
  assert.deepEqual(diffBook(book(), structuredClone(book())), []);
});

test("a note edit sends only that note's changed field", () => {
  const before = book();
  const after = structuredClone(before);
  after.notes[1].name = "Renamed";
  const changes = diffBook(before, after);
  assert.deepEqual(changes, [{ type: "item", collection: "notes", id: id(32), set: { name: "Renamed" } }]);
  assert.ok(JSON.stringify(changes).length < 200);
});

test("a task sends the task board, not the chapters", () => {
  const before = book();
  const after = structuredClone(before);
  after.taskBoard.lists[0].cards.push({ id: "c", title: "Call Allan" });
  const changes = diffBook(before, after);
  assert.deepEqual(changes.map(c => c.type), ["book"]);
  assert.deepEqual(Object.keys(changes[0].set), ["taskBoard"]);
});

test("chapter text is sent without paragraph ids; drafts change one at a time", () => {
  const before = book();
  const after = structuredClone(before);
  after.chapters[0].text[3] = para("New line");
  after.chapters[1].drafts[0].text = [para("Edited")];
  const changes = diffBook(before, after);
  assert.deepEqual(changes.map(c => c.type), ["item", "draft"]);
  assert.ok(!JSON.stringify(changes).includes("_id"));
  assert.deepEqual(Object.keys(changes[0].set), ["text"]);
  assert.deepEqual(changes[1], { type: "draft", chapterId: id(12), id: "d21", set: { text: [para("Edited")] } });
});

test("removals and moves send an order; appends do not", () => {
  const before = book();
  const appended = structuredClone(before);
  appended.notes.push({ id: id(40), bookId: id(1), name: "New", type: "notes", isArchived: false, text: [para("")] });
  assert.deepEqual(diffBook(before, appended).map(c => c.type), ["item"]);

  const moved = structuredClone(before);
  moved.chapters.reverse();
  moved.chapters[0].drafts.pop();
  const changes = diffBook(before, moved);
  assert.deepEqual(changes, [
    { type: "draftOrder", chapterId: id(13), ids: ["d31"] },
    { type: "order", collection: "chapters", ids: [id(13), id(12), id(11)] },
  ]);
});

test("a removed field is unset", () => {
  const before = book();
  before.chapters[0].planning = { themes: [], plotlines: [], characters: [] };
  const after = structuredClone(before);
  delete after.chapters[0].planning;
  assert.deepEqual(diffBook(before, after), [{ type: "item", collection: "chapters", id: id(11), set: {}, unset: ["planning"] }]);
});

test("replaying the changes rebuilds the edited book", () => {
  const before = book();
  const after = structuredClone(before);
  after.name = "Ann";
  after.notes[0].isArchived = true;
  after.chapters[2].drafts.reverse();
  after.chapters[1].text.push(para("More"));
  after.chapters.push({ ...structuredClone(before.chapters[0]), id: id(19), name: "New" });
  after.characters.unshift(after.characters.pop());
  const rebuilt = applyBookChanges(before, diffBook(before, after));
  assert.deepEqual(withoutNodeIds(rebuilt), withoutNodeIds({ ...after, chapters: after.chapters.map(c =>
    c.id === id(19) ? { ...c, type: "chapters", bookId: id(1) } : c) }));
});
