const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Ticket #44: the real autosave queue, with controllable timers and requests.
function load() {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/readerDocumentSaver.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const module = { exports: {} };
  new Function('module', 'exports', outputText)(module, module.exports);
  return module.exports.createReaderDocumentSaver;
}
const createSaver = load();
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const timers = [];
  const requests = [];
  const statuses = [];
  const saver = createSaver({
    delay: 800,
    save: value => new Promise((resolve, reject) => requests.push({ value, resolve, reject })),
    onStatus: status => statuses.push(status),
    setTimer: callback => { const timer = { callback, cleared: false }; timers.push(timer); return timer; },
    clearTimer: timer => { timer.cleared = true; },
  });
  const fire = () => { const timer = timers.filter(item => !item.cleared).pop(); timer.cleared = true; timer.callback(); };
  return { saver, timers, requests, statuses, fire };
}

test('debounces rapid edits into one save of the newest content', async () => {
  const { saver, requests, statuses, fire } = setup();
  saver.schedule('a'); saver.schedule('ab'); saver.schedule('abc');
  assert.equal(requests.length, 0);
  assert.equal(saver.dirty, true);
  fire();
  assert.deepEqual(requests.map(request => request.value), ['abc']);
  requests[0].resolve();
  await tick();
  assert.equal(statuses.at(-1), 'saved');
  assert.equal(saver.dirty, false);
});

test('never runs two saves at once and sends edits made mid-save afterwards', async () => {
  const { saver, requests, statuses, fire } = setup();
  saver.schedule('one'); fire();
  saver.schedule('two'); fire();
  assert.equal(requests.length, 1, 'second save waits for the first');
  requests[0].resolve();
  await tick();
  assert.deepEqual(requests.map(request => request.value), ['one', 'two']);
  requests[1].resolve();
  await tick();
  assert.equal(statuses.at(-1), 'saved');
});

test('keeps a failed edit pending and saves it on retry', async () => {
  const { saver, requests, statuses, fire } = setup();
  saver.schedule('draft'); fire();
  requests[0].reject(new Error('offline'));
  await tick();
  assert.equal(statuses.at(-1), 'error');
  assert.equal(saver.dirty, true);
  const retried = saver.retry();
  assert.equal(requests[1].value, 'draft');
  requests[1].resolve();
  assert.equal(await retried, true);
  assert.equal(statuses.at(-1), 'saved');
});

test('a newer edit replaces a failed one instead of resending stale text', async () => {
  const { saver, requests, fire } = setup();
  saver.schedule('old'); fire();
  saver.schedule('new');
  requests[0].reject(new Error('offline'));
  await tick();
  fire();
  assert.equal(requests.at(-1).value, 'new');
});

test('flush saves immediately when the panel closes', async () => {
  const { saver, requests, timers } = setup();
  saver.schedule('closing');
  const flushed = saver.flush();
  assert.equal(timers[0].cleared, true);
  assert.equal(requests[0].value, 'closing');
  requests[0].resolve();
  assert.equal(await flushed, true);
  assert.equal(await saver.flush(), true, 'nothing left to save');
  assert.equal(requests.length, 1);
});
