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
  "flags preserve selections, deduplicate, persist and navigate on desktop and mobile",
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
      "react-router-dom",
      "@tanstack/react-query",
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
        entries: ["scripts/fixtures/reader-flag-review.tsx"],
      },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] }, watch: { ignored: ["**/dist/**", "**/backend/build/**"] } },
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
    const flags = [];
    let writes = 0;
    server.middlewares.use("/api/reader/navigation/flags", async (req, res) => {
      if (req.url.endsWith("/translation")) {
        translated++;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "success", data: entry }));
        return;
      }
      if (req.method === "PATCH") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const f = flags.find((f) => "/" + f.id === req.url);
        if (f) f.reviewed = JSON.parse(body).reviewed;
      }
      if (req.method === "PUT") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const input = JSON.parse(body);
        writes++;
        let flag = flags.find(
          (f) => f.cfi === input.cfi && f.endCfi === input.endCfi,
        );
        if (!flag) {
          flag = {
            ...input,
            id: String(flags.length + 1),
            bookId: "navigation",
            createdAt: new Date().toISOString(),
            reviewed: false,
          };
          flags.push(flag);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "success", data: flag }));
        return;
      }
      if (req.method === "DELETE")
        flags.splice(
          flags.findIndex((f) => "/" + f.id === req.url),
          1,
        );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "success", data: flags }));
    });
    const entry = {
      word: "Note",
      headword: "note",
      source: "fixture",
      senses: [
        {
          id: "one",
          meanings: ["translation fixture"],
          definition: "A short record",
          explanations: [],
          examples: [],
          partOfSpeech: "noun",
        },
      ],
    };
    let translated = 0;
    let messages = 0;
    let vocabularyHidden = false;
    let vocabularyReviewed = false;
    server.middlewares.use("/api/reader/review", async (req, res) => {
      if (req.method === "DELETE") vocabularyHidden = true;
      if (req.method === "PATCH") vocabularyReviewed = true;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            flags,
            books: [{ id: "navigation", title: "Navigation" }],
            vocabulary: vocabularyHidden
              ? []
              : [
                  {
                    id: "v1",
                    headword: "note",
                    reviewed: vocabularyReviewed,
                    entry,
                    books: [
                      {
                        bookId: "navigation",
                        title: "Navigation",
                        location: flags[0]?.cfi,
                      },
                    ],
                  },
                ],
          },
        }),
      );
    });
    server.middlewares.use("/reader", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/reader/review",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-review-page.tsx"></script></body></html>',
        ),
      );
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
      if (req.url.includes("/messages")) messages++;
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
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-flag-review.tsx"></script></body></html>',
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
      await page.waitForFunction(
        () => window.navigationTest.reader.flags.ready,
      );
      await focus();
      await key("ArrowDown");
      const selected = await mark();
      await page.keyboard.press("Control+s");
      await page.waitForFunction(
        () => window.navigationTest.reader.flags.items.length === 1,
      );
      assert.equal(await mark(), selected);
      assert.equal(lookups.length, 0);
      assert.equal(writes, 1);
      await page.keyboard.press("Control+s");
      await page.waitForTimeout(150);
      assert.equal(writes, 1);
      await page.evaluate(async () => {
        const reader = window.navigationTest.reader;
        reader.closeLookup();
        const doc = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        const range = doc.createRange();
        range.setStart(doc.querySelector("a").firstChild, 0);
        range.setEnd(doc.querySelector("a").firstChild, 4);
        const selected = doc.getSelection();
        selected.removeAllRanges();
        selected.addRange(range);
      });
      await page.waitForSelector(".reader-dictionary");
      const selectionBefore = await page.evaluate(
        () => window.navigationTest.reader.textSelection,
      );
      await page.evaluate(() =>
        document
          .querySelector(".reader-viewport iframe")
          .contentDocument.addEventListener("keydown", (event) => {
            if (event.ctrlKey && event.key === "s")
              window.flagShortcutHandled = event.defaultPrevented;
          }),
      );
      await page.keyboard.press("Control+s");
      assert.equal(await page.evaluate(() => window.flagShortcutHandled), true);
      await page.waitForTimeout(100);
      assert.deepEqual(
        await page.evaluate(() => window.navigationTest.reader.textSelection),
        selectionBefore,
      );
      await page.locator('[aria-label="Remove flag"]').click();
      await page.waitForFunction(
        () => !window.navigationTest.reader.flags.items.length,
      );
      await page.locator('[aria-label="Flag for review (Ctrl+S)"]').click();
      await page.waitForFunction(
        () => window.navigationTest.reader.flags.items.length === 1,
      );
      const saved = flags[0];
      await page.getByLabel("Outside input").focus();
      await page.getByLabel("Outside input").evaluate((el) =>
        el.addEventListener("keydown", (e) => {
          if (e.ctrlKey && e.key === "s") {
            window.shortcutHandled = e.defaultPrevented;
            e.preventDefault();
          }
        }),
      );
      await page.keyboard.press("Control+s");
      assert.equal(await page.evaluate(() => window.shortcutHandled), false);
      await page.reload();
      await page.waitForFunction(
        () =>
          window.navigationTest?.reader.flags.ready &&
          window.navigationTest.reader.locationsReady,
      );
      assert.equal(
        await page.evaluate(
          () => window.navigationTest.reader.flags.items[0].cfi,
        ),
        saved.cfi,
      );
      await page.evaluate(() =>
        window.navigationTest.reader.updateState({
          preferences: {
            ...window.navigationTest.reader.state.preferences,
            fontSize: 26,
          },
        }),
      );
      await page.waitForTimeout(350);
      await page.evaluate(() => window.navigationTest.reader.returnTo("c4.xhtml"));
      await page.waitForFunction(() => window.navigationTest.reader.href.includes("c4.xhtml"));
      await page.evaluate(
        (f) => window.navigationTest.reader.onPassageNavigate(f),
        saved,
      );
      assert.equal(
        await page.evaluate(
          () => window.navigationTest.reader.flags.items[0].text,
        ),
        saved.text,
      );
      await page.waitForFunction(() => window.navigationTest.reader.href.includes("c0.xhtml"));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      await page.evaluate(() => window.navigationTest.reader.closeLookup());
      await page.evaluate(() => {
        const doc = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        const node = doc.querySelector("p").lastChild;
        const range = doc.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(100, node.textContent.length));
        const selection = doc.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
      await page.waitForSelector('[aria-label="Flag for review (Ctrl+S)"]');
      const passage = await page.evaluate(
        () => window.navigationTest.reader.textSelection.text,
      );
      await page.locator('[aria-label="Flag for review (Ctrl+S)"]').click();
      await page.waitForFunction(
        () => window.navigationTest.reader.flags.items.length === 2,
      );
      assert.equal(flags[1].text, passage);
      assert.equal(
        await page.evaluate(
          () => window.navigationTest.reader.textSelection.text,
        ),
        passage,
      );
      await page.goto(server.resolvedUrls.local[0] + "reader/review");
      await page
        .getByRole("heading", { name: "Review later", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Translate", exact: true })
        .click();
      await page
        .getByText("translation fixture", { exact: false })
        .first()
        .waitFor();
      assert.equal(translated, 1);
      await page.getByRole("combobox").selectOption("vocabulary");
      await page
        .getByRole("button", { name: "Mark reviewed", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Mark pending", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Remove from review", exact: true })
        .click();
      await page.getByText("No items here yet.").waitFor();
      await page.getByRole("combobox").selectOption("pending");
      await page.getByRole("link", { name: "Ask AI", exact: true }).click();
      await page.locator("#reader-chat-question").waitFor();
      await page
        .locator(".reader-chat-quote")
        .filter({ hasText: passage })
        .waitFor();
      assert.equal(messages, 0, "opening AI review never sends automatically");
      await page.goto(server.resolvedUrls.local[0] + "reader/review");
      await page
        .getByRole("button", { name: "Mark reviewed", exact: true })
        .first()
        .click();
      await page.getByRole("combobox").selectOption("reviewed");
      await page
        .getByRole("button", { name: "Mark pending", exact: true })
        .waitFor();
      assert.equal(lookups.length, 0);
      const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
      phone.on("pageerror", e => errors.push(e.message));
      await phone.goto(server.resolvedUrls.local[0] + "word-test");
      await phone.waitForFunction(() => window.navigationTest?.reader.flags.ready && window.navigationTest.reader.locationsReady);
      const count = flags.length;
      await phone.evaluate(() => {
        const doc = document.querySelector('.reader-viewport iframe').contentDocument;
        const node = doc.querySelector('p').lastChild;
        const range = doc.createRange(); range.setStart(node, 110); range.setEnd(node, 145);
        const selected = doc.getSelection(); selected.removeAllRanges(); selected.addRange(range);
      });
      await phone.getByRole('button', {name:'Flag for review (Ctrl+S)', exact:true}).tap();
      await phone.waitForFunction(count => window.navigationTest.reader.flags.items.length === count + 1, count);
      assert.equal(flags.length, count + 1);
      assert.equal(await phone.evaluate(() => !!window.navigationTest.reader.textSelection?.text), true);
      await phone.goto(server.resolvedUrls.local[0] + "reader/review");
      await phone.getByRole('heading', {name:'Review later', exact:true}).waitFor();
      if (process.env.FLAG_REVIEW_SCREENSHOT) await phone.screenshot({path:process.env.FLAG_REVIEW_SCREENSHOT, fullPage:true});
      await phone.close();
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
