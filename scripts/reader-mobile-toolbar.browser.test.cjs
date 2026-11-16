// Requires Playwright (or PLAYWRIGHT_MODULE pointing at an installed package).
// Run: node --test scripts/reader-selection.browser.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
function equalText(actual, expected) {
  let index = 0;
  while (index < actual.length && actual[index] === expected[index]) index++;
  assert.ok(
    actual === expected,
    `Text differs at ${index}; lengths ${actual.length}/${expected.length}; ${JSON.stringify(actual.slice(index, index + 90))} / ${JSON.stringify(expected.slice(index, index + 90))}`,
  );
}

test(
  "selection toolbar labels and fixed footer docking",
  { timeout: 120000 },
  async (t) => {
    const { createServer } = await import(
      pathToFileURL(
        path.join(root, "frontend/node_modules/vite/dist/node/index.js"),
      )
    );
    const { default: react } = await import(
      pathToFileURL(
        path.join(
          root,
          "frontend/node_modules/@vitejs/plugin-react/dist/index.mjs",
        ),
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
      server: { host: "127.0.0.1", port: 5189, fs: { allow: [root] } },
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
      browser = await chromium.launch(
        process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {},
      );
      for (const mobile of [false, true])
        await t.test(mobile ? "mobile touch viewport" : "desktop", async () => {
          const context = await browser.newContext({
            viewport: { width: mobile ? 390 : 1280, height: 850 },
            isMobile: mobile,
            hasTouch: mobile,
            permissions: ["clipboard-read", "clipboard-write"],
          });
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto(server.resolvedUrls.local[0] + "selection-test");
          await page
            .waitForFunction(() => !!window.selectionTest, null, {
              timeout: 20000,
            })
            .catch((error) => {
              throw new Error(
                `${error.message}; browser errors: ${errors.join("; ")}`,
              );
            });
          const run = (fn) => page.evaluate(fn);

          const menu = page.getByRole('button', { name: 'Reader menu', exact: true });
          await menu.click();
          await page.getByRole('button', { name: 'Menu test action' }).waitFor();
          await page.frameLocator('iframe').locator('p').click({ position: { x: 60, y: 12 } });
          await page.waitForFunction(() => !document.querySelector('[data-reader-menu]'));
          // Navigation replaces EPUB documents while the menu can remain open.
          await menu.click();
          await run(() => window.selectionTest.display(1));
          await page.frameLocator('iframe').locator('p').click({ position: { x: 60, y: 12 } });
          await page.waitForFunction(() => !document.querySelector('[data-reader-menu]'));
          await run(() => window.selectionTest.display(0));
          assert.deepEqual(errors, []);
          await run(() => window.selectionTest.select(0, 24));
          await page.getByRole('dialog').waitFor();
          if (mobile) {
            assert.deepEqual(await page.locator('.reader-selection-label').allTextContents(), ['Ask AI', 'Note', 'Copy']);
            const check = async () => {
              await page.waitForFunction(() => {
                const element = document.querySelector('.reader-dictionary');
                if (!element) return false;
                const popup = element.getBoundingClientRect();
                const viewport = window.visualViewport;
                const left = viewport?.offsetLeft || 0;
                const bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
                const width = viewport?.width || innerWidth;
                return popup.width > 0 && Math.abs(popup.left - left) <= 1 && Math.abs(popup.width - width) <= 1 && popup.top >= (viewport?.offsetTop || 0) && Math.abs(popup.bottom - bottom) <= 1;
              });
            };
            await check();
            // Changing the selected passage must not move the toolbar.
            await run(() => window.selectionTest.select(80, 104));
            await check();
            await page.setViewportSize({ width: 320, height: 700 });
            await check();
            assert.ok(await page.locator('.reader-dictionary-actions button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44)));
          } else assert.equal(await page.locator('.reader-selection-label').count(), 0);
          await context.close();
        });
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
