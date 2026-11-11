const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

for (const mobile of [false, true]) test(`translation failures stay independent (mobile=${mobile})`, async () => {
  const slots = []; let cursor = 0; let asked = false;
  const react = {
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback: fn => fn, useEffect() {},
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const requests = [];
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/components/Reader/ReaderDictionary.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(source, { exports, React: react, AbortSignal, require: name => {
    if (name === 'react') return react;
    if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
    if (name === 'react-icons/fi') return {};
    if (name.endsWith('ReaderSheet')) return { ReaderSheet: 'sheet' };
    if (name.endsWith('useReaderMobile')) return { useReaderMobile: () => mobile };
    if (name.endsWith('createRequestId')) return { createRequestId: () => 'request' };
    if (name.endsWith('readerApiService')) return { default: { lookupWord: (_book, body) => new Promise((resolve, reject) => requests.push({ body, resolve, reject })) } };
    throw Error(name);
  } });
  const render = () => { cursor = 0; return exports.ReaderDictionary({ selection: { word: 'word', text: 'word', cfi: 'position' }, bookId: 'book', getLookupPage: async () => 'stable-page', onClose() {}, onAskAi: submit => { asked = submit; } }); };
  const all = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(all)];
  const button = (tree, label) => all(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || node.children.includes(label)));
  let tree = render();
  button(tree, 'reader.lookupHebrew').props.onClick();
  await new Promise(resolve => setImmediate(resolve)); tree = render();
  assert.equal(button(tree, 'reader.chat.ask').props.disabled, false);
  button(tree, 'reader.translateWithGoogle').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  requests[0].reject(new Error('504'));
  requests[1].resolve({ entry: null });
  await new Promise(resolve => setImmediate(resolve)); tree = render();
  button(tree, 'reader.lookupHebrew').props.onClick(); tree = render();
  assert.ok(button(tree, 'reader.retry'));
  button(tree, 'reader.retry').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 3);
  requests[2].resolve({ entry: null });
  await new Promise(resolve => setImmediate(resolve)); tree = render();
  button(tree, 'reader.chat.ask').props.onClick();
  assert.equal(asked, true);
});
