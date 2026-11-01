const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
function setup(colors) {
  const timers = new Map();
  let sequence = 0;
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/src/services/readerPassageMarker.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'setTimeout', 'clearTimeout', source)(exports,
    (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    id => timers.delete(id));
  const added = [], removed = [];
  let rendition = { annotations: {
    highlight: (...args) => added.push(args), remove: (...args) => removed.push(args),
  } };
  return { createMarker: () => new exports.ReaderPassageMarker(() => rendition), marker: new exports.ReaderPassageMarker(() => rendition, color => colors?.[color]), timers, added, removed,
    replace: () => { rendition = { annotations: { highlight: () => {}, remove: () => {} } }; } };
}
const passage = { cfi: 'exact-word-range', text: 'countenanced' };
const range = async p => [p.cfi];
test('translation dismissal marks the exact word pastel blue and expires after two seconds', async () => {
  const host = setup();
  await host.marker.show(passage, 'blue', range);
  assert.equal(host.added[0][0], passage.cfi);
  assert.equal(host.added[0][4].fill, '#a3c2ff');
  assert.equal(host.added[0][4]['fill-opacity'], '0.4');
  assert.equal(host.added[0][4]['pointer-events'], 'none');
  const timer = [...host.timers.values()][0];
  assert.equal(timer.delay, 2000);
  timer.callback();
  assert.deepEqual(host.removed, [[passage.cfi, 'highlight']]);
});
test('a clicked chat passage cancels translation expiry and stays until cleared', async () => {
  const host = setup();
  await host.marker.show(passage, 'blue', range);
  await host.marker.show({ cfi: 'quote', text: 'passage' }, 'yellow', range);
  assert.equal(host.timers.size, 0);
  assert.equal(host.added[1][4].fill, '#f2e66b');
  assert.deepEqual(host.removed, [[passage.cfi, 'highlight']]);
  host.marker.clear();
  assert.deepEqual(host.removed, [[passage.cfi, 'highlight'], ['quote', 'highlight']]);
});

test('multi-section quotes mark every resolved range and clear all owned marks', async () => {
  const host = setup();
  await host.marker.show({ ...passage, endCfi: 'end' }, 'yellow', async () => ['first-section', 'last-section']);
  assert.deepEqual(host.added.map(args => args[0]), ['first-section', 'last-section']);
  host.marker.clear();
  assert.deepEqual(host.removed, [['first-section', 'highlight'], ['last-section', 'highlight']]);
});
test('a slow quote resolution cannot replace a more recently selected passage', async () => {
  const host = setup();
  let resolve;
  const pending = host.marker.show(passage, 'blue', () => new Promise(done => { resolve = done; }));
  await host.marker.show({ cfi: 'new', text: 'new' }, 'yellow', range);
  resolve(['old']);
  await pending;
  assert.deepEqual(host.added.map(args => args[0]), ['new']);
});
test('reader teardown cancels pending ranges and never removes marks from a replacement rendition', async () => {
  const host = setup();
  await host.marker.show(passage, 'blue', range);
  host.replace();
  host.marker.clear();
  assert.equal(host.timers.size, 0);
  assert.deepEqual(host.removed, []);
});

test('configured passage and translation colors are applied', async () => {
  const host = setup({ blue: '#112233', yellow: '#aabbcc' });
  await host.marker.show(passage, 'blue', range);
  await host.marker.show(passage, 'yellow', range);
  assert.deepEqual(host.added.map(args => args[4].fill), ['#112233', '#aabbcc']);
});

test('closing a tab cancels its unresolved passage highlight', async () => {
  const host = setup();
  let resolve;
  const pending = host.marker.show(passage, 'yellow', () => new Promise(done => { resolve = done; }));
  host.marker.clear();
  resolve(['closed-tab-passage']);
  await pending;
  assert.deepEqual(host.added, []);
  assert.equal(host.timers.size, 0);
});

test('two owners of one range replace the SVG and restore the remaining owner', async () => {
  const host = setup();
  const translated = host.createMarker();
  await host.marker.show(passage, 'yellow', range);
  await translated.show(passage, 'blue', range);
  assert.deepEqual(host.removed, [[passage.cfi, 'highlight']]);
  translated.clear();
  assert.equal(host.added.at(-1)[3], 'reader-locator-yellow');
  host.marker.clear();
  assert.equal(host.removed.length, 3);
});

test('closing an obscured owner never removes the visible mark or resurrects it later', async () => {
  const host = setup();
  const foreground = host.createMarker();
  await host.marker.show(passage, 'yellow', range);
  await foreground.show(passage, 'yellow', range);
  host.marker.clear();
  assert.equal(host.removed.length, 1);
  foreground.clear();
  assert.equal(host.removed.length, 2);
  assert.equal(host.added.length, 2);
});
