const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
test('only the focused open chat tab owns reader highlights', { timeout: 60000 }, async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/vite/dist/node/index.js')));
  const { default: react } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/@vitejs/plugin-react/dist/index.mjs')));
  const aliases = ['react','react-dom','i18next','react-i18next','react-icons','axios','epubjs'].map(name => ({ find: name, replacement: path.join(root,'frontend/node_modules',name).replaceAll('\\','/') }));
  const server = await createServer({ configFile: false, appType: 'custom', root,
    cacheDir: path.join(root,'frontend/node_modules/.vite-chat-marking-test'), plugins: [react()], resolve: { alias: aliases },
    optimizeDeps: { entries: ['scripts/fixtures/reader-chat-tabs.tsx'] }, server: { host:'127.0.0.1', port:0, fs: { allow:[root] } } });
  server.middlewares.use('/marking-test', async (_,res) => {
    res.setHeader('Content-Type','text/html');
    res.end(await server.transformIndexHtml('/marking-test','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-chat-tabs.tsx"></script></body></html>'));
  });
  await server.listen(); let browser;
  try {
    browser = await chromium.launch({ channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
    const page = await browser.newPage({ viewport:{width:1440,height:960} });
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({json:{status:'success',data:{items:[],nextCursor:null}}}));
    await page.goto(server.resolvedUrls.local[0]+'marking-test');
    await page.waitForFunction(() => !!window.tabTest);
    const marked = async expected => {
      await page.waitForFunction(expected => JSON.stringify(window.tabTest.marked().sort()) === JSON.stringify(expected), expected);
      assert.deepEqual(await page.evaluate(() => window.tabTest.marked().sort()), expected);
    };
    const a = await page.evaluate(() => window.tabTest.start({ cfi:'passage-a', text:'Passage A' }));
    await marked(['passage-a']);
    const b = await page.evaluate(() => window.tabTest.start({ cfi:'passage-b', text:'Passage B' }));
    await marked(['passage-b']);
    assert.equal(await page.locator('[role="tabpanel"]').count(), 2, 'Inactive views remain mounted');
    await page.evaluate(key => window.tabTest.select(key), a); await marked(['passage-a']);
    await page.evaluate(key => window.tabTest.select(key), b); await marked(['passage-b']);
    const group = await page.evaluate(() => window.tabTest.split()); await marked([]);
    await page.evaluate(({b,group}) => window.tabTest.move(b,group), {b,group}); await marked(['passage-b']);
    const first = await page.evaluate(() => window.tabTest.snapshot().groups[0].id);
    await page.evaluate(group => window.tabTest.focus(group), first); await marked(['passage-a']);
    await page.evaluate(key => window.tabTest.close(key), a); await marked(['passage-b']);
    await page.evaluate(() => window.tabTest.reopen()); await marked(['passage-a']);
    await page.evaluate(key => window.tabTest.close(key), a); await marked(['passage-b']);
    await page.evaluate(group => window.tabTest.focus(group), group); await marked(['passage-b']);
    await page.evaluate(key => window.tabTest.close(key), b); await marked([]);
    await page.evaluate(() => window.tabTest.reopen()); await marked(['passage-b']);
    await page.getByRole('button',{name:'Toggle chat',exact:true}).click(); await marked([]);
    await page.getByRole('button',{name:'Toggle chat',exact:true}).click(); await marked(['passage-b']);
    await page.setViewportSize({width:390,height:844}); await marked(['passage-b']);
    await page.evaluate(key => window.tabTest.close(key), b); await marked([]);
    assert.deepEqual(errors,[]);
  } finally { await browser?.close(); await server.close(); }
});
