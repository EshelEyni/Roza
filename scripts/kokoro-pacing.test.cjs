// Kokoro paragraph narration pacing (Ticket #64): passages, pauses, headings and scene breaks.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");

const pacing = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../frontend/src/services/narration/kokoroPacing.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: pacing });
const { sectionPassages, sectionPacing, kokoroSectionRequests } = pacing;

const sentence = (text, paragraph, extra = {}) => ({ text, paragraph, words: text.split(" ").map(word => ({ text: word })), ...extra });

const chapter = [
  sentence("Chapter One", 0, { heading: true }),
  sentence("The lighthouse was dark.", 1),
  sentence("She climbed it anyway.", 1),
  sentence("Was anyone there?", 1),
  sentence("“You're up here again.”", 2),
  sentence("“Somebody has to watch.”", 3),
  sentence("* * *", 4),
  sentence("The boat came in.", 5),
  sentence("Nobody saw it.", 6, { sceneBreakBefore: true }),
  sentence("The end.", 7),
];

test("a passage is one paragraph; headings and scene marks stand alone", () => {
  assert.deepEqual(Array.from(sectionPassages(chapter)), [0, 1, 1, 1, 2, 3, 4, 5, 6, 7]);
});

test("a very long paragraph is split into passages at sentence boundaries", () => {
  const long = Array.from({ length: 30 }, (_, index) => sentence(Array(20).fill("word").join(" ") + ".", 0, { index }));
  const passages = Array.from(sectionPassages(long));
  assert.equal(passages[0], 0);
  assert.ok(passages.at(-1) >= 2, "600 words become at least three passages");
  for (let index = 1; index < passages.length; index++) assert.ok(passages[index] - passages[index - 1] <= 1);
});

test("pauses: none inside a passage, longer after paragraphs, headings and scene breaks", () => {
  const pauses = sectionPacing(chapter, sectionPassages(chapter)).map(item => item.pause);
  assert.deepEqual(pauses, [1.6, 0, 0, 1.15, 1.0, 1.15, 2.6, 2.6, 1.15, 2.5]);
});

test("without passages (an older desktop app) every sentence still gets its pause", () => {
  const pauses = sectionPacing(chapter).map(item => item.pause);
  assert.deepEqual(pauses, [1.6, 0.5, 0.5, 1.15, 1.0, 1.15, 2.6, 2.6, 1.15, 2.5]);
  assert.equal(sectionPacing([sentence("Who?", 0), sentence("Me.", 0)])[0].pause, 0.6, "a question gets a little longer");
});

test("requests carry the passage only when the desktop app speaks passages", () => {
  const withPassages = kokoroSectionRequests(chapter, true);
  assert.deepEqual({ ...withPassages[2] }, { text: "She climbed it anyway.", words: ["She", "climbed", "it", "anyway."], pause: 0, speed: 1, passage: 1 });
  const legacy = kokoroSectionRequests(chapter, false);
  assert.equal("passage" in legacy[2], false);
  assert.equal(legacy[2].pause, 0.5);
});
