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
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>Second chapter starts here.</p></body></html>',
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "RSVP real EPUB: mapping, playback, translation, chapters, persistence and mobile",
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
      for (const mobile of process.env.RSVP_DESKTOP_ONLY
        ? [false]
        : [false, true])
        await t.test(mobile ? "mobile touch" : "desktop", async () => {
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
            await page.getByRole("button", { name: "RSVP Mode" }).click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.word?.text === "Hello,",
            );
            if (process.env.RSVP_SCREENSHOTS)
              await page.screenshot({
                path: path.join(
                  root,
                  "frontend/node_modules",
                  `rsvp-${process.env.RSVP_WEBKIT ? "webkit" : "edge"}-${mobile ? "mobile" : "desktop"}.png`,
                ),
              });
            assert.equal(
              await page
                .locator(".reader-paper")
                .evaluate((el) => getComputedStyle(el).opacity),
              "0",
            );
            assert.equal(
              await page.locator(".reader-paper").getAttribute("inert"),
              "",
            );
            const extraction = await page.evaluate(async () => {
              const { reader, service } = window.rsvpTest;
              const section = reader.searchBook.spine.get(0);
              const words = service.extractRsvpWords(section);
              return {
                texts: words.map((w) => w.text),
                mapped: await Promise.all(
                  words.map(async (w) =>
                    (await reader.searchBook.getRange(w.cfi)).toString(),
                  ),
                ),
                delays: words.slice(0, 3).map((w) => service.rsvpDelay(w, 300)),
                speedLimits: [
                  service.rsvpDelay(words[1], 100),
                  service.rsvpDelay(words[1], 1000),
                  service.rsvpDelay(words[4], 300),
                ],
              };
            });
            assert.deepEqual(extraction.texts, [
              "Hello,",
              "reading",
              "world.",
              "Next",
              "sentence!",
              "Last",
              "paragraph.",
              "Line",
              "break.",
            ]);
            assert.deepEqual(extraction.mapped, extraction.texts);
            assert.deepEqual(extraction.delays, [300, 200, 400]);
            assert.deepEqual(extraction.speedLimits, [600, 60, 500]);
            await page
              .getByRole("button", { name: "Next sentence", exact: true })
              .click();
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.rsvp.word.text),
              "Next",
            );
            await page
              .getByRole("button", { name: "Previous sentence", exact: true })
              .click();
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.rsvp.word.text),
              "Hello,",
            );
            await page
              .getByRole("slider", {
                name: "Reading speed in words per minute",
              })
              .fill("1000");
            await page
              .getByRole("button", { name: "Play", exact: true })
              .click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.word.text !== "Hello,",
            );
            await page
              .getByRole("button", { name: "Pause", exact: true })
              .click();
            const paused = await page.evaluate(
              () => window.rsvpTest.reader.rsvp.word.text,
            );
            await page.waitForTimeout(350);
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.rsvp.word.text),
              paused,
            );
            await page.getByRole("button", { name: /Translate / }).click();
            await page.waitForTimeout(200);
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.rsvp.playing),
              false,
            );
            await page
              .getByRole("button", { name: "Look up in Hebrew", exact: true })
              .click();
            await page.getByText("שלום", { exact: true }).first().waitFor();
            await page
              .getByRole("button", { name: "Google", exact: true })
              .click();
            await page.waitForFunction(
              () => !document.querySelector("[aria-busy=true]"),
            );
            assert.ok(lookups.some((lookup) => lookup.provider === "google"));
            assert.ok(lookups.some((lookup) => lookup.provider === "auto"));
            // Dismiss the existing dictionary popup with its accessible close control.
            await page.getByRole("button", { name: /close/i }).last().click();
            await page.getByLabel("Resume after closing translation").check();
            await page.getByRole("button", { name: /Translate / }).click();
            await page.getByRole("button", { name: /close/i }).last().click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.playing,
            );
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.boundary,
            );
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.rsvp.playing),
              false,
            );
            await page
              .getByRole("button", { name: "Next chapter", exact: true })
              .click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.word?.text === "Second",
            );
            await page
              .getByRole("button", { name: "Next word", exact: true })
              .click();
            const cfi = await page.evaluate(
              () => window.rsvpTest.reader.rsvp.word.cfi,
            );
            await page.setViewportSize({
              width: mobile ? 430 : 1100,
              height: 740,
            });
            await page.waitForTimeout(400);
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.state.location),
              cfi,
            );
            await page
              .getByRole("button", { name: "Normal reading", exact: true })
              .click();
            await page
              .waitForFunction(
                () => !window.rsvpTest.reader.rsvp.active,
                null,
                { timeout: 5000 },
              )
              .catch(async (e) => {
                throw new Error(
                  e.message +
                    " " +
                    JSON.stringify(
                      await page.evaluate(() => ({
                        error: window.rsvpTest.reader.rsvp.error,
                        busy: window.rsvpTest.reader.rsvp.busy,
                      })),
                    ),
                );
              });
            await page.getByRole("button", { name: "RSVP Mode" }).click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.word?.text === "chapter",
            );
            await page.waitForTimeout(1800);
            assert.ok(saves.length > 0);
            assert.equal(JSON.parse(saves[saves.length - 1]).location, cfi);
            const savedWord = await page.evaluate(() =>
              JSON.parse(
                localStorage.getItem("roza-reader:fixture:rsvp") || "null",
              ),
            );
            assert.equal(
              savedWord,
              null,
              "Successful server persistence clears the recovery cache",
            );
            await page.reload();
            await page.waitForFunction(
              () => window.rsvpTest?.reader.locationsReady,
            );
            await page.getByRole("button", { name: "RSVP Mode" }).click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.rsvp.word?.text === "chapter",
            );
            assert.ok(
              await page
                .locator(".reader-rsvp")
                .evaluate((el) => el.scrollWidth <= el.clientWidth),
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
