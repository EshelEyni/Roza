const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real hook with an isolated state/effect host and mocked network.
function setup() {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ||= { current: initial };
    },
    useEffect() {},
    useCallback(callback) { return callback; },
  };
  const conversation = { id: 'conversation', turns: [], spoilersAllowed: false };
  const api = {
    create: async () => conversation,
    send: async () => conversation,
    getById: async () => conversation,
    list: async () => ({ items: [], nextCursor: null }),
  };
  const source = ts.transpileModule(fs.readFileSync(
    new URL('../src/hooks/useReaderChat.ts', `file://${__filename.replaceAll('\\', '/')}`), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name.endsWith('readerChatApiService')) return { default: api };
      if (name.endsWith('createRequestId')) return { createRequestId: () => 'request' };
      throw Error(name);
    },
  });
  return { api, render() { cursor = 0; return exports.useReaderChat('book', () => 'page'); } };
}

test('draft survives reader renders and history until explicitly starting a new chat', async () => {
  const host = setup();
  host.render().setDraft('My question');
  assert.equal(host.render().draft, 'My question');
  await host.render().loadHistory();
  host.render().setHistory(false);
  assert.equal(host.render().draft, 'My question');
  host.render().start();
  assert.equal(host.render().draft, '');
});

test('each selected passage starts a new chat and replaces the passage without inserting input text', async () => {
  const host = setup();
  await host.render().open('saved');
  host.render().setDraft('Old draft');
  host.render().start({ cfi: 'page1', text: 'First passage' });
  let chat = host.render();
  assert.equal(chat.conversation, null);
  assert.equal(chat.draft, '');
  assert.equal(chat.passage.text, 'First passage');
  chat.setDraft('Question about first passage');
  host.render().start({ cfi: 'page2', endCfi: 'page3', text: 'Second passage' });
  chat = host.render();
  assert.equal(chat.conversation, null);
  assert.equal(chat.draft, '');
  assert.equal(chat.passage.text, 'Second passage');
  assert.equal(chat.passage.cfi, 'page2');
  assert.equal(chat.passage.endCfi, 'page3');
});

test('failed creation, failed send and retries leave the input draft alone', async () => {
  const host = setup();
  host.render().setDraft('Question');
  host.api.create = async () => { throw Error('offline'); };
  assert.equal(host.render().send('Question'), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.render().draft, 'Question');
  host.api.create = async () => ({ id: 'new', turns: [] });
  host.api.send = async () => { throw Error('offline'); };
  assert.equal(host.render().send('Question', host.render().pending.id), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.render().draft, 'Question');
  const pending = host.render().pending;
  host.api.send = async () => ({ id: 'new', turns: [] });
  assert.equal(host.render().send(pending.question, pending.id), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.render().draft, 'Question');
});

test('a completed retry does not erase a newly typed identical draft', async () => {
  const host = setup();
  host.render().setDraft('Another question');
  host.render().send('Another question', 'retry');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.render().draft, 'Another question');
});
