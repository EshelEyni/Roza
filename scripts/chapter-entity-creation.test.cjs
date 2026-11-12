const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const React = require('../frontend/node_modules/react');
global.document = { body: {} };
const source = path.join(__dirname, '../frontend/src/components/WritingStudio/ChapterElements.tsx');
function harness() {
  let state = [], cursor = 0;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const load = name => {
    if (name === 'react') return { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    }};
    if (name === 'react/jsx-runtime') return require('../frontend/node_modules/react/jsx-runtime');
    if (name === 'react-dom') return { createPortal: node => node };
    if (name.endsWith('bookUtilService')) return { getDefaultBookDataItem: ({ bookId, type }) => ({ bookId, type, name: '', description: [] }) };
    if (name === './manuscript') return { newId: () => 'new-id', plainText: () => '', richTextHtml: () => '' };
    return new Proxy({}, { get: () => () => null });
  };
  new Function('require', 'module', 'exports', code + '\nmodule.exports.Dialog = EntityDetailsDialog;')(load, module, module.exports);
  return render => { cursor = 0; return render(module.exports.ChapterElements, module.exports.Dialog); };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
for (const kind of ['characters', 'themes', 'plotlines']) {
  test(`${kind}: opens reused modal, discards canceled drafts, and links only on Save`, () => {
    const render = harness();
    const book = { id: 'book', chapters: [], characters: [], themes: [], plotlines: [] };
    const links = [];
    const store = { book, edit(update) { Object.assign(book, update(book)); } };
    const props = { store, chapter: { id: 'chapter' }, kind, link: (...args) => links.push(args), onEntity() {}, onChapter() {} };
    const view = () => render(Component => Component(props));
    const open = () => {
      const button = nodes(view()).find(n => n.type === 'button' && n.props['aria-haspopup'] === 'dialog');
      button.props.onClick();
      const tree = view();
      assert.equal(nodes(tree).some(n => n.type === 'form'), false);
      return nodes(tree).find(n => n.type?.name === 'EntityDetailsDialog');
    };
    let dialog = open();
    assert.equal(book[kind].length, 0);
    dialog.props.onUpdate({ description: [{ text: 'Unsaved' }] });
    dialog.props.onNote('Unsaved chapter note');
    dialog.props.onClose();
    assert.equal(book[kind].length, 0);
    assert.equal(links.length, 0);
    dialog = open();
    assert.deepEqual(dialog.props.entity.description, []);
    assert.equal(dialog.props.note, '');
    // Render the actual reused dialog with independent hook state.
    const dialogRender = harness();
    let content = dialogRender((_, Dialog) => Dialog(dialog.props));
    const input = nodes(content).find(n => n.type === 'input');
    assert.equal(input.props.autoFocus, true);
    assert.equal(nodes(content).find(n => n.type === 'button' && n.props.children === 'Save').props.disabled, true);
    input.props.onChange({ target: { value: '  New entity  ' } });
    content = dialogRender((_, Dialog) => Dialog(dialog.props));
    nodes(content).find(n => n.type === 'button' && n.props.children === 'Save').props.onClick();
    assert.equal(book[kind].length, 1);
    assert.equal(book[kind][0].name, 'New entity');
    assert.deepEqual(links, [[kind, 'new-id', false, '']]);
    assert.equal(nodes(view()).some(n => n.type?.name === 'EntityDetailsDialog'), false);
  });
}
