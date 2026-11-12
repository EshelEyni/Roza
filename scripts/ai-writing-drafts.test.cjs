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
  createEditor,
  Editor,
  Transforms,
} = require("../frontend/node_modules/slate");
const {
  withHistory,
  HistoryEditor,
} = require("../frontend/node_modules/slate-history");
const {
  captureEdit,
  replaceEditedText,
  rangeText,
  wordDiff,
} = require("../frontend/src/components/WritingStudio/aiEditing.ts");
const {
  createChapterDraft,
  promoteChapterDraft,
  changeChapterDraft,
} = require("../frontend/src/components/WritingStudio/chapterDrafts.ts");
const {
  DraftStore,
} = require("../frontend/src/components/WritingStudio/draftStore.ts");
const {
  validatePlanning,
} = require("../backend/src/controllers/book/planningValidation.ts");
const {
  bookSchema,
} = require("../backend/src/models/books/schemas/bookSchema.ts");
const { model } = require("../backend/node_modules/mongoose");
const p = (text) => ({ type: "paragraph", children: [{ text }] });
const chapter = () => ({
  id: "333333333333333333333333",
  bookId: "222222222222222222222222",
  name: "Home",
  type: "chapters",
  format: "prose",
  text: [p("Main original")],
  description: [p("Summary")],
  annotations: [
    {
      id: "a",
      content: "Keep note",
      quote: "Main",
      anchor: {
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 4 },
      },
    },
  ],
});
const book = () => ({
  id: "222222222222222222222222",
  userId: "111111111111111111111111",
  name: "Novel",
  updatedAt: "2026-11-01T00:00:00.000Z",
  chapters: [chapter()],
  characters: [],
  themes: [],
  plotlines: [],
  notes: [],
});
test("word diff reconstructs both originals including Hebrew and whitespace", () => {
  for (const [a, b] of [
    ["She are here.", "She is here."],
    ["היא הלך הביתה.", "היא הלכה הביתה."],
    ["a\n\nb", "a\n\nc"],
    ["", "x"],
    ["x", ""],
    ["a ".repeat(600), "b ".repeat(600)],
  ]) {
    const parts = wordDiff(a, b);
    assert.equal(
      parts
        .filter((x) => x.type !== "add")
        .map((x) => x.text)
        .join(""),
      a,
    );
    assert.equal(
      parts
        .filter((x) => x.type !== "remove")
        .map((x) => x.text)
        .join(""),
      b,
    );
  }
});
test("selection edits preserve surrounding content, marks, paragraph boundaries and undo/redo", () => {
  const e = withHistory(createEditor());
  e.children = [
    {
      type: "paragraph",
      children: [
        { text: "Before " },
        { text: "she are", bold: true },
        { text: " here after." },
      ],
    },
    p("Next paragraph."),
  ];
  const original = structuredClone(e.children);
  const range = {
    anchor: { path: [0, 1], offset: 0 },
    focus: { path: [0, 1], offset: 7 },
  };
  const snap = captureEdit(e, range);
  assert.equal(snap.original, "she are");
  assert.equal(replaceEditedText(e, snap, "she is"), true);
  assert.equal(
    rangeText(e, Editor.range(e, [])).text,
    "Before she is here after.\nNext paragraph.",
  );
  assert.equal(e.children[0].children.find((n) => n.bold).text, "she is");
  HistoryEditor.undo(e);
  assert.deepEqual(e.children, original);
  HistoryEditor.redo(e);
  assert.equal(e.children[0].children[1].text, "she is");
});
test("multi-block and nested-list edits preserve unaffected rich structure", () => {
  const e = withHistory(createEditor());
  e.children = [
    p("First are here."),
    {
      type: "bulleted-list",
      children: [
        {
          type: "list-item",
          children: [{ text: "Second are here.", italic: true }],
        },
        { type: "list-item", children: [{ text: "שלום עולם" }] },
      ],
    },
    p("Last."),
  ];
  const before = structuredClone(e.children);
  const s = captureEdit(e, Editor.range(e, []));
  assert.equal(
    s.original,
    "First are here.\nSecond are here.\nשלום עולם\nLast.",
  );
  assert.ok(
    replaceEditedText(
      e,
      s,
      "First is here.\nSecond is here.\nשלום עולם\nLast.",
    ),
  );
  assert.equal(e.children[1].type, "bulleted-list");
  assert.equal(e.children[1].children[0].children[0].italic, true);
  HistoryEditor.undo(e);
  assert.deepEqual(e.children, before);
});
test("block insertion, removal and empty paragraphs map safely", () => {
  for (const [before, after] of [
    [[p("One."), p("Two.")], "One.\nNew.\nTwo."],
    [[p("One."), p(""), p("Two.")], "One.\nTwo."],
    [[p("One."), p("Two.")], "Joined."],
  ]) {
    const e = withHistory(createEditor());
    e.children = before;
    const snap = captureEdit(e, Editor.range(e, []));
    replaceEditedText(e, snap, after);
    assert.equal(rangeText(e, Editor.range(e, [])).text, after);
    HistoryEditor.undo(e);
    assert.deepEqual(e.children, before);
  }
});
test("stale text or formatting blocks replacement without any mutation", () => {
  const e = withHistory(createEditor());
  e.children = [p("She are here.")];
  const s = captureEdit(e, Editor.range(e, []));
  Transforms.insertText(e, "New ", { at: { path: [0, 0], offset: 0 } });
  const changed = structuredClone(e.children);
  assert.equal(replaceEditedText(e, s, "She is here."), false);
  assert.deepEqual(e.children, changed);
});
test("drafts clone independently; promotion and recovery preserve text, annotations, format and draft", () => {
  let c = chapter();
  const d = createChapterDraft(c, "Alternative");
  const blank = createChapterDraft(c, "Blank", true);
  assert.equal(blank.text[0].children[0].text, "");
  d.text[0].children[0].text = "Alternative text";
  assert.equal(c.text[0].children[0].text, "Main original");
  c.drafts = [d, blank];
  c = changeChapterDraft(c, d.id, { name: "Renamed" });
  const promoted = promoteChapterDraft(c, d.id);
  assert.equal(promoted.text[0].children[0].text, "Alternative text");
  assert.equal(promoted.drafts.length, 3);
  assert.equal(promoted.drafts[0].name, "Renamed");
  const backup = promoted.drafts[2];
  assert.ok(Date.parse(backup.createdAt));
  const recovered = promoteChapterDraft(promoted, backup.id);
  assert.deepEqual(recovered.text, c.text);
  assert.deepEqual(recovered.annotations, c.annotations);
  assert.equal(recovered.format, c.format);
});
test("schema roundtrip persists drafts and rejects foreign chapter IDs and duplicates", () => {
  const b = book();
  b.chapters[0].drafts = [createChapterDraft(b.chapters[0], "טיוטה")];
  validatePlanning(b, b.id);
  const Model = model("AiWritingDraftsTest", bookSchema);
  const doc = new Model(b);
  assert.equal(doc.validateSync(), undefined);
  const restored = new Model(JSON.parse(JSON.stringify(doc)));
  assert.equal(restored.chapters[0].drafts[0].name, "טיוטה");
  assert.equal(
    restored.chapters[0].drafts[0].annotations[0].content,
    "Keep note",
  );
  b.chapters[0].drafts[0].chapterId = "foreign";
  assert.throws(() => validatePlanning(b, b.id));
  b.chapters[0].drafts[0].chapterId = b.chapters[0].id;
  b.chapters[0].drafts.push(b.chapters[0].drafts[0]);
  assert.throws(() => validatePlanning(b, b.id));
});
test("serialized autosave retains pending edits across draft/chapter switches and reload", async () => {
  const b = book();
  b.chapters.push({ ...chapter(), id: "444444444444444444444444" });
  const d = createChapterDraft(b.chapters[0], "One"),
    d2 = createChapterDraft(b.chapters[0], "Two");
  b.chapters[0].drafts = [d, d2];
  const data = new Map();
  let resolve, sent;
  const storage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  let writes = 0;
  const store = new DraftStore(
    b,
    async (snapshot) => {
      sent = snapshot;
      writes++;
      if (writes === 1) await new Promise((r) => (resolve = r));
      return {
        ...snapshot,
        updatedAt: new Date(Date.parse(b.updatedAt) + writes).toISOString(),
      };
    },
    storage,
  );
  const edit = (id, text) =>
    store.edit((b) => ({
      ...b,
      chapters: b.chapters.map((c) =>
        c.id === d.chapterId
          ? changeChapterDraft(c, id, { text: [p(text)] })
          : c,
      ),
    }));
  edit(d.id, "First pending");
  const saving = store.flush();
  edit(d.id, "Newest first");
  edit(d2.id, "Second pending");
  resolve();
  await saving;
  assert.equal(writes, 2);
  assert.equal(
    sent.chapters[0].drafts[0].text[0].children[0].text,
    "Newest first",
  );
  assert.equal(
    sent.chapters[0].drafts[1].text[0].children[0].text,
    "Second pending",
  );
  assert.equal(
    store.book.chapters[0].text[0].children[0].text,
    "Main original",
  );
  assert.equal(
    store.book.chapters[1].text[0].children[0].text,
    "Main original",
  );
  assert.equal(store.dirty, false);
  const reload = new DraftStore(
    JSON.parse(JSON.stringify(sent)),
    async (x) => x,
    storage,
  );
  assert.equal(reload.book.chapters[0].drafts[1].name, "Two");
  store.dispose();
  reload.dispose();
});
