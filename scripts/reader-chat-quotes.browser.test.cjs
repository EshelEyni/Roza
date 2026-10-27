const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");

test("single-display quoted text with the real chat component on desktop and mobile", { timeout: 90000 }, async t => {
  const { createServer } = await import(pathToFileURL(path.join(root, "frontend/node_modules/vite/dist/node/index.js")));
  const { default: react } = await import(pathToFileURL(path.join(root, "frontend/node_modules/@vitejs/plugin-react/dist/index.mjs")));
  const aliases = ["react", "react-dom", "i18next", "react-i18next", "react-icons", "axios"]
    .map(name => ({ find: name, replacement: path.join(root, "frontend/node_modules", name).replaceAll("\\", "/") }));
  const server = await createServer({ configFile: false, appType: "custom", root,
    cacheDir: path.join(root, "frontend/node_modules/.vite-chat-quote-test"),
    optimizeDeps: { entries: ["scripts/fixtures/reader-chat-quotes.tsx"] },
    resolve: { alias: aliases }, plugins: [react()], server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
  });
  server.middlewares.use("/quote-test", async (_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(await server.transformIndexHtml("/quote-test", `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>html,body,#root{margin:0;height:100%;font-family:Arial,sans-serif}*{box-sizing:border-box}
      .reader-shell{height:100dvh;max-width:520px;margin:auto;background:#f3e8d2;color:#3d3023}
      .reader-panel.reader-chat-panel{position:relative;inset:auto;width:100%;height:100dvh;max-height:none}
      </style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-chat-quotes.tsx"></script></body></html>`));
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    for (const mobile of [false, true]) await t.test(mobile ? "mobile" : "desktop", async () => {
      const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 850 }, isMobile: mobile, hasTouch: mobile });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/**", route => { errors.push("Unexpected API request"); return route.abort(); });
      try {
        await page.goto(server.resolvedUrls.local[0] + "quote-test");
        await page.waitForFunction(() => !!window.quoteTest);
        const scenario = async name => {
          await page.evaluate(value => window.quoteTest.setScenario(value), name);
          await page.waitForTimeout(70);
        };
        assert.equal(await page.locator("[data-reader-chat-draft]").count(), 1);
        assert.equal(await page.locator(".reader-chat-quote-text").count(), 1);
        assert.equal(await page.locator("details").count(), 0);
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll("[data-reader-chat-source]").length === 1);
        assert.equal(await page.locator("[data-reader-chat-draft]").count(), 0);
        assert.equal(await page.locator(".reader-chat-quote-text").count(), 1);
        assert.equal(await page.locator(".reader-chat-authored-question").count(), 0);
        assert.ok(await page.locator(".reader-chat-quote-text").innerText());

        await scenario("question");
        assert.equal(await page.locator(".reader-chat-quote-text").count(), 1);
        assert.equal(await page.locator(".reader-chat-authored-question p").innerText(), "מה פירוש המשפט הזה?");
        const snapshot = await page.evaluate(() => window.quoteTest.snapshot());
        if (process.env.QUOTE_SCREENSHOT_DIR) await page.locator(".reader-chat-panel").screenshot({ path: path.join(process.env.QUOTE_SCREENSHOT_DIR, mobile ? "quote-mobile.png" : "quote-desktop.png") });
        assert.equal(await page.evaluate(() => window.quoteTest.snapshot()), snapshot);

        await scenario("followup");
        assert.equal(await page.locator(".reader-chat-quote-text").count(), 1);
        assert.equal(await page.locator(".reader-chat-question").count(), 2);
        await page.locator(".reader-chat-question").last().getByRole("button", { name: /Same passage/ }).click();
        assert.equal(await page.evaluate(() => document.activeElement.dataset.readerChatSource), "first");
        const alignment = await page.evaluate(() => {
          const source = document.querySelector("[data-reader-chat-source]");
          const log = document.querySelector(".reader-chat-messages");
          return source.getBoundingClientRect().top - log.getBoundingClientRect().top;
        });
        assert.ok(alignment >= 0 && alignment < 40);

        await scenario("legacy");
        assert.equal(await page.locator(".reader-chat-quote-text").count(), 1);
        assert.equal(await page.locator(".reader-chat-question p").count(), 0);
        await scenario("pending");
        assert.equal(await page.locator(".reader-chat-quote-text").count(), 1);
        assert.equal(await page.locator("[data-reader-chat-draft]").count(), 0);
        await scenario("word");
        assert.equal(await page.locator(".reader-chat-quote-text").innerText(), "screed");
        assert.equal(await page.getByRole("button", { name: "Read full passage", exact: true }).count(), 0);

        await scenario("long");
        const show = page.getByRole("button", { name: "Read full passage", exact: true });
        await show.waitFor();
        await show.click();
        assert.equal(await page.locator(".reader-chat-quote-text").evaluate(node => getComputedStyle(node).overflowY), "visible");
        assert.equal(await page.locator(".reader-chat-quote-text.is-expanded").count(), 1);
        assert.equal(await page.getByRole("button", { name: "Send", exact: true }).isVisible(), true);
        await page.getByRole("button", { name: "Show less", exact: true }).click();
        assert.equal(await page.locator(".reader-chat-quote-text.is-expanded").count(), 0);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  } finally { await browser?.close(); await server.close(); }
});
