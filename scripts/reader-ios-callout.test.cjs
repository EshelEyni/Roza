const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../frontend/src/services', name + '.ts'), 'utf8');
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => load(name.replace('./', '')), exports);
  return exports;
}
const { bindReaderContents } = load('bindReaderContents');
for (const [agent, mobile, expected] of [['iPhone', true, true], ['iPhone', false, false], ['Android', true, false], ['Macintosh', false, false]]) {
  test(`multiword callout override: ${agent}, mobile=${mobile}`, () => {
    const doc = new EventTarget();
    const attributes = new Set();
    doc.documentElement = {
      toggleAttribute: (key, active) => active ? attributes.add(key) : attributes.delete(key),
      removeAttribute: key => attributes.delete(key),
    };
    doc.defaultView = { navigator: { userAgent: agent }, frameElement: { setAttribute() {} } };
    let text = 'word';
    doc.getSelection = () => ({ toString: () => text });
    let rules;
    const runtime = { host: { current: null }, mobileRef: { current: mobile }, stateRef: { current: { preferences: { flow: 'paginated' } } }, panelRef: { current: null }, selectionRef: { current: null } };
    const cleanup = bindReaderContents({ document: doc, addStylesheetRules: value => rules = value }, runtime,
      { onSelectionChange() {}, closeLookup() {} }, { onKey() {}, enabled: () => true, move() {}, title: 'test' });
    const active = () => attributes.has('data-reader-multiword-callout');
    assert.equal(active(), false);
    for (const passage of ['two words', 'a long\nparagraph with text']) {
      text = passage;
      doc.dispatchEvent(new Event('selectionchange'));
      assert.equal(active(), expected);
    }
    assert.equal(rules['html[data-reader-multiword-callout], html[data-reader-multiword-callout] *']['-webkit-touch-callout'], 'none !important');
    assert.equal(rules['html, body']['user-select'], 'text');
    text = '';
    doc.dispatchEvent(new Event('selectionchange'));
    assert.equal(active(), false);
    text = 'two words';
    doc.dispatchEvent(new Event('selectionchange'));
    cleanup();
    assert.equal(active(), false);
  });
}

