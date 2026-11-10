const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022, esModuleInterop: true,
      },
    }).outputText,
    file,
  );
const {
  createEditor,
  Transforms,
  Node,
} = require("../frontend/node_modules/slate");
const {
  withHistory,
  HistoryEditor,
} = require("../frontend/node_modules/slate-history");
const {
  withScreenplay,
  fountain,
  nextElement,
  validateScreenplayEdit,
} = require("../frontend/src/components/WritingStudio/screenplay.ts");
const {
  manuscriptHtml,
} = require("../frontend/src/components/WritingStudio/manuscript.ts");
const block = (type, text) => ({ type, children: [{ text }] });
test("Enter creates semantic dialogue and undo restores cue without losing text", () => {
  const e = withScreenplay(withHistory(createEditor()));
  e.children = [block("character", "MARA")];
  Transforms.select(e, { path: [0, 0], offset: 4 });
  e.insertBreak();
  assert.equal(e.children[1].type, "dialogue");
  e.insertText("Hello.");
  assert.equal(Node.string(e.children[1]), "Hello.");
  HistoryEditor.undo(e);
  assert.equal(Node.string(e.children[0]), "MARA");
  HistoryEditor.redo(e);
  assert.equal(e.children[1].type, "dialogue");
});
test("scene detection and uppercase cues use stored semantics without indentation spaces", () => {
  const e = withScreenplay(createEditor());
  e.children = [block("paragraph", "")];
  Transforms.select(e, { path: [0, 0], offset: 0 });
  e.insertText("INT. ROOM - DAY");
  assert.equal(e.children[0].type, "scene_heading");
  e.insertBreak();
  assert.equal(e.children[1].type, "action");
  assert.equal(nextElement("parenthetical"), "dialogue");
  assert.equal(nextElement("transition"), "scene_heading");
});
test("Fountain forces semantic elements and HTML escapes manuscript content", () => {
  const nodes = [
    block("scene_heading", "INT. ROOM - DAY"),
    block("action", "<door>"),
    block("character", "MARA"),
    block("parenthetical", "quietly"),
    block("dialogue", "Hello."),
    block("transition", "CUT TO:"),
  ];
  const f = fountain(nodes);
  assert.ok(f.includes("@MARA\n(quietly)\nHello."));
  assert.ok(f.includes(">CUT TO:"));
  const html = manuscriptHtml({
    name: "Script",
    chapters: [{ name: "One", format: "screenplay", text: nodes }],
  });
  assert.ok(html.includes("sp-character"));
  assert.ok(html.includes("&lt;door&gt;"));
  assert.equal(validateScreenplayEdit(nodes, nodes), true);
  assert.equal(validateScreenplayEdit(nodes, nodes.slice(1)), false);
});

test("paste parses scenes, cues, parentheticals and dialogue without changing words", () => {
  const {
    parseScreenplay,
  } = require("../frontend/src/components/WritingStudio/screenplay.ts");
  const result = parseScreenplay(
    "INT. ROOM - DAY\n\nMARA\n(quietly)\nHello.\n\nThe door opens.",
  );
  assert.deepEqual(
    result.map((b) => b.type),
    ["scene_heading", "character", "parenthetical", "dialogue", "action"],
  );
  assert.equal(
    result.map(Node.string).join("|"),
    "INT. ROOM - DAY|MARA|(quietly)|Hello.|The door opens.",
  );
});
test("schema defaults old chapters to prose and round-trips screenplay alongside annotations", async () => {
  const mongoose = require("../backend/node_modules/mongoose");
  const {
    chapterSchema,
  } = require("../backend/src/models/books/schemas/chapterScehma.ts");
  const Chapter = mongoose.model("ScreenplaySchemaTest", chapterSchema);
  const original = {
    bookId: "222222222222222222222222",
    text: [block("character", "MARA"), block("dialogue", "Hello.")],
    annotations: [
      { id: "note", content: "Keep voice", quote: "Hello.", anchor: null },
    ],
  };
  assert.equal(new Chapter(original).format, "prose");
  const doc = new Chapter({ ...original, format: "screenplay" });
  await doc.validate();
  const restored = new Chapter(JSON.parse(JSON.stringify(doc)));
  await restored.validate();
  assert.equal(restored.format, "screenplay");
  assert.equal(restored.text[1].type, "dialogue");
  assert.equal(restored.annotations[0].content, "Keep voice");
  await assert.rejects(
    new Chapter({ ...original, format: "invalid" }).validate(),
  );
});


test('PDF uses Letter pages, Courier 12pt and paginates long scripts',()=>{
 const {createScreenplayPdf}=require('../frontend/src/components/WritingStudio/screenplayPdf.ts');
 const pdf=createScreenplayPdf({name:'Script',chapters:[{format:'screenplay',text:[block('scene_heading','INT. ROOM - DAY'),...Array.from({length:100},()=>block('dialogue','A line of dialogue.'))]}]});
 assert.equal(pdf.internal.pageSize.getWidth(),612);assert.equal(pdf.internal.pageSize.getHeight(),792);
 assert.equal(pdf.getFont().fontName,'courier');assert.equal(pdf.getFontSize(),12);assert.ok(pdf.getNumberOfPages()>1);assert.ok(pdf.output().startsWith('%PDF-'));
});
