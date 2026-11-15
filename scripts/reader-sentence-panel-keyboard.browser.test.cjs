const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Sentence panel keyboard: native editing, actions, dropdowns, Tab, scope and cleanup', async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
  try {
    const page = await browser.newPage();
    const source = ts.transpileModule(fs.readFileSync(require.resolve('../frontend/src/hooks/reader/useSentencePanelKeyboard.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    await page.setContent('<button id="outside">Outside</button><section id="panel"><button id="first">First</button><textarea id="input">hello world</textarea><button id="disabled" disabled>Disabled</button><button id="save" type="submit">Save</button><select id="select"><option>A</option><option>B</option></select></section>');
    await page.evaluate(source => {
      const exports = {};
      new Function('exports', 'require', source)(exports, () => ({}));
      window.cleanup = exports.installSentencePanelKeyboard(document.querySelector('#panel'));
      window.clicks = 0;
      document.querySelector('#save').onclick = () => window.clicks++;
    }, source);
    await page.waitForFunction(() => document.activeElement.id === 'input');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('#input', el => el.selectionStart), 10);
    await page.keyboard.press('Control+ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'save');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.clicks), 1);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input');
    await page.keyboard.press('Control+Enter');
    assert.equal(await page.evaluate(() => window.clicks), 2);
    await page.keyboard.press('Shift+ArrowLeft');
    assert.equal(await page.$eval('#input', el => el.selectionEnd - el.selectionStart), 1);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'save');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input');
    await page.focus('#select');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.$eval('#select', el => el.value), 'B');
    await page.keyboard.press('Control+ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
    await page.focus('#outside');
    await page.keyboard.press('Control+ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    await page.evaluate(() => window.cleanup());
    await page.focus('#first');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
  } finally { await browser.close(); }
});

