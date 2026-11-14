// Requires Playwright (or PLAYWRIGHT_MODULE pointing at an installed package).
// Run: node --test scripts/reader-tap.browser.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "../frontend/node_modules/playwright");
const root = path.resolve(__dirname, "..");

test(
  "mobile tap zones use the visible EPUB viewport at 20px and 56px",
  { timeout: 120000 },
  async () => {
    const { createServer } = await import(
      pathToFileURL(
        path.join(root, "frontend/node_modules/vite/dist/node/index.js"),
      )
    );
    const { default: react } = await import(
      pathToFileURL(
        require.resolve("@vitejs/plugin-react", { paths: [path.join(root, "frontend")] }),
      )
    );
    const aliases = [
      "react",
      "react-dom",
      "epubjs",
      "jszip",
      "i18next",
      "react-i18next",
      "react-icons",
    ].map((name) => ({
      find: name,
      replacement: path
        .join(root, "frontend/node_modules", name)
        .replaceAll("\\", "/"),
    }));
    const server = await createServer({
      configFile: false,
      appType: "custom",
      root,
      cacheDir: path.join(root, "frontend/node_modules/.vite-selection-test"),
      optimizeDeps: { entries: ["scripts/fixtures/reader-selection.tsx"] },
      resolve: { alias: aliases },
      plugins: [react()],
      server: { host: "127.0.0.1", port: 5197, fs: { allow: [root] } },
    });
    server.middlewares.use("/selection-test", async (_, res) => {
      const fixture = "/scripts/fixtures/reader-selection.tsx";
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/selection-test",
          `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${fixture}"></script></body></html>`,
        ),
      );
    });
    await server.listen();

    let browser;
    try {
      browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
      const context = await browser.newContext({ viewport: { width: 390, height: 850 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto(server.resolvedUrls.local[0] + "selection-test");
      await page.waitForFunction(() => !!window.selectionTest);
      const location = () => page.evaluate(() => window.selectionTest.rendition.currentLocation().start.cfi);
      const tap = async (fraction) => {
        const bounds = await page.locator('.epub-container').boundingBox();
        await page.touchscreen.tap(bounds.x + bounds.width * fraction, bounds.y + 80);
      };
      for (const font of [20, 56]) {
        await page.evaluate(async font => {
          const api = window.selectionTest;
          api.close();
          api.rendition.themes.fontSize(font + "px");
          await api.display(0);
        }, font);
        await page.waitForTimeout(350);
        const first = await location();
        await tap(0.9);
        await page.waitForFunction(first => window.selectionTest.rendition.currentLocation()?.start?.cfi && window.selectionTest.rendition.currentLocation().start.cfi !== first, first);
        const second = await location();
        await tap(0.5);
        await page.waitForTimeout(100);
        assert.equal(await location(), second);
        await tap(0.1);
        await page.waitForFunction(first => window.selectionTest.rendition.currentLocation()?.start?.cfi === first, first);
        // Cross chapter boundaries using the same production page-turn callback.
        await page.evaluate(async () => {
          await window.selectionTest.display(1);
        });
        await tap(0.1);
        await page.waitForFunction(() => window.selectionTest.rendition.currentLocation()?.start?.index === 0);
        await tap(0.9);
        await page.waitForFunction(() => window.selectionTest.rendition.currentLocation()?.start?.index === 1);
        await page.evaluate(() => window.selectionTest.setPanel("chat"));
        const blocked = await location();
        await tap(0.9);
        await page.waitForTimeout(100);
        assert.equal(await location(), blocked);
        await page.evaluate(() => window.selectionTest.setPanel(null));
      }
      await context.close();
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
