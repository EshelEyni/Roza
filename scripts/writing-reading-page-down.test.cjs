const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../frontend/src/components/WritingStudio/readingPageDown.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const loaded = {};
new Function("exports", source)(loaded);
const { readingPageDownDelta, pageStepFraction } = loaded;

const view = { top: 100, bottom: 900 };
const line = (top, height = 30) => ({ top, bottom: top + height });

test("a full page step that fits before the limit scrolls normally", () => {
  assert.equal(readingPageDownDelta([line(850)], view), 800 * pageStepFraction);
});

test("a step that would overshoot stops with the whole sentence visible", () => {
  assert.equal(readingPageDownDelta([line(400), line(430)], view), 300);
});

test("a selected sentence at the limit keeps the current position", () => {
  assert.equal(readingPageDownDelta([line(100), line(130)], view), 0);
});

test("a wrapped sentence that fits keeps its first line at the top edge", () => {
  const rects = [line(250), line(280), line(310), { top: 340, bottom: 360 }];
  assert.equal(readingPageDownDelta(rects, view), 150);
});

test("an oversized sentence pages through until its last line reaches the top", () => {
  const tall = Array.from({ length: 40 }, (_, i) => line(150 + i * 30));
  assert.equal(readingPageDownDelta(tall, view), 700);
  const nearEnd = Array.from({ length: 40 }, (_, i) => line(-500 + i * 30));
  assert.equal(readingPageDownDelta(nearEnd, view), 570);
});

test("an already clipped sentence stays at least partially readable", () => {
  assert.equal(readingPageDownDelta([line(80), line(110), line(140)], view), 40);
  assert.equal(readingPageDownDelta([line(60), line(90)], view), 0);
});

test("the last line uses its tallest fragment so mixed inline heights stay visible", () => {
  assert.equal(readingPageDownDelta([line(90), { top: 126, bottom: 144 }, line(120)], view), 20);
});

test("offscreen selections leave native paging in charge", () => {
  assert.equal(readingPageDownDelta([line(40)], view), undefined);
  assert.equal(readingPageDownDelta([line(900)], view), undefined);
  assert.equal(readingPageDownDelta([], view), undefined);
  assert.equal(readingPageDownDelta([{ top: 300, bottom: 300 }], view), undefined);
});

test("a sticky cover reduces the visible area and the limit", () => {
  const covered = { top: 160, bottom: 900 };
  assert.equal(readingPageDownDelta([line(400)], covered), 240);
  assert.equal(readingPageDownDelta([line(140, 40)], covered), 0);
  assert.equal(readingPageDownDelta([line(120)], covered), undefined);
});
