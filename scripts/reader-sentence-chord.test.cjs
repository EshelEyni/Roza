const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");
const source = ts.transpileModule(
  fs.readFileSync(
    path.join(__dirname, "../frontend/src/services/readerSentenceChord.ts"),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
function setup() {
  const exports = {};
  new Function("exports", source)(exports);
  const result = { entered: 0, saved: 0, enabled: true };
  const chord = exports.createReaderSentenceChord({
    enabled: () => result.enabled,
    enter: () => result.entered++,
    save: () => result.saved++,
  });
  const event = (key, extra = {}) => ({
    key,
    code: key.length === 1 ? "Key" + key.toUpperCase() : key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    isComposing: false,
    repeat: false,
    target: { closest: () => false },
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...extra,
  });
  return { result, chord, event };
}
for (const modifier of ["Control", "Meta"]) {
  const held = modifier === "Control" ? { ctrlKey: true } : { metaKey: true };
  test(
    modifier + "+S,M enters once without flagging, even when S is released",
    () => {
      const { result, chord, event } = setup();
      const prefix = event("s", held);
      assert.equal(chord.keydown(prefix), true);
      assert.equal(prefix.defaultPrevented, true);
      chord.keyup(event("s", held));
      assert.equal(result.saved, 0);
      assert.equal(chord.keydown(event("m", held)), true);
      chord.keyup(event(modifier));
      assert.equal(result.entered, 1);
      assert.equal(result.saved, 0);
    },
  );
  test(modifier + "+S alone saves once on modifier release", () => {
    const { result, chord, event } = setup();
    chord.keydown(event("s", held));
    chord.keydown(event("s", { ...held, repeat: true }));
    assert.equal(result.saved, 0);
    chord.keyup(event("s", held));
    chord.keyup(event(modifier));
    chord.keyup(event(modifier));
    assert.equal(result.saved, 1);
    assert.equal(result.entered, 0);
  });
}
test("editable controls, composition and unrelated modifiers never reserve a chord", () => {
  for (const extra of [
    { target: { closest: () => true } },
    { isComposing: true },
    { altKey: true },
    { shiftKey: true },
    { defaultPrevented: true },
  ]) {
    const { result, chord, event } = setup();
    assert.equal(chord.keydown(event("s", { ctrlKey: true, ...extra })), false);
    chord.keyup(event("Control"));
    assert.equal(result.saved, 0);
  }
});
test("blur/reset, disabled reader and unrelated keys cancel pending chords", () => {
  const { result, chord, event } = setup();
  chord.keydown(event("s", { ctrlKey: true }));
  chord.reset();
  chord.keyup(event("Control"));
  assert.equal(result.saved, 0);
  result.enabled = false;
  assert.equal(chord.keydown(event("s", { ctrlKey: true })), false);
  result.enabled = true;
  chord.keydown(event("s", { ctrlKey: true }));
  chord.keydown(event("x", { ctrlKey: true }));
  chord.keyup(event("Control"));
  assert.equal(result.saved, 0);
});
