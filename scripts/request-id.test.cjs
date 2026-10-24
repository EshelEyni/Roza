const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const ts = require("../frontend/node_modules/typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../frontend/src/services/createRequestId.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load(crypto) {
  const context = { exports: {}, crypto };
  vm.runInNewContext(code, context);
  return context.exports.createRequestId;
}
test("uses native randomUUID when available", () => {
  const generate = load({ randomUUID: () => "native-uuid" });
  assert.equal(generate(), "native-uuid");
});
test("HTTP fallback produces distinct RFC UUID v4 IDs without randomUUID", () => {
  const generate = load({ getRandomValues: bytes => webcrypto.getRandomValues(bytes) });
  const ids = Array.from({length: 100}, () => generate());
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(ids).size, ids.length);
});