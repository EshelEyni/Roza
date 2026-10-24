const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../frontend/node_modules/typescript");
const { DOMParser, XMLSerializer } = require("../frontend/node_modules/@xmldom/xmldom");
const compiled = ts.transpileModule(fs.readFileSync(require("node:path").join(__dirname, "../frontend/src/services/readerContentSecurity.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
new Function("exports", compiled)(exported);

test("CSP precedes book scripts before serialization, preserving book body and CFI structure", () => {
  const doc = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><head><script>parent.compromised=true</script></head><body><p onclick="alert(1)">Book text</p></body></html>', 'application/xhtml+xml');
  const serializer = new XMLSerializer();
  const before = serializer.serializeToString(doc.getElementsByTagName('body')[0]);
  exported.protectReaderDocument(doc);
  const meta = doc.getElementsByTagName('head')[0].firstChild;
  assert.equal(meta.getAttribute('http-equiv'), 'Content-Security-Policy');
  const policy = meta.getAttribute('content');
  for (const directive of ["script-src 'none'", "object-src 'none'", "frame-src 'none'", "form-action 'none'"]) assert.ok(policy.includes(directive));
  assert.equal(serializer.serializeToString(doc.getElementsByTagName('body')[0]), before);
  const html = serializer.serializeToString(doc);
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'));
});

test("missing head is created and automatic refresh navigation is removed", () => {
  const doc = new DOMParser().parseFromString('<html xmlns="http://www.w3.org/1999/xhtml"><body><meta http-equiv="Refresh" content="0;url=https://example.com"/><p>Text</p></body></html>', 'application/xhtml+xml');
  exported.protectReaderDocument(doc);
  assert.equal(doc.documentElement.firstChild.localName, 'head');
  const metas = Array.from(doc.getElementsByTagName('meta'));
  assert.equal(metas.length, 1);
  assert.equal(metas[0].getAttribute('http-equiv'), 'Content-Security-Policy');
});