const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Ticket #59: Read Mode's Go to line input and its Ctrl+Shift+G shortcut.
const source = fs.readFileSync(path.join(__dirname, '../src/components/WritingStudio/goToLineInput.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = { exports: {} };
new Function('module', 'exports', outputText)(loaded, loaded.exports);
const { parseGoToLine, isGoToLineShortcut } = loaded.exports;

test('accepts whole line numbers from 1 to the last line', () => {
  assert.equal(parseGoToLine('1', 40), 1);
  assert.equal(parseGoToLine(' 17 ', 40), 17);
  assert.equal(parseGoToLine('40', 40), 40);
  assert.equal(parseGoToLine('007', 40), 7);
});

test('rejects blank, malformed and out-of-range numbers', () => {
  for (const input of ['', '   ', '0', '41', '-3', '2.5', '1e1', 'abc', '3 4', '+5']) {
    assert.equal(parseGoToLine(input, 40), undefined, JSON.stringify(input));
  }
  assert.equal(parseGoToLine('1', 0), undefined);
});

const key = (overrides = {}) => ({
  code: 'KeyG', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false,
  getModifierState: () => false, ...overrides,
});

test('matches Ctrl+Shift+G by physical key on any layout', () => {
  assert.equal(isGoToLineShortcut(key()), true);
  assert.equal(isGoToLineShortcut(key({ key: 'ע' })), true);
});

test('leaves other shortcuts alone', () => {
  assert.equal(isGoToLineShortcut(key({ shiftKey: false })), false);
  assert.equal(isGoToLineShortcut(key({ ctrlKey: false })), false);
  assert.equal(isGoToLineShortcut(key({ altKey: true })), false);
  assert.equal(isGoToLineShortcut(key({ metaKey: true })), false);
  assert.equal(isGoToLineShortcut(key({ code: 'KeyH' })), false);
  assert.equal(isGoToLineShortcut(key({ getModifierState: name => name === 'AltGraph' })), false);
});
