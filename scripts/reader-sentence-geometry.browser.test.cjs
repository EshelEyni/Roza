const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
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
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">rsvp</dc:identifier><dc:title>RSVP</dc:title><dc:language>en</dc:language></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="note" href="note.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="note" linear="no"/><itemref idref="b"/></spine></package>',
  );
  zip.file(
    "a.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head><body><p>The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons. A short pause. Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road.</p></body></html>',
  );
  zip.file(
    "note.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Note</title></head><body><p>Footnote</p></body></html>',
  );
  zip.file(
    "b.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons. The end.</p></body></html>',
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "Sentence Mode visual-line geometry, alignment, layout invalidation and sentence boundaries",
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
    const file = await epub();
    const saves = [];
    const lookups = [];
    const annotations = [];
    const flags = [];
    let flagWrites = 0;
    const aliases = [
      "react",
      "react-dom",
      "react-router-dom",
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
      cacheDir: path.join(root, "frontend/node_modules/.vite-rsvp-test"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: { entries: ["scripts/fixtures/reader-rsvp.tsx"] },
      server: {
        host: "127.0.0.1",
        port: await new Promise((resolve) => {
          const probe = require("node:net").createServer();
          probe.listen(0, "127.0.0.1", () => {
            const port = probe.address().port;
            probe.close(() => resolve(port));
          });
        }),
        fs: { allow: [root] },
      },
    });
    server.middlewares.use("/rsvp-state", (_, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(saves.length ? saves[saves.length - 1] : "null");
    });
    server.middlewares.use("/api/reader/rsvp/file", (_, res) => {
      res.setHeader("Content-Type", "application/epub+zip");
      res.end(file);
    });
    server.middlewares.use("/api/", (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        if (body && req.url.includes("/state")) saves.push(body);
        if (req.url.includes("dictionary")) lookups.push(JSON.parse(body));
        res.setHeader("Content-Type", "application/json");
        if (req.url.includes("/flags")) {
          let saved;
          if (req.method === "PUT") {
            flagWrites++;
            const input = JSON.parse(body);
            saved = flags.find(
              (f) => f.cfi === input.cfi && f.endCfi === input.endCfi,
            );
            if (!saved) {
              saved = {
                ...input,
                id: String(flags.length + 1),
                bookId: "rsvp",
                reviewed: false,
                createdAt: new Date().toISOString(),
              };
              flags.push(saved);
            }
          }
          res.end(JSON.stringify({ status: "success", data: saved || flags }));
          return;
        }
        if (req.url.includes("/annotations")) {
          const item = body ? { ...JSON.parse(body), id: "note-1" } : null;
          if (item) annotations.push(item);
          res.end(JSON.stringify({ status: "success", data: item || [] }));
          return;
        }
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              entry: {
                word: "reading",
                headword: "reading",
                source: "Fixture",
                senses: [
                  {
                    id: "1",
                    partOfSpeech: "verb",
                    meanings: ["שלום"],
                    explanations: [],
                    definition: "",
                    examples: [],
                    labels: [],
                  },
                ],
              },
              lookupCount: 1,
            },
          }),
        );
      });
    });
    server.middlewares.use("/rsvp-test", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/rsvp-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100dvh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-rsvp.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    const browser = process.env.RSVP_WEBKIT
      ? await webkit.launch()
      : await chromium.launch({
          channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
        });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 844 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls.local[0] + "rsvp-test");
      await page.waitForFunction(() => window.rsvpTest?.reader.locationsReady);
      await page
        .getByRole("button", { name: "Sentence Mode", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.sentence &&
          !window.rsvpTest.reader.sentenceMode.busy,
      );
      const settle = async () =>
        page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
      await settle();
      const lines = async () =>
        page.evaluate(() => {
          const root = document.querySelector(".reader-sentence-text"),
            origin = root.getBoundingClientRect();
          const lines = [];
          root
            .querySelectorAll("[data-sentence-word]")
            .forEach((word, index) => {
              const rect = word.getBoundingClientRect();
              let line = lines.find(
                (line) => Math.abs(line.top - (rect.top - origin.top)) < 4,
              );
              if (!line) {
                line = { top: rect.top - origin.top, words: [] };
                lines.push(line);
              }
              line.words.push({
                index,
                left: rect.left - origin.left,
                right: rect.right - origin.left,
              });
            });
          return lines.sort((a, b) => a.top - b.top);
        });
      const closest = (line, x) =>
        line.words.reduce((best, word) =>
          Math.max(word.left - x, 0, x - word.right) <
          Math.max(best.left - x, 0, x - best.right)
            ? word
            : best,
        ).index;
      const active = async () =>
        page.evaluate(() =>
          [...document.querySelectorAll("[data-sentence-word]")].indexOf(
            document.querySelector(".reader-sentence-word-active"),
          ),
        );
      const click = async (index) =>
        page.locator("[data-sentence-word]").nth(index).click();
      let geometry = await lines();
      assert.ok(
        geometry.length >= 3,
        "Real text must wrap across multiple visual lines",
      );
      const initial =
        geometry[0].words[Math.floor(geometry[0].words.length * 0.7)];
      const targetX = (initial.left + initial.right) / 2;
      await click(initial.index);
      for (let line = 1; line < geometry.length; line++) {
        const handled = await page.evaluate(() => {
          const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
          });
          document.body.dispatchEvent(event);
          return event.defaultPrevented;
        });
        assert.equal(
          handled,
          true,
          "Visual navigation prevents browser scrolling",
        );
        assert.equal(
          await active(),
          closest(geometry[line], targetX),
          "Down preserves the horizontal goal",
        );
      }
      for (let line = geometry.length - 2; line >= 0; line--) {
        await page.keyboard.press("ArrowUp");
        assert.equal(
          await active(),
          closest(geometry[line], targetX),
          "Up preserves the same horizontal goal",
        );
      }
      // Crossing sentences resets alignment and selects the first/last logical word.
      const edge = geometry[geometry.length - 1].words[0];

      await click(edge.index);
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 2 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      let next = await lines();
      assert.equal(
        await active(),
        0,
        "Down enters the next sentence at its first word",
      );
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 3 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      next = await lines();
      assert.equal(
        await active(),
        0,
        "Down enters a longer sentence at its first word",
      );
      const newFirst = next[0].words.find((word) => word.index === 0);
      const newX = (newFirst.left + newFirst.right) / 2;
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(next[1], newX),
        "Alignment restarts from the first word of the new sentence",
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(await active(), 0);

      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 2 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      next = await lines();
      assert.equal(
        await active(),
        (await page.locator("[data-sentence-word]").count()) - 1,
        "Up enters the previous sentence at its last word",
      );
      await page.keyboard.press("Control+ArrowLeft");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 1 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      assert.equal(
        await active(),
        0,
        "Ctrl+Left selects the previous sentence start",
      );
      await page.keyboard.press("Control+ArrowRight");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 2 &&
          !!document.querySelector(".reader-sentence-word-active"),
      );
      assert.equal(await active(), 0);
      await page.keyboard.press("Control+ArrowRight");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 3 &&
          !!document.querySelector(".reader-sentence-word-active"),
      );
      await page.keyboard.press("Control+ArrowRight");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.chapterTitle === "B" &&
          document.querySelector(".reader-sentence-word-active"),
      );
      assert.equal(
        await active(),
        0,
        "Ctrl sentence navigation crosses spine boundaries",
      );
      geometry = await lines();
      const chapterOrigin =
        geometry[0].words[Math.floor(geometry[0].words.length / 2)];
      await click(chapterOrigin.index);
      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.chapterTitle === "A" &&
          window.rsvpTest.reader.sentenceMode.number === 3 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      geometry = await lines();
      assert.equal(
        await active(),
        (await page.locator("[data-sentence-word]").count()) - 1,
        "Up crosses chapters at the previous sentence last word",
      );
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.chapterTitle === "B" &&
          document.querySelector(".reader-sentence-word-active"),
      );
      geometry = await lines();
      assert.equal(
        await active(),
        0,
        "Down crosses chapters at the next sentence first word",
      );
      // Horizontal movement resets the goal to the newly marked word.
      await click(geometry[1].words[1].index);
      await page.keyboard.press("ArrowRight");
      const horizontal = await active();
      const horizontalWord = geometry
        .flatMap((line) => line.words)
        .find((word) => word.index === horizontal);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(geometry[2], (horizontalWord.left + horizontalWord.right) / 2),
      );
      // No repeated glyph measurements while the same layout remains valid.
      await page.evaluate(() => {
        window.geometryReads = 0;
        const original = Range.prototype.getClientRects;
        Range.prototype.getClientRects = function () {
          window.geometryReads++;
          return original.call(this);
        };
      });
      await click(geometry[0].words[0].index);
      await settle();
      await page.keyboard.press("ArrowDown");
      const reads = await page.evaluate(() => window.geometryReads);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.evaluate(() => window.geometryReads),
        reads,
        "Consecutive keys reuse measured lines",
      );
      await page.setViewportSize({ width: 760, height: 680 });
      await settle();
      geometry = await lines();
      assert.ok(geometry.length >= 3);
      let chosen = geometry[0].words[Math.floor(geometry[0].words.length / 2)];
      await click(chosen.index);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(geometry[1], (chosen.left + chosen.right) / 2),
        "Resize invalidates geometry",
      );
      await page.evaluate(() => {
        document.querySelector(".reader-sentence-text").style.fontSize = "22px";
      });
      await settle();
      geometry = await lines();
      chosen = geometry[0].words[Math.floor(geometry[0].words.length / 2)];
      await click(chosen.index);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(geometry[1], (chosen.left + chosen.right) / 2),
        "Font-size changes invalidate geometry",
      );
      const cfi = await page.evaluate(
        () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
      );
      await page.getByRole("button", { name: "Ask AI", exact: true }).click();
      const input = page.locator('textarea[id^="reader-chat-question"]');
      await input.first().focus();
      await input.first().fill("Typing is protected");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Control+ArrowRight");
      assert.equal(
        await page.evaluate(
          () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
        ),
        cfi,
        "Typing controls never navigate the book",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(() => window.rsvpTest.reader.sentenceMode.active),
        true,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
