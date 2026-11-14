const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/components/Reader/ReaderDictionary.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
function position(bounds, viewport, mobile = true, footerTop, toolbarHeight = 60) {
  const effects = [], states = [], refs = [], listeners = {};
  const react = {
    useState: value => { const index = states.length; states.push(value); return [value, next => states[index] = next]; },
    useRef: value => { const ref = { current: value }; refs.push(ref); return ref; },
    useCallback: fn => fn, useEffect: fn => effects.push(fn),
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
  const exports = {};
  const window = { visualViewport: { ...viewport, addEventListener: (name, fn) => listeners[name] = fn, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} };
  const document = { querySelector: () => footerTop === undefined ? null : { getBoundingClientRect: () => ({ top: footerTop }) }, addEventListener() {}, removeEventListener() {} };
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
  tree.props.ref.current = { scrollHeight: toolbarHeight - 2 };
  const cleanups = effects.map(fn => fn());
  return { value: () => states.at(-1), viewport: window.visualViewport, listeners, tree, cleanups };
}
const portrait = { offsetLeft: 0, offsetTop: 0, width: 390, height: 664 };
test('word and paragraph selections dock at the same bottom position', () => {
  for (const bounds of [{ left: 20, top: 50, bottom: 72 }, { left: 18, top: 90, bottom: 440 }, { left: 12, top: 0, bottom: 664 }]) {
    const fixture = position(bounds, portrait);
    const p = fixture.value();
    assert.equal(p.top + 60, portrait.height - 12);
    assert.equal(p.left, (portrait.width - p.width) / 2);
    assert.equal(p.visibility, 'visible');
    assert.match(fixture.tree.props.className, /reader-selection-docked/);
  }
});
test('visual viewport resize and pan keep the dock on screen', () => {
  const fixture = position({ left: 500, top: 130, bottom: 160 }, portrait);
  for (const viewport of [
    { width: 320, height: 300, offsetTop: 40, offsetLeft: 20 },
    { width: 844, height: 390, offsetTop: 0, offsetLeft: 0 },
  ]) {
    Object.assign(fixture.viewport, viewport);
    fixture.listeners.resize();
    const p = fixture.value();
    assert.ok(p.left >= viewport.offsetLeft + 12);
    assert.ok(p.left + p.width <= viewport.offsetLeft + viewport.width - 12);
    assert.equal(p.top + 60, viewport.offsetTop + viewport.height - 12);
  }
  fixture.cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
});
test('desktop retains existing CSS positioning', () => {
  const fixture = position({ left: 20, top: 50, bottom: 72 }, portrait, false);
  assert.equal(fixture.value(), undefined);
  assert.match(fixture.tree.props.style.top, /^clamp/);
  assert.doesNotMatch(fixture.tree.props.className, /reader-selection-docked/);
});

test('footer edge bounds the dock for top, middle and bottom selections and varying content heights', () => {
  for (const bounds of [{ left: 20, top: 90, bottom: 110 }, { left: 20, top: 280, bottom: 320 }, { left: 20, top: 480, bottom: 530 }]) {
    for (const toolbarHeight of [58, 92, 140]) {
      const p = position(bounds, portrait, true, 650, toolbarHeight).value();
      assert.equal(p.top + toolbarHeight, 646);
      assert.ok(p.top >= 12);
      assert.ok(p.top + toolbarHeight <= portrait.height - 12);
    }
  }
});
test('a reduced viewport constrains tall controls above the footer', () => {
  const p = position({ left: 20, top: 50, bottom: 72 }, { ...portrait, offsetTop: 40, height: 180 }, true, 200, 240).value();
  assert.equal(p.top, 52);
  assert.equal(p.maxHeight, 144);
  assert.equal(p.top + p.maxHeight, 196);
});