const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/components/Reader/ReaderDictionary.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
function position(bounds, viewport, mobile = true) {
  const effects = [], states = [], refs = [], listeners = {};
  const react = {
    useState: value => { const index = states.length; states.push(value); return [value, next => states[index] = next]; },
    useRef: value => { const ref = { current: value }; refs.push(ref); return ref; },
    useCallback: fn => fn, useEffect: fn => effects.push(fn),
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
  const exports = {};
  const window = { visualViewport: { ...viewport, addEventListener: (name, fn) => listeners[name] = fn, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} };
  const document = { addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(source, { exports, React: react, window, document,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {},
    require: name => {
      if (name === 'react') return react;
      if (name === 'react-i18next') return { useTranslation: () => ({ t: x => x }) };
      if (name.endsWith('useReaderMobile')) return { useReaderMobile: () => mobile };
      if (name === 'react-icons/fi' || name.endsWith('ReaderSheet') || name.endsWith('readerApiService') || name.endsWith('createRequestId')) return {};
      throw Error(name);
    },
  });
  const tree = exports.ReaderDictionary({ selection: { text: 'word', word: 'word', x: bounds.left, y: bounds.bottom + 8, getBounds: () => bounds }, onClose() {} });
  tree.props.ref.current = { scrollHeight: 58 };
  const cleanups = effects.map(fn => fn());
  return { value: () => states.at(-1), viewport: window.visualViewport, listeners, tree, cleanups };
}
const portrait = { offsetLeft: 0, offsetTop: 0, width: 390, height: 664 };
test('word and paragraph ranges prefer below, leaving handle clearance', () => {
  for (const bounds of [{ left: 20, top: 50, bottom: 72 }, { left: 18, top: 90, bottom: 440 }]) {
    const p = position(bounds, portrait).value();
    assert.equal(p.top, bounds.bottom + 28);
    assert.ok(p.left >= 12 && p.left + p.width <= 378);
    assert.equal(p.visibility, 'visible');
  }
});
test('bottom selection flips above with native menu clearance', () => {
  const p = position({ left: 360, top: 610, bottom: 636 }, portrait).value();
  assert.ok(p.top + 60 <= 610 - 80);
  assert.equal(p.left + p.width, 378);
});
test('visual viewport resizing and panning recomputes bounds', () => {
  const fixture = position({ left: 500, top: 130, bottom: 160 }, portrait);
  Object.assign(fixture.viewport, { width: 320, height: 300, offsetTop: 40, offsetLeft: 20 });
  fixture.listeners.resize();
  const p = fixture.value();
  assert.ok(p.left >= 32 && p.left + p.width <= 328);
  assert.ok(p.top >= 52 && p.top + 60 <= 328);
  fixture.cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
});
test('full viewport paragraph never gets covered by the floating toolbar', () => {
  assert.equal(position({ left: 12, top: 0, bottom: 664 }, portrait).value().visibility, 'hidden');
});
test('desktop retains existing CSS positioning', () => {
  const fixture = position({ left: 20, top: 50, bottom: 72 }, portrait, false);
  assert.equal(fixture.value(), undefined);
  assert.match(fixture.tree.props.style.top, /^clamp/);
});

