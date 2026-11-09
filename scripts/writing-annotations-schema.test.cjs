const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
const mongoose = require("../backend/node_modules/mongoose");
const {
  chapterSchema,
} = require("../backend/src/models/books/schemas/chapterScehma.ts");
const Chapter = mongoose.model("AnnotationSchemaTest", chapterSchema);
const fixture = () => ({
  bookId: "222222222222222222222222",
  name: "Chapter",
  text: [{ type: "paragraph", children: [{ text: "Text" }] }],
  description: [
    {
      type: "paragraph",
      children: [{ text: "Legacy rich notes", italic: true }],
    },
  ],
  annotations: [
    {
      id: "note",
      content: "Revision",
      quote: "Text",
      anchor: {
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 4 },
      },
      x: 500,
      y: 300,
    },
  ],
});
test("schema round-trip preserves annotation ranges and legacy notes, discarding screen coordinates", async () => {
  const doc = new Chapter(fixture());
  await doc.validate();
  const saved = doc.toObject();
  assert.equal(saved.annotations[0].content, "Revision");
  assert.deepEqual([...saved.annotations[0].anchor.anchor.path], [0, 0]);
  assert.equal(saved.annotations[0].x, undefined);
  assert.equal(saved.annotations[0].y, undefined);
  assert.equal(saved.description[0].children[0].italic, true);
  const restored = new Chapter(JSON.parse(JSON.stringify(saved)));
  await restored.validate();
  assert.equal(restored.annotations[0].anchor.focus.offset, 4);
});
test("schema accepts old chapters and unattached notes without migration", async () => {
  const old = fixture();
  delete old.annotations;
  const doc = new Chapter(old);
  await doc.validate();
  assert.equal(doc.annotations, undefined);
  const detached = fixture();
  detached.annotations[0].anchor = null;
  const note = new Chapter(detached);
  await note.validate();
  assert.equal(note.annotations[0].anchor, null);
});
test("schema rejects invalid anchor offsets and paths", async () => {
  const input = fixture();
  input.annotations[0].anchor.anchor.offset = -1;
  await assert.rejects(new Chapter(input).validate());
  input.annotations[0].anchor.anchor.offset = 0;
  input.annotations[0].anchor.focus.path = [0, -1];
  await assert.rejects(new Chapter(input).validate());
});
