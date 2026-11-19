const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Ticket #44: shared/types must only be imported as types by the CommonJS backend.
test("book documents load with the backend ts-node development runner", () => {
  const backend = path.resolve(__dirname, "../backend");
  const result = spawnSync(process.execPath, [
    path.join(backend, "node_modules/ts-node/dist/bin.js"),
    "--transpile-only", "-e",
    "require('./src/controllers/reader/readerDocumentController'); require('./src/services/reader/readerBookManagementService'); require('./src/routers/reader/readerRouter')",
  ], { cwd: backend, encoding: "utf8", timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
