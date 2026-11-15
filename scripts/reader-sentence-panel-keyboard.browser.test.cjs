const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

for (const platform of ['Win32', 'MacIntel']) test(`${platform}: Sentence panel keyboard: native editing, actions, dropdowns, Tab, scope and cleanup`, async () => {
  const browser = await (process.env.RSVP_WEBKIT ? webkit : chromium).launch({ headless: true, ...(process.env.RSVP_WEBKIT ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }) });
  try {
    const page = await browser.newPage();
    const modifier = platform === 'MacIntel' ? 'Meta' : 'Control';
    await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { value: platform }), platform);
    await page.goto('about:blank');
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
    const other = platform === 'MacIntel' ? 'Control' : 'Meta';
    await page.evaluate(other => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true, ctrlKey: other === 'Control', metaKey: other === 'Meta' });
      document.activeElement.dispatchEvent(event);
      if (event.defaultPrevented) throw new Error('Wrong platform modifier was intercepted');
    }, other);
    await page.keyboard.press(`${modifier}+ArrowRight`);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'save');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.clicks), 1);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input');
    await page.keyboard.press(`${modifier}+Enter`);
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
    await page.keyboard.press(`${modifier}+ArrowRight`);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
    await page.focus('#outside');
    await page.keyboard.press(`${modifier}+ArrowRight`);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.innerHTML = '<input id="single"><textarea id="multi"></textarea><button type="submit">Submit</button><input id="range" type="range" value="50">';
      form.onsubmit = event => { event.preventDefault(); window.submits = (window.submits || 0) + 1; };
      document.querySelector('#panel').append(form);
    });
    await page.focus('#first'); // Close/chrome must never replace a disabled submit action.
    await page.$eval('form button', el => { el.disabled = true; });
    await page.focus('#single');
    await page.keyboard.press(`${modifier}+Enter`);
    assert.equal(await page.evaluate(() => window.submits || 0), 0);
    await page.$eval('form button', el => { el.disabled = false; });
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.submits || 0), 1);
    await page.keyboard.press(modifier + '+Enter');
    assert.equal(await page.evaluate(() => window.submits), 2);
    await page.focus('#multi');
    await page.keyboard.type('First line');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Second line');
    assert.equal(await page.inputValue('#multi'), ['First line', 'Second line'].join(String.fromCharCode(10)));
    assert.equal(await page.evaluate(() => window.submits), 2);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.submits), 3);
    await page.focus('#range');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.$eval('#range', el => el.value), '51');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'range');
    await page.focus('#save');
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); document.activeElement.blur(); window.dispatchEvent(new Event('focus')); });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'save', 'Browser refocus restores the last panel control');
    await page.evaluate(() => window.cleanup());
    await page.focus('#first');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
  } finally { await browser.close(); }
});

