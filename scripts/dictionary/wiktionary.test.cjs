const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { gzipSync } = require("node:zlib");
const { createCompiler } = require("./wiktionary.cjs");
const { build } = require("../build-wiktionary-dictionary.cjs");
const english = fields => ({ word: "bank", lang_code: "en", pos: "noun", ...fields });
const translation = (word, sense) => ({ code: "he", word, sense });

test("keeps actual English-to-Hebrew meanings grouped by translation sense", () => {
  const compiler = createCompiler();
  compiler.consume(english({
    senses: [{ glosses: ["financial institution"], examples: [{ type: "example", text: "A bank opened nearby." }] },
      { glosses: ["land beside a river"], examples: [{ type: "example", text: "We sat on the bank." }] }],
    translations: [translation("בנק", "financial institution"), translation("גדה", "river edge"),
      { code: "es", word: "banco", sense: "financial institution" }],
  }));
  const senses = compiler.finish().entries.bank;
  assert.equal(senses.length, 2);
  assert.deepEqual(senses[0].meanings, ["בנק"]);
  assert.deepEqual(senses[0].examples, ["A bank opened nearby."]);
  assert.equal(senses[1].definition, "river edge");
  assert.deepEqual(senses[1].examples, []); // no guessed gloss/example association
  assert.equal(senses[0].sourceUrl, "https://en.wiktionary.org/wiki/bank#English");
});
test("does not turn English definitions or Hebrew headwords into translations", () => {
  const compiler = createCompiler();
  compiler.consume(english({ senses: [{ glosses: ["a bank"] }] }));
  compiler.consume({ word: "בנק", lang_code: "he", pos: "noun", senses: [{ glosses: ["bank"] }] });
  compiler.consume(english({ translations: [{ code: "he", word: "bank" }] }));
  assert.equal(compiler.finish().counts.headwords, 0);
});
test("keeps explicit sense examples, labels and stable IDs, excluding quotations", () => {
  const compiler = createCompiler();
  const record = english({ senses: [{ glosses: ["financial institution"], tags: ["archaic"],
    translations: [translation("בנק")], examples: [{ type: "example", text: "A bank." },
      { type: "quotation", text: "An attributed quotation.", ref: "Some author" }] }] });
  compiler.consume(record); compiler.consume(record);
  const senses = compiler.finish().entries.bank;
  assert.equal(senses.length, 1);
  assert.deepEqual(senses[0].examples, ["A bank."]);
  assert.deepEqual(senses[0].labels, ["archaic"]);
  assert.match(senses[0].id, /^wikt-[a-f0-9]{20}$/);
});
test("resolves attested forms and chains without guessing suffixes or crossing parts of speech", () => {
  const compiler = createCompiler();
  compiler.consume(english({ translations: [translation("בנק", "financial institution")],
    forms: [{ form: "banks", tags: ["plural"] }] }));
  compiler.consume(english({ word: "bankes", senses: [{ form_of: [{ word: "banks" }] }] }));
  compiler.consume(english({ pos: "verb", forms: [{ form: "banking", tags: ["present"] }] }));
  compiler.consume(english({ word: "loop", senses: [{ form_of: [{ word: "cycle" }] }] }));
  compiler.consume(english({ word: "cycle", senses: [{ form_of: [{ word: "loop" }] }] }));
  const { forms } = compiler.finish();
  assert.deepEqual(forms.banks, ["bank"]);
  assert.deepEqual(forms.bankes, ["bank"]);
  assert.equal(forms.banking, undefined);
  assert.equal(forms.loop, undefined);
  assert.equal(forms.bankish, undefined);
});
test("indexes forms for WordNet-only headwords with the matching part of speech", () => {
  const compiler = createCompiler();
  compiler.consume(english({ word: "widget", forms: [{ form: "widgets", tags: ["plural"] }] }));
  const data = compiler.finish({ widget: [{ partOfSpeech: "n" }] });
  assert.deepEqual(data.forms.widgets, ["widget"]);
});
test("handles dictionary words that overlap JavaScript prototype property names safely", () => {
  const compiler = createCompiler();
  compiler.consume(english({ word: "constructor", translations: [translation("בנאי", "builder")] }));
  const data = compiler.finish();
  assert.equal(data.entries.constructor[0].meanings[0], "בנאי");
  assert.equal(Object.hasOwn(data.entries, "toString"), false);
});
test("streams JSONL/gzip, records checksums, repairs literal newlines and rejects truncated input", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "roza-wiktionary-"));
  try {
    fs.writeFileSync(path.join(directory, "english-hebrew.json"), JSON.stringify({ entries: {}, forms: {} }));
    const input = path.join(directory, "fixture.jsonl.gz");
    const record = english({ translations: [translation("בנק", "a\nbank")] });
    fs.writeFileSync(input, gzipSync(JSON.stringify(record).replace("\\n", "\n") + "\n"));
    await build(input, "2026-10-01", directory);
    const output = fs.readFileSync(path.join(directory, "wiktionary-en-he.json"), "utf8");
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, "wiktionary-manifest.json")));
    assert.equal(manifest.repairedRecords, 1);
    assert.match(manifest.inputSha256, /^[a-f0-9]{64}$/);
    assert.equal(JSON.parse(output).entries.bank[0].definition, "a\nbank");
    fs.writeFileSync(input, gzipSync('{"word":"truncated'));
    await assert.rejects(build(input, "2026-10-01", directory), /Truncated/);
    assert.equal(fs.readFileSync(path.join(directory, "wiktionary-en-he.json"), "utf8"), output);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
