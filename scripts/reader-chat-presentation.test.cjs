const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const exportsObject = {};
new Function("exports", ts.transpileModule(fs.readFileSync(path.join(__dirname,
  "../frontend/src/services/readerChatPresentation.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(exportsObject);
const { buildReaderChatView } = exportsObject;
const passage = { cfi: "position", text: "The selected paragraph." };
const turn = (id, question = "", selected = passage) => ({ id, question, passage: selected,
  status: "completed", answer: "Answer", createdAt: "2026-10-27" });

test("the draft selection appears only before it has been submitted", () => {
  assert.equal(buildReaderChatView([], undefined, null, passage).draftPassage, passage);
  const view = buildReaderChatView([turn("first")], passage, null, passage);
  assert.equal(view.draftPassage, undefined);
  assert.equal(view.attachedReferenceId, "first");
});
test("quote-only requests have one source and no invented user question", () => {
  const view = buildReaderChatView([turn("first")], passage, null, passage);
  assert.equal(view.entries[0].message.passage, passage);
  assert.equal(view.entries[0].message.question, undefined);
});
test("a quoted source and an authored question remain separate within one turn", () => {
  const view = buildReaderChatView([turn("first", "מה פירוש המשפט?")], passage);
  assert.equal(view.entries[0].message.passage, passage);
  assert.equal(view.entries[0].message.question, "מה פירוש המשפט?");
});
test("exact legacy copies of the quote are hidden only in the presentation", () => {
  const turns = [turn("first", "  " + passage.text + "  ")];
  const before = JSON.stringify(turns);
  assert.equal(buildReaderChatView(turns, passage).entries[0].message.question, undefined);
  assert.equal(JSON.stringify(turns), before);
});
test("similar authored text is never stripped from a question", () => {
  const text = passage.text + " Why is it written this way?";
  assert.equal(buildReaderChatView([turn("first", text)], passage).entries[0].message.question, text);
});
test("follow-ups link to the first source rather than repeating it", () => {
  const view = buildReaderChatView([turn("first"), turn("second", "Why?")], passage);
  assert.equal(view.entries[1].message.passage, undefined);
  assert.equal(view.entries[1].message.referenceId, "first");
  assert.equal(view.entries[1].message.question, "Why?");
});
test("identical words selected at different locations remain distinct sources", () => {
  const view = buildReaderChatView([turn("first"), turn("second", "", { ...passage, cfi: "another" })]);
  assert.ok(view.entries[0].message.passage);
  assert.ok(view.entries[1].message.passage);
});
test("optimistic submissions replace the draft and do not duplicate saved pending turns", () => {
  const pending = { id: "pending", question: "", passage };
  const optimistic = buildReaderChatView([], passage, pending, passage);
  assert.equal(optimistic.draftPassage, undefined);
  assert.equal(optimistic.pending.passage, passage);
  const saved = buildReaderChatView([{ ...turn("pending"), status: "pending" }], passage, pending, passage);
  assert.equal(saved.pending, undefined);
  assert.ok(saved.entries[0].message.passage);
});
test("legacy conversation-level sources are shown once without migrating saved records", () => {
  const view = buildReaderChatView([turn("first", passage.text, undefined), turn("second", "Why?", undefined)]
    .map(item => ({ ...item, passage: undefined })), passage);
  assert.equal(view.entries[0].message.question, undefined);
  assert.equal(view.entries[0].message.passage, passage);
  assert.equal(view.entries[1].message.referenceId, "first");
});
test("a new selection can be previewed while a prior source remains in history", () => {
  const next = { cfi: "new", text: "New selection" };
  const view = buildReaderChatView([turn("first")], passage, null, next);
  assert.equal(view.draftPassage, next);
});
