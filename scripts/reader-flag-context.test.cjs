const { test } = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../frontend/src/services/readerFlagContext.ts");
test("short context keeps the flagged word highlighted in a long paragraph", async () => {
  const { readerFlagContext } = await load();
  const result = readerFlagContext(
    "before ".repeat(200) + "bright" + " after".repeat(200),
    "bright",
  );
  assert.equal(result.marked, "bright");
  assert.ok((result.before + result.marked + result.after).length <= 240);
  assert.ok(result.before.startsWith("…"));
  assert.ok(result.after.endsWith("…"));
});
test("context normalizes line breaks and safely handles passages absent from the stored paragraph", async () => {
  const { readerFlagContext } = await load();
  assert.deepEqual(readerFlagContext("A bright\n  morning.", "bright"), {
    before: "A ",
    marked: "bright",
    after: " morning.",
  });
  const result = readerFlagContext(
    "first paragraph",
    "a long selection ".repeat(200),
  );
  assert.equal(result.before, "");
  assert.equal(result.after, "");
  assert.ok(result.marked.length <= 120);
});
