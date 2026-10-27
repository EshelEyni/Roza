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
  "cross-page selection with the real renderer on desktop and mobile",
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
          await run(() => window.selectionTest.select(0, 13));
          await page
            .getByRole("button", { name: "Extend selection to the next page" })
            [mobile ? "tap" : "click"]();
          await page.waitForFunction(
            () => window.selectionTest.extending && !window.selectionTest.busy,
          );
          assert.ok(
            (await run(() => window.selectionTest.selected.text)).startsWith(
              "chapter0word0",
            ),
          );
          await page
            .getByRole("button", { name: "Copy selected text" })
            [mobile ? "tap" : "click"]();
          assert.equal(
            await run(() => navigator.clipboard.readText()),
            await run(() => window.selectionTest.selected.text),
          );
          assert.equal(
            await run(() => window.selectionTest.clipboard()),
            await run(() => window.selectionTest.selected.text),
          );

          // Skip no content when extending repeatedly over multiple chapter iframes.
          await run(async () => {
            const api = window.selectionTest;
            for (
              let i = 0;
              i < 80 && api.rendition.currentLocation().start.index < 2;
              i++
            )
              await api.extend("next");
          });
          await page.waitForFunction(() => !window.selectionTest.busy);
          const full = await run(() => window.selectionTest.selected.text);
          if (process.env.SELECTION_SCREENSHOT_DIR)
            await page.screenshot({
              path: path.join(
                process.env.SELECTION_SCREENSHOT_DIR,
                mobile ? "selection-mobile.png" : "selection-desktop.png",
              ),
            });
          const expected = await run(() => {
            const api = window.selectionTest;
            const end = api.rendition.currentLocation().end;
            const point = api.rendition.getRange(end.cfi);
            return [
              ...api.texts.slice(0, end.index),
              api.texts[end.index].slice(0, point.startOffset),
            ]
              .join("\n")
              .trim();
          });
          equalText(full, expected);
          assert.ok(full.length > 3000);
          assert.equal(
            await page.getByRole("button", { name: "Ask AI" }).isDisabled(),
            full.length > 20000,
          );

          // Refining the endpoint and reversing direction use exact DOM offsets.
          await run(() => window.selectionTest.select(0, 40));
          await page.waitForFunction(() => !window.selectionTest.busy);
          equalText(
            await run(() => window.selectionTest.selected.text),
            await run(() =>
              [
                ...window.selectionTest.texts.slice(0, 2),
                window.selectionTest.texts[2].slice(0, 40),
              ].join("\n"),
            ),
          );
          await run(async () => {
            const api = window.selectionTest;
            await api.display(2);
            api.select(20, 40);
          });
          await run(async () => {
            const api = window.selectionTest;
            for (
              let i = 0;
              i < 80 && api.rendition.currentLocation().start.index > 0;
              i++
            )
              await api.extend("prev");
          });
          await page.waitForFunction(() => !window.selectionTest.busy);
          equalText(
            await run(() => window.selectionTest.selected.text),
            await run(() => {
              const api = window.selectionTest;
              const start = api.rendition.currentLocation().start;
              const point = api.rendition.getRange(start.cfi);
              return [
                api.texts[0].slice(point.startOffset),
                api.texts[1],
                api.texts[2].slice(0, 40),
              ].join("\n");
            }),
          );
          await run(() => window.selectionTest.close());

          if (!mobile) {
            await run(() => window.selectionTest.display(0));
            const drag = await run(() => {
              const contents = window.selectionTest.rendition.getContents()[0];
              const range = contents.document.createRange();
              range.setStart(
                contents.document.querySelector("p").firstChild,
                0,
              );
              range.setEnd(contents.document.querySelector("p").firstChild, 1);
              const rect = range.getBoundingClientRect();
              const frame =
                contents.document.defaultView.frameElement.getBoundingClientRect();
              return {
                x: frame.left + rect.left + 1,
                y: frame.top + rect.top + 8,
                edge:
                  document
                    .querySelector(".reader-shell")
                    .getBoundingClientRect().right - 5,
              };
            });
            await page.mouse.move(drag.x, drag.y);
            await page.mouse.down();
            await page.mouse.move(drag.edge, drag.y + 25, { steps: 15 });
            await page.waitForFunction(
              () => window.selectionTest.extending,
              null,
              { timeout: 5000 },
            );
            await page.mouse.up();
            await page.waitForFunction(() => !window.selectionTest.busy);
            assert.ok(
              (await run(() => window.selectionTest.selected.text)).length > 20,
            );
            await run(() => window.selectionTest.close());
          }
          await page.waitForFunction(() => !window.selectionTest.selected);
          assert.equal(await page.getByRole("dialog").count(), 0);

          // A small selection across a chapter boundary keeps the full AI passage.
          await run(async () => {
            const api = window.selectionTest;
            await api.rendition.display(api.point(0, api.texts[0].length - 30));
            await api.rendition.reportLocation();
            api.select(api.texts[0].length - 30, api.texts[0].length - 10);
          });
          await page
            .getByRole("button", { name: "Extend selection to the next page" })
            [mobile ? "tap" : "click"]();
          await page.waitForFunction(
            () =>
              !window.selectionTest.busy &&
              !!window.selectionTest.selected.endCfi,
          );
          await run(() => window.selectionTest.select(0, 20));
          await page.waitForFunction(() => !window.selectionTest.busy);
          const aiText = await run(() => window.selectionTest.selected.text);
          equalText(
            aiText,
            await run(
              () =>
                window.selectionTest.texts[0].slice(-30) +
                "\n" +
                window.selectionTest.texts[1].slice(0, 20),
            ),
          );
          await page
            .getByRole("button", { name: "Ask AI" })
            [mobile ? "tap" : "click"]();
          assert.equal(await run(() => window.askedText), aiText);
          await run(() => window.selectionTest.close());

          // Existing dictionary and Google translation actions still use a word CFI.
          const requests = [];
          await page.route("**/api/reader/test/dictionary", async (route) => {
            const body = route.request().postDataJSON();
            requests.push(body);
            await route.fulfill({
              json: {
                status: "success",
                data: {
                  entry: {
                    word: "chapter",
                    headword: "chapter",
                    source: "fixture",
                    ...(body.provider === "google"
                      ? { kind: "translation" }
                      : {}),
                    senses: [
                      {
                        id: "one",
                        partOfSpeech: "noun",
                        meanings: ["פרק"],
                        explanations: [],
                        examples: [],
                        definition: "A book section",
                      },
                    ],
                  },
                  lookupCount: 1,
                },
              },
            });
          });
          await run(async () => {
            await window.selectionTest.display(0);
            window.selectionTest.select(0, 7);
          });
          await page
            .getByRole("button", { name: "Look up in Hebrew" })
            [mobile ? "tap" : "click"]();
          await page
            .getByRole("button", { name: "Translate with Google" })
            [mobile ? "tap" : "click"]();
          await page
            .locator('.reader-dictionary-meanings[lang="he-x-mtfrom-en"]')
            .waitFor();
          assert.deepEqual(
            requests.map((request) => request.provider),
            ["auto", "google"],
          );
          assert.ok(
            requests.every(
              (request) =>
                request.word === "chapter" &&
                request.location.startsWith("epubcfi("),
            ),
          );
          // Main's dismissal fix must still clear native selection and unlock swipes.
          await run(() => window.selectionTest.close());
          await page.waitForFunction(() => !window.selectionTest.selected);
          assert.equal(await run(() => window.selectionTest.rendition.getContents()[0].document.getSelection().toString()), "");
          await run(() => window.selectionTest.select(0, 7));
          await run(() => window.selectionTest.rendition.getContents()[0].document.getSelection().removeAllRanges());
          await page.waitForFunction(() => !window.selectionTest.selected);
          assert.deepEqual(errors, []);
          await context.close();
        });
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
