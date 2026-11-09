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
      },
    }).outputText,
    file,
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
  transformAnnotations,
  validAnchor,
  layoutAnnotations,
} = require("../frontend/src/components/WritingStudio/annotations.ts");
function setup() {
  const editor = withHistory(createEditor());
  editor.children = [
    "First paragraph",
    "Anchored paragraph",
    "Last paragraph",
  ].map((text) => ({ type: "paragraph", children: [{ text }] }));
  let notes = [
    {
      id: "note",
      content: "Keep this",
      quote: "Anchored paragraph",
      anchor: Editor.range(editor, [1]),
    },
  ];
  const apply = editor.apply;
  editor.apply = (operation) => {
    notes = transformAnnotations(notes, operation);
    apply(operation);
  };
  return { editor, notes: () => notes };
}
test("anchors follow insertions, splits, merges and undo before their text", () => {
  const { editor, notes } = setup();
  Transforms.insertNodes(
    editor,
    { type: "paragraph", children: [{ text: "New opening" }] },
    { at: [0] },
  );
  assert.deepEqual(notes()[0].anchor.anchor.path, [2, 0]);
  Transforms.splitNodes(editor, { at: { path: [1, 0], offset: 5 } });
  assert.deepEqual(notes()[0].anchor.anchor.path, [3, 0]);
  Transforms.mergeNodes(editor, { at: [2] });
  assert.deepEqual(notes()[0].anchor.anchor.path, [2, 0]);
  assert.equal(Editor.string(editor, notes()[0].anchor), "Anchored paragraph");
  HistoryEditor.undo(editor);
  assert.equal(Editor.string(editor, notes()[0].anchor), "Anchored paragraph");
});
test("splitting and merging the annotated paragraph preserves the range", () => {
  const { editor, notes } = setup();
  Transforms.splitNodes(editor, { at: { path: [1, 0], offset: 8 } });
  assert.deepEqual(notes()[0].anchor.focus.path, [2, 0]);
  Transforms.mergeNodes(editor, { at: [2] });
  assert.equal(Editor.string(editor, notes()[0].anchor), "Anchored paragraph");
});
test("deleted text becomes unattached without losing note content", () => {
  const { editor, notes } = setup();
  Transforms.delete(editor, { at: notes()[0].anchor });
  assert.equal(notes()[0].anchor, null);
  assert.equal(notes()[0].content, "Keep this");
  Transforms.insertText(editor, "Replacement", {
    at: { path: [1, 0], offset: 0 },
  });
  assert.equal(notes()[0].anchor, null);
});
test("removed blocks and invalid loaded ranges do not attach to neighboring text", () => {
  const { editor, notes } = setup();
  Transforms.removeNodes(editor, { at: [1] });
  assert.equal(notes()[0].anchor, null);
  assert.equal(
    validAnchor(editor, {
      anchor: { path: [99, 0], offset: 0 },
      focus: { path: [99, 0], offset: 2 },
    }),
    false,
  );
});
test("crowded margin cards never overlap, including a measured expanded card", () => {
  const positions = Array.from({ length: 500 }, (_, i) => ({
    id: String(i),
    top: i * 2,
  }));
  const result = layoutAnnotations(positions, "10", 277);
  for (let i = 1; i < result.length; i++)
    assert.ok(
      result[i].top >=
        result[i - 1].top + (result[i - 1].id === "10" ? 277 : 44) + 8,
    );
});
test("empty paragraph anchors survive typing and saved ranges survive reload", () => {
  const { editor } = setup();
  editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
  let notes = [
    {
      id: "empty",
      content: "Opening",
      quote: "",
      anchor: Editor.range(editor, [0]),
    },
  ];
  const apply = editor.apply;
  editor.apply = (op) => {
    notes = transformAnnotations(notes, op);
    apply(op);
  };
  Transforms.insertText(editor, "Opening words", {
    at: { path: [0, 0], offset: 0 },
  });
  const restored = JSON.parse(JSON.stringify(notes));
  assert.ok(validAnchor(editor, restored[0].anchor));
  assert.equal("x" in restored[0], false);
});

test('Enter on an empty final annotated paragraph keeps its anchor on the original paragraph', () => {
 const editor=createEditor();
 editor.children=[{type:'paragraph',children:[{text:'Earlier text'}]},{type:'paragraph',children:[{text:''}]}];
 let notes=[{id:'last',content:'Stay here',quote:'',anchor:Editor.range(editor,[1])}];
 const apply=editor.apply; editor.apply=op=>{notes=transformAnnotations(notes,op);apply(op)};
 Transforms.splitNodes(editor,{at:{path:[1,0],offset:0},always:true});
 assert.deepEqual(notes[0].anchor.anchor.path,[1,0]);
 assert.deepEqual(notes[0].anchor.focus.path,[1,0]);
});
