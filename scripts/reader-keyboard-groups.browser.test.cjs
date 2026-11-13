const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const JSZip = require("../frontend/node_modules/jszip");
const root = path.resolve(__dirname, "..");
async function epub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "book.opf",
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">navigation</dc:identifier><dc:title>Navigation</dc:title><dc:language>en</dc:language></metadata><manifest>' +
      Array.from(
        { length: 8 },
        (_, i) =>
          '<item id="c' +
          i +
          '" href="c' +
          i +
          '.xhtml" media-type="application/xhtml+xml"/>',
      ).join("") +
      "</manifest><spine>" +
      Array.from({ length: 8 }, (_, i) => '<itemref idref="c' + i + '"/>').join(
        "",
      ) +
      "</spine></package>",
  );
  for (let i = 0; i < 8; i++)
    zip.file(
      "c" + i + ".xhtml",
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter ' +
        i +
        '</title></head><body><p id="note">' +
        (i === 0
          ? '<a epub:type="noteref" href="c7.xhtml#note">Note 1</a> '
          : "") +
        Array.from(
          { length: 600 },
          (_, j) =>
            "Chapter" +
            i +
            "word" +
            j +
            ((i === 0
              ? j === 119 || (j >= 120 && (j - 120) % 11 === 10)
              : j % 11 === 10) || j === 599
              ? "."
              : ""),
        ).join(" ") +
        "</p></body></html>",
    );
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "word and sentence groups continue across pages and settings follow the user",
  { timeout: 120000 },
  async () => {
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
    const file = await epub();
    const aliases = [
      "react",
      "react-dom",
      "epubjs",
      "react-icons",
      "i18next",
      "react-i18next",
      "axios",
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
      cacheDir: path.join(
        root,
        "frontend/node_modules/.vite-keyboard-groups-test",
      ),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: {
        entries: ["scripts/fixtures/reader-word-navigation.tsx"],
      },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
    });
    const lookups = [];
    server.middlewares.use("/api/reader/second/file", (_, res) => {
      res.setHeader("Content-Type", "application/epub+zip");
      res.end(file);
    });
    server.middlewares.use("/api/reader/navigation/file", (_, res) => {
      res.setHeader("Content-Type", "application/epub+zip");
      res.end(file);
    });
    const savedSettings = new Map();
    server.middlewares.use(
      "/api/reader/keyboard-settings",
      async (req, res) => {
        const owner =
          new URL(req.headers.referer).searchParams.get("user") || "fixture";
        let keyboardSettings = savedSettings.get(owner) || {
          unit: "words",
          count: 1,
        };
        if (req.method === "PATCH") {
          let body = "";
          for await (const chunk of req) body += chunk;
          keyboardSettings = JSON.parse(body);
          savedSettings.set(owner, keyboardSettings);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "success", data: keyboardSettings }));
      },
    );
    server.middlewares.use("/api/", (req, res) => {
      if (req.url.includes("dictionary")) lookups.push(req.url);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          data: { entry: null, lookupCount: 1 },
        }),
      );
    });
    server.middlewares.use("/word-test", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/word-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-word-navigation.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    let browser;
    try {
      browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
      });
      const page = await browser.newPage({
        viewport: { width: 1280, height: 850 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls.local[0] + "word-test");
      await page.waitForFunction(
        () => window.navigationTest?.reader.locationsReady,
        null,
        { timeout: 45000 },
      );
      const focus = () =>
        page.evaluate(() =>
          document
            .querySelector(".reader-viewport iframe")
            .contentWindow.focus(),
        );
      const mark = () =>
        page.evaluate(() => {
          const doc = document.querySelector(
            ".reader-viewport iframe",
          ).contentDocument;
          const name = document.querySelector(".reader-keyboard-word")?.dataset
            .readerNativeHighlight;
          return name
            ? [...doc.defaultView.CSS.highlights.get(name)][0].toString()
            : null;
        });
      const tokens = (text) => text?.match(/[\p{L}\p{N}]+/gu) || [];
      const key = async (value) => {
        const previous = await page.evaluate(
          () =>
            document.querySelector(".reader-keyboard-word")?.dataset
              .readerNativeHighlight,
        );
        await page.keyboard.press(value);
        if (value === "ArrowDown" || value === "ArrowUp")
          await page.waitForFunction((previous) => {
            const name = document.querySelector(".reader-keyboard-word")
              ?.dataset.readerNativeHighlight;
            return !!name && name !== previous;
          }, previous);
        else await page.waitForTimeout(50);
      };
      const start = async () => {
        await page.evaluate(() =>
          window.navigationTest.reader.returnTo("c0.xhtml"),
        );
        await focus();
        await key("Escape");
      };
      const configure = async (unit, count) => {
        if (!(await page.locator(".reader-settings").count()))
          await page
            .getByRole("button", { name: "Open side settings" })
            .click();
        await page
          .getByRole("combobox", { name: "Select by", exact: true })
          .selectOption(unit);
        await page
          .getByRole("spinbutton", { name: "Number per group" })
          .fill(String(count));
        await page
          .getByRole("spinbutton", { name: "Number per group" })
          .press("Tab");
        await page.waitForFunction(
          () => window.navigationTest.reader.keyboardSaveStatus === "saved",
        );
        if (
          process.env.KEYBOARD_SETTINGS_SCREENSHOT &&
          unit === "words" &&
          count === 5
        )
          await page
            .locator(".reader-keyboard-settings")
            .screenshot({ path: process.env.KEYBOARD_SETTINGS_SCREENSHOT });
        await page.evaluate(() => window.navigationTest.reader.closePanel());
        await page.waitForTimeout(400);
      };
      await configure("words", 5);
      // A saved setting applies after reload, across books, and only to its owner.
      const baseUrl = server.resolvedUrls.local[0] + "word-test";
      for (const query of ["", "?book=second", "?user=another", ""]) {
        await page.goto(baseUrl + query);
        await page.waitForFunction(
          () =>
            window.navigationTest?.reader.locationsReady &&
            window.navigationTest.reader.keyboardSaveStatus === "saved",
        );
        assert.deepEqual(
          await page.evaluate(
            () => window.navigationTest.reader.keyboardSettings,
          ),
          query.includes("another")
            ? { unit: "words", count: 1 }
            : { unit: "words", count: 5 },
        );
      }
      await start();
      // Discover the visible words once for precise page-edge expectations.
      const chooseBeforeLastThree = () =>
        page.evaluate(() => {
          const doc = document.querySelector(
            ".reader-viewport iframe",
          ).contentDocument;
          const host = document
            .querySelector(".reader-viewport")
            .getBoundingClientRect();
          const frame = doc.defaultView.frameElement.getBoundingClientRect();
          const walker = doc.createTreeWalker(doc.body, 4);
          const words = [];
          let node;
          while ((node = walker.nextNode()))
            for (const match of node.textContent.matchAll(/[\p{L}\p{N}]+/gu)) {
              const range = doc.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              if (
                [...range.getClientRects()].some(
                  (r) =>
                    r.width > 0 &&
                    frame.left + r.left >= host.left - 1 &&
                    frame.left + r.left < host.right - 1 &&
                    frame.top + r.bottom > host.top &&
                    frame.top + r.top < host.bottom,
                )
              )
                words.push({ range, text: match[0] });
            }
          doc.body.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
          );
          doc.getSelection().removeAllRanges();
          doc.getSelection().addRange(words.at(-4).range);
          return words.slice(-3).map((word) => word.text);
        });
      const lastThree = await chooseBeforeLastThree();
      await key("ArrowDown");
      assert.deepEqual(
        tokens(await mark()),
        lastThree,
        "Highlight just the three words left on this page",
      );
      const firstPage = await page.evaluate(
        () => window.navigationTest.reader.location.start.cfi,
      );
      await key("ArrowDown");
      const remainingTwo = tokens(await mark());
      assert.equal(
        remainingTwo.length,
        2,
        "Carry the remaining two words onto the next page",
      );
      assert.notEqual(
        await page.evaluate(
          () => window.navigationTest.reader.location.start.cfi,
        ),
        firstPage,
      );
      await focus();
      await key("Control+Space");
      await page.waitForFunction(
        () => window.navigationTest.reader.textSelection?.lookupRequest,
      );
      await page.waitForTimeout(150);
      assert.deepEqual(
        tokens(
          await page.evaluate(
            () => window.navigationTest.reader.textSelection.text,
          ),
        ),
        remainingTwo,
      );
      await focus();
      await key("ArrowDown");
      assert.equal(
        tokens(await mark()).length,
        5,
        "Resume fresh five-word groups after the continuation",
      );
      await key("ArrowUp");
      assert.deepEqual(
        tokens(await mark()),
        remainingTwo,
        "Reverse navigation stops at the same page edge",
      );
      await key("ArrowUp");
      assert.deepEqual(
        tokens(await mark()),
        lastThree,
        "Carry three remaining words backward onto the previous page",
      );
      await key("ArrowUp");
      assert.equal(tokens(await mark()).length, 5);
      assert.equal(
        lookups.length,
        0,
        "Grouped navigation and passage actions must not issue word dictionary requests",
      );
      // A word-group remainder also crosses an EPUB chapter boundary.
      await page.evaluate(() =>
        window.navigationTest.reader.returnTo("c1.xhtml"),
      );
      await focus();
      await key("Escape");
      await key("ArrowDown");
      await key("ArrowUp");
      assert.equal(
        await page.evaluate(
          () => window.navigationTest.reader.location.start.index,
        ),
        0,
      );
      const chapterTail = await chooseBeforeLastThree();
      await key("ArrowDown");
      assert.deepEqual(tokens(await mark()), chapterTail);
      await key("ArrowDown");
      assert.deepEqual(tokens(await mark()), [
        "Chapter1word0",
        "Chapter1word1",
      ]);
      await key("ArrowDown");
      assert.equal(tokens(await mark()).length, 5);
      // Long first sentence spans a page. Finish it before starting sentence two.
      await configure("sentences", 1);
      await start();
      await key("ArrowDown");
      const firstPart = await mark();
      assert.ok(firstPart.startsWith("Note 1 "));
      assert.ok(!firstPart.includes("Chapter0word119"));
      const firstSentencePage = await page.evaluate(
        () => window.navigationTest.reader.location.start.cfi,
      );
      await key("ArrowDown");
      const secondPart = await mark();
      assert.ok(secondPart.endsWith("Chapter0word119."));
      assert.ok(!secondPart.includes("Chapter0word120"));
      assert.notEqual(
        await page.evaluate(
          () => window.navigationTest.reader.location.start.cfi,
        ),
        firstSentencePage,
      );
      assert.deepEqual(tokens(firstPart + " " + secondPart), [
        "Note",
        "1",
        ...Array.from({ length: 120 }, (_, i) => "Chapter0word" + i),
      ]);
      await key("ArrowDown");
      assert.deepEqual(
        tokens(await mark()),
        Array.from({ length: 11 }, (_, i) => "Chapter0word" + (120 + i)),
      );
      assert.ok((await mark()).endsWith("."));
      await key("ArrowUp");
      assert.deepEqual(
        tokens(await mark()),
        tokens(secondPart),
        "Up highlights the visible tail of the previous sentence",
      );
      await key("ArrowUp");
      assert.deepEqual(
        tokens(await mark()),
        tokens(firstPart),
        "Up continues to the beginning of that sentence on the previous page",
      );
      // Carry two sentences across a page, finishing the interrupted first one.
      await configure("sentences", 2);
      await start();
      await key("ArrowDown");
      const twoSentenceStart = await mark();
      await key("ArrowDown");
      assert.deepEqual(tokens(twoSentenceStart + " " + (await mark())), [
        "Note",
        "1",
        ...Array.from({ length: 131 }, (_, i) => "Chapter0word" + i),
      ]);
      // Multiple sentences, followed by a fresh group, and reversal.
      await configure("sentences", 2);
      await page.evaluate(() =>
        window.navigationTest.reader.returnTo("c1.xhtml"),
      );
      await focus();
      await key("Escape");
      await key("ArrowDown");
      assert.deepEqual(
        tokens(await mark()),
        Array.from({ length: 22 }, (_, i) => "Chapter1word" + i),
      );
      await key("ArrowDown");
      assert.deepEqual(
        tokens(await mark()),
        Array.from({ length: 22 }, (_, i) => "Chapter1word" + (22 + i)),
      );
      await key("ArrowUp");
      assert.deepEqual(
        tokens(await mark()),
        Array.from({ length: 22 }, (_, i) => "Chapter1word" + i),
      );
      // Changing the count abandons an old remainder and keeps the new count.
      await configure("words", 5);
      await start();
      await chooseBeforeLastThree();
      await key("ArrowDown");
      await configure("words", 4);
      assert.deepEqual(
        await page.evaluate(
          () => window.navigationTest.reader.keyboardSettings,
        ),
        { unit: "words", count: 4 },
      );
      await focus();
      await key("ArrowDown");
      assert.equal(
        tokens(await mark()).length,
        4,
        JSON.stringify({
          mark: await mark(),
          location: await page.evaluate(
            () => window.navigationTest.reader.location,
          ),
        }),
      );
      let failSave = true;
      await page.route("**/api/reader/keyboard-settings", async (route) => {
        if (failSave && route.request().method() === "PATCH") {
          failSave = false;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              status: "error",
              message: "Test save failure",
            }),
          });
        } else await route.continue();
      });
      await page.getByRole("button", { name: "Open side settings" }).click();
      await page
        .getByRole("spinbutton", { name: "Number per group" })
        .fill("6");
      await page
        .getByRole("spinbutton", { name: "Number per group" })
        .press("Tab");
      await page.waitForFunction(
        () => window.navigationTest.reader.keyboardSaveStatus === "error",
      );
      await page
        .locator(".reader-keyboard-settings")
        .getByRole("button", { name: "Try again" })
        .click();
      await page.waitForFunction(
        () => window.navigationTest.reader.keyboardSaveStatus === "saved",
      );
      assert.deepEqual(
        await page.evaluate(
          () => window.navigationTest.reader.keyboardSettings,
        ),
        { unit: "words", count: 6 },
      );
      assert.equal(lookups.length, 0);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
