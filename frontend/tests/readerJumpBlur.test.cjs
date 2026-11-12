const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, globals) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, ...globals });
  return exports;
}
const history = load('services/readerJumpHistory.ts', {});
for (const leave of ['focusin', 'pointerdown', 'blur', 'visibilitychange']) test(`Go Back survives internal focus and dismisses on ${leave}`, async () => {
  const slots = []; let cursor = 0;
  const documentEvents = {}, windowEvents = {};
  let focused = true;
  class Node {}
  const inside = new Node(), outside = new Node();
  const document = { hidden: false, hasFocus: () => focused, addEventListener: (key, fn) => { documentEvents[key] = fn; }, removeEventListener() {} };
  const window = { addEventListener: (key, fn) => { windowEvents[key] = fn; }, removeEventListener() {} };
  const react = {
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect: fn => { fn(); }, useCallback: fn => fn,
  };
  const { useReaderJumpHistory } = load('hooks/reader/useReaderJumpHistory.ts', {
    require: name => name === 'react' ? react : history, Node, document, window,
    setTimeout: () => { throw Error('Go Back must not schedule automatic dismissal'); },
  });
  const runtime = { linkObserver: {}, shell: { current: { contains: node => node === inside } } };
  const render = cfi => { cursor = 0; return useReaderJumpHistory(runtime, { start: { cfi } }, async value => ({ page: +value, label: value }), async () => {}, () => {}); };
  render('1'); await new Promise(resolve => setImmediate(resolve));
  render('20'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(render('20').returnPoint.cfi, '1');
  documentEvents.focusin({ target: inside });
  documentEvents.pointerdown({ target: inside });
  windowEvents.blur(); // EPUB iframe focus keeps document focus.
  assert.equal(render('20').returnPoint.cfi, '1');
  if (leave === 'blur') { focused = false; windowEvents.blur(); }
  else if (leave === 'visibilitychange') { document.hidden = true; documentEvents.visibilitychange(); }
  else documentEvents[leave]({ target: outside });
  assert.equal(render('20').returnPoint, null);
});
