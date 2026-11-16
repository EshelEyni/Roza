const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const exportsTts = {};
require('node:vm').runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../frontend/src/services/readerTts.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsTts });
const words = [
  { text: 'Skip', paragraphEnd: false }, { text: 'inline', paragraphEnd: false },
  { text: 'markup.', paragraphEnd: true }, { text: 'Next paragraph.', paragraphEnd: true },
];
test('starts at current mapped word and stops at paragraph boundary', () => {
  assert.equal(exportsTts.ttsPassage(words, 1), 'inline markup.');
  assert.equal(exportsTts.ttsPassage(words, 3), 'Next paragraph.');
  assert.equal(exportsTts.ttsPassage([], 0), '');
});
test('caps long passages without splitting normal words', () => {
  assert.equal(exportsTts.ttsPassage(words, 0, 12), 'Skip inline');
  assert.equal(exportsTts.ttsPassage([{text:'x'.repeat(800),paragraphEnd:true}], 0).length, 400);
  assert.ok(exportsTts.ttsPassage(Array.from({length:1000}, () => ({text:'hello',paragraphEnd:false})),0).length <= 400);
});
