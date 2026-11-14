const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const code = ts.transpileModule(
  fs.readFileSync(
    require("node:path").join(
      __dirname,
      "../frontend/src/services/readerSentenceSpans.ts",
    ),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
function spans(text, language = "en", intl = Intl) {
  const exports = {};
  vm.runInNewContext(code, { exports, Intl: intl });
  return Array.from(exports.readerSentenceSpans(text, language), (span) =>
    text.slice(span.start, span.end),
  );
}
test("sentences preserve closing punctuation, whitespace offsets, and paragraph boundaries", () => {
  const text =
    "  First sentence.  “Second sentence?”\u2029A heading\u2029Last one!  ";
  assert.deepEqual(spans(text), [
    "First sentence.",
    "“Second sentence?”",
    "A heading",
    "Last one!",
  ]);
});
test("Hebrew sentences and invalid locale fallback preserve all text", () => {
  assert.deepEqual(spans("משפט ראשון. משפט שני!", "he"), [
    "משפט ראשון.",
    "משפט שני!",
  ]);
  assert.deepEqual(spans("First. Second!", "bad_locale"), [
    "First.",
    "Second!",
  ]);
});
test("older engines still split punctuation and paragraph boundaries", () => {
  assert.deepEqual(
    spans("First. Second!\u2029Third without punctuation", "en", {}),
    ["First.", "Second!", "Third without punctuation"],
  );
  assert.deepEqual(spans(" \u2029\n "), []);
});

test("honorifics, decimal numbers, quotations and paragraph ends keep their boundaries", () => {
  assert.deepEqual(spans('Dr. Smith paid 3.14 dollars. “Really?”\u2029Mr.\u2029Jones left.'), [
    'Dr. Smith paid 3.14 dollars.', '“Really?”', 'Mr.', 'Jones left.',
  ]);
});
