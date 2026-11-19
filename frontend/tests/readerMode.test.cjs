const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URLSearchParams });
  return exports;
}
const mode = load('services/readerMode.ts');

test('explicit valid URL mode takes precedence over the stored mode', () => {
  assert.equal(mode.resolveInitialReaderMode('audiobook', 'sentence'), 'audiobook');
  assert.equal(mode.resolveInitialReaderMode('sentence', undefined), 'sentence');
  assert.equal(mode.resolveInitialReaderMode('page', 'audiobook'), 'page');
});

test('stored mode restores when the URL has no mode', () => {
  assert.equal(mode.resolveInitialReaderMode(null, 'sentence'), 'sentence');
  assert.equal(mode.resolveInitialReaderMode(null, undefined), 'page');
  assert.equal(mode.resolveInitialReaderMode(null, 'bogus'), 'page');
});

test('invalid URL modes fall back to Page Mode', () => {
  for (const value of ['', 'rsvp', 'SENTENCE', 'page ', '1']) assert.equal(mode.resolveInitialReaderMode(value, 'sentence'), 'page');
});

test('mode updates keep unrelated query parameters', () => {
  const search = mode.readerSearchWithMode('?flag=abc&action=ai&mode=page&x=1', 'sentence');
  const params = new URLSearchParams(search);
  assert.deepEqual([...params.entries()], [['flag', 'abc'], ['action', 'ai'], ['mode', 'sentence'], ['x', '1']]);
  assert.equal(mode.readerSearchWithMode('', 'audiobook'), '?mode=audiobook');
});

test('changing only the mode never changes the navigation destination', () => {
  const location = 'location=' + encodeURIComponent('epubcfi(/6/2!/4/2/1:0)');
  assert.equal(mode.readerDestinationKey('?' + location + '&mode=page'), mode.readerDestinationKey('?' + location + '&mode=sentence'));
  assert.equal(mode.readerDestinationKey('?mode=audiobook'), '');
  assert.notEqual(mode.readerDestinationKey('?flag=a&mode=page'), mode.readerDestinationKey('?flag=b&mode=page'));
});

test('login return paths stay inside the app', () => {
  assert.equal(mode.safeReturnPath('/reader/1?mode=sentence'), '/reader/1?mode=sentence');
  for (const value of ['//evil.example', '/\\evil.example', 'https://evil.example', 'reader/1', null, 5]) assert.equal(mode.safeReturnPath(value), null);
});
