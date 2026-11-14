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
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head><body><p>Hello, <em>read</em>ing world. Next sentence!</p><p>Last paragraph.</p><p>Line<br/>break.</p><p hidden="hidden">Hidden text</p><script>bad()</script></body></html>',
  );
  zip.file(
    "note.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Note</title></head><body><p>Footnote</p></body></html>',
  );
  zip.file(
    "b.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>Second chapter starts here. Boardinghouse. Pneumonoultramicroscopicsilicovolcanoconiosis WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW</p></body></html>',
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "Sentence Mode real EPUB: exact ranges, actions, chapter navigation, persistence and mobile",
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
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
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
    try {
      for (const mobile of [false, true])
        await t.test(mobile ? "iPhone viewport" : "desktop", async () => {
          saves.length = 0;
          const browser = process.env.RSVP_WEBKIT
            ? await webkit.launch()
            : await chromium.launch({
                channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
              });
          try {
            const context = await browser.newContext({
              viewport: { width: mobile ? 390 : 1280, height: 844 },
              isMobile: mobile,
              hasTouch: mobile,
            });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (e) => errors.push(e.message));
            await page.goto(server.resolvedUrls.local[0] + "rsvp-test");
            await page.waitForFunction(
              () => window.rsvpTest?.reader.locationsReady,
            );
            await page.evaluate(() => {
              window.copied = "";
              Object.defineProperty(navigator, "clipboard", {
                value: {
                  writeText: async (text) => {
                    window.copied = text;
                  },
                },
                configurable: true,
              });
            });
            await page
              .getByRole("button", { name: "Sentence Mode", exact: true })
              .click();
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence?.text ===
                "Hello, reading world.",
            );
            const extraction = await page.evaluate(async () => {
              const { reader, sentenceService } = window.rsvpTest;
              const items = sentenceService.extractReaderSentences(
                reader.searchBook.spine.get(0),
              );
              return {
                texts: items.map((x) => x.text),
                mapped: await Promise.all(
                  items.map(async (x) =>
                    (await reader.searchBook.getRange(x.cfi)).toString(),
                  ),
                ),
              };
            });
            assert.deepEqual(extraction.texts, [
              "Hello, reading world.",
              "Next sentence!",
              "Last paragraph.",
              "Line",
              "break.",
            ]);
            assert.deepEqual(extraction.mapped, extraction.texts);
            const cfi = await page.evaluate(
              () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
            );
            assert.equal(
              await page
                .getByRole("button", { name: "Back", exact: true })
                .isDisabled(),
              true,
            );
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowLeft");
            await page
              .getByRole("button", { name: "Copy", exact: true })
              .click();
            assert.equal(
              await page.evaluate(() => window.copied),
              "Hello, reading world.",
            );
            await page
              .getByRole("button", { name: "Translate", exact: true })
              .click();
            await page.getByText("שלום", { exact: true }).first().waitFor();
            assert.equal(lookups.at(-1).word, "Hello, reading world.");
            assert.equal(lookups.at(-1).passage, true);
            assert.equal(lookups.at(-1).provider, "google");
            assert.equal(lookups.at(-1).location, cfi);
            await page.getByRole("button", { name: /close/i }).last().click();
            await page
              .getByRole("button", { name: "Annotate", exact: true })
              .click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.panel === "annotations",
            );
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.annotations.draft.text,
              ),
              "Hello, reading world.",
            );
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.annotations.draft.cfi,
              ),
              cfi,
            );
            await page.locator("#reader-annotation-note").fill("Sentence note");
            await page
              .locator(".reader-annotation-actions button[type=submit]")
              .click();
            await page.waitForFunction(
              () => !window.rsvpTest.reader.annotations.draft,
            );
            assert.equal(annotations.at(-1).text, "Hello, reading world.");
            assert.equal(annotations.at(-1).cfi, cfi);
            await page.evaluate(() => window.rsvpTest.reader.closePanel());
            await page
              .getByRole("button", { name: "More", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Copy selected text", exact: true })
              .click();
            assert.equal(
              await page.evaluate(() => window.copied),
              "Hello, reading world.",
            );
            await page.keyboard.press("Escape");
            await page
              .getByRole("button", { name: "Ask AI", exact: true })
              .click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.panel === "chat",
            );
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.chat.passage.text,
              ),
              "Hello, reading world.",
            );
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.chat.passage.cfi,
              ),
              cfi,
            );
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.chat.spoilersAllowed,
              ),
              false,
            );
            await page.evaluate(() => window.rsvpTest.reader.closePanel());
            await page
              .getByRole("button", { name: "Next", exact: true })
              .click();
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence.text ===
                "Next sentence!",
            );
            const anchor = await page.evaluate(
              () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
            );
            await page
              .getByRole("button", { name: "Close sentence mode", exact: true })
              .click();
            await page.waitForFunction(
              () => !window.rsvpTest.reader.sentenceMode.active,
            );
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.state.location),
              anchor,
            );
            await page
              .getByRole("button", { name: "Sentence Mode", exact: true })
              .click();
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence?.text ===
                "Next sentence!",
            );
            for (let i = 0; i < 4; i++)
              await page
                .getByRole("button", { name: "Next", exact: true })
                .click();
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence?.text ===
                "Second chapter starts here.",
            );
            await page
              .getByRole("button", { name: "Back", exact: true })
              .click();
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence?.text === "break.",
            );
            await page
              .getByRole("button", { name: "Next", exact: true })
              .click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.sentenceMode.chapterTitle === "B",
            );
            await page
              .getByRole("button", { name: "Next", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Next", exact: true })
              .click();
            assert.equal(
              await page
                .getByRole("button", { name: "Next", exact: true })
                .isDisabled(),
              true,
            );
            if (mobile) {
              assert.ok(
                await page
                  .locator(".reader-sentence-stage")
                  .evaluate((el) => el.scrollHeight > el.clientHeight),
              );
              await page
                .locator(".reader-sentence-stage")
                .evaluate((el) => (el.scrollTop = el.scrollHeight));
            }
            const bounds = await page
              .locator(".reader-sentence-controls")
              .evaluate((el) => {
                const r = el.getBoundingClientRect();
                return {
                  bottom: r.bottom,
                  right: r.right,
                  scroll: document.documentElement.scrollWidth,
                  width: innerWidth,
                  height: innerHeight,
                };
              });
            assert.ok(bounds.bottom <= bounds.height + 1);
            assert.ok(bounds.scroll <= bounds.width);
            assert.ok(bounds.right <= bounds.width);
            if (mobile) {
              await page.setViewportSize({ width: 320, height: 568 });
              await page.waitForTimeout(100);
              assert.ok(
                await page
                  .locator(".reader-sentence-controls")
                  .evaluate(
                    (el) =>
                      el.getBoundingClientRect().bottom <= innerHeight + 1,
                  ),
              );
            }
            await page.screenshot({
              path: path.join(
                root,
                "sentence-" +
                  (process.env.RSVP_WEBKIT ? "webkit-" : "edge-") +
                  (mobile ? "mobile" : "desktop") +
                  ".png",
              ),
            });
            await page
              .getByRole("button", { name: "Close sentence mode", exact: true })
              .click();
            await page.waitForFunction(
              () => !window.rsvpTest.reader.sentenceMode.active,
            );
            await page.waitForFunction(
              () => window.rsvpTest.reader.href === "b.xhtml",
            );
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.chapter),
              "Section 3",
            );
            const savedCfi = await page.evaluate(
              () => window.rsvpTest.reader.state.location,
            );
            await page.waitForTimeout(1300);
            await page.reload();
            await page.waitForFunction(
              () => window.rsvpTest?.reader.locationsReady,
            );
            await page
              .getByRole("button", { name: "Sentence Mode", exact: true })
              .click();
            await page.waitForFunction(
              () => !window.rsvpTest.reader.sentenceMode.busy,
            );
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.state.location),
              savedCfi,
            );
            assert.deepEqual(errors, []);
          } finally {
            await browser.close();
          }
        });
    } finally {
      await server.close();
    }
  },
);
