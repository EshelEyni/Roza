const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/src/hooks/reader/useEpubNavigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function setup(mobile, fail = false) {
  const exports = {};
  new Function('exports', 'require', 'requestAnimationFrame', source)(exports, name => {
    if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
    if (name === 'epubjs') return { EpubCFI: class { constructor(cfi) { this.cfi = cfi; } collapse() {} toString() { return this.cfi; } } };
    throw Error(name);
  }, callback => callback());
  const calls = [];
  const ref = current => ({ current });
  const rendition = { resize: () => {}, display: async cfi => { calls.push(['display', cfi]); if (fail) throw Error('unavailable'); }, reportLocation: async () => {} };
  const runtime = { changingLayout: ref(false), renditionRef: ref(rendition), navigationVersion: ref(0),
    explicitNavigation: ref(false), pendingResize: ref(undefined), layoutTask: ref(Promise.resolve()),
    host: ref(null), highlightedCfi: ref(''), mobileRef: ref(mobile), epubRef: ref(null) };
  const actions = exports.useEpubNavigation(runtime, {
    closeLookup: () => calls.push(['closeLookup']), closePanel: () => calls.push(['closePanel']),
    clearMarker: () => calls.push(['clear']), markPassage: async (...args) => calls.push(['mark', ...args]),
    setError: value => calls.push(['error', value]), setNotice: value => calls.push(['notice', value]), locationsReady: false,
  });
  return { actions, calls };
}
for (const mobile of [false, true]) test('chat quote navigates to its saved range then highlights yellow; mobile=' + mobile, async () => {
  const { actions, calls } = setup(mobile);
  const passage = { cfi: 'epubcfi(saved-range)', endCfi: 'epubcfi(end)', text: 'From your book' };
  await actions.onPassageNavigate(passage);
  assert.deepEqual(calls.at(-1), ['mark', passage, 'yellow']);
  assert.equal(calls.filter(call => call[0] === 'display').length, 2);
  assert.equal(calls.some(call => call[0] === 'closePanel'), mobile);
  assert.equal(calls.some(call => call[0] === 'closeLookup'), true);
});
test('unavailable chat passage reports navigation failure without leaving a misleading marker', async () => {
  const { actions, calls } = setup(false, true);
  await actions.onPassageNavigate({ cfi: 'epubcfi(missing)', text: 'missing' });
  assert.equal(calls.some(call => call[0] === 'mark'), false);
  assert.deepEqual(calls.at(-1), ['notice', 'reader.navigationError']);
});
