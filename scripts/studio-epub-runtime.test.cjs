const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("Studio EPUB publishing loads with the backend ts-node development runner", () => {
  const backend = path.resolve(__dirname, "../backend");
  const result = spawnSync(process.execPath, [
    path.join(backend, "node_modules/ts-node/dist/bin.js"),
    "--transpile-only", "-e",
    "require('./src/services/reader/studioEpubService'); require('./src/controllers/reader/studioPublicationController'); require('./src/routers/reader/readerRouter')",
  ], { cwd: backend, encoding: "utf8", timeout: 60000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
