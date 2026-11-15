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
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">sentence-navigation</dc:identifier><dc:title>Sentence navigation</dc:title><dc:language>en</dc:language></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
  );
  for (let chapter = 0; chapter < 2; chapter++)
    zip.file(
      chapter ? "b.xhtml" : "a.xhtml",
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${chapter + 1}</title></head><body>${Array.from({ length: 44 }, (_, index) => `<p id="s${index}">Sentence ${chapter + 1} number ${index + 1} describes a careful reader walking beside the river while remembering the distant mountains and every conversation shared during a long and peaceful afternoon.</p>`).join("")}</body></html>`,
    );
  return zip.generateAsync({ type: "nodebuffer" });
}

test(
  "Sentence Mode CFI restoration, entry anchors, keyboard chord and Escape precedence",
  { timeout: 180000 },
  async t => {
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
      "react-router-dom",
      "@tanstack/react-query",
      "epubjs",
      "react-icons",
      "i18next",
      "react-i18next",
      "axios",
    ].map(name => ({
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
        "frontend/node_modules/.vite-sentence-navigation-test",
      ),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: {
        entries: ["scripts/fixtures/reader-sentence-navigation.tsx"],
      },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
    });
    const file = await epub();
    const saved = [];
    const flags = [];
    server.middlewares.use(
      "/api/reader/sentence-navigation/file",
      (_req, res) => {
        res.setHeader("Content-Type", "application/epub+zip");
        res.end(file);
      },
    );
    server.middlewares.use("/api/", (req, res) => {
      let body = "";
      req.on("data", chunk => (body += chunk));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        const input = body ? JSON.parse(body) : null;
        let data = {};
        if (req.url.includes("/state")) {
          if (input) saved.push(input);
          data = input || {};
        } else if (req.url.includes("keyboard-settings"))
          data = { unit: "words", count: 1 };
        else if (req.url.includes("/flags")) {
          if (req.method === "PUT") {
            const flag = {
              ...input,
              id: String(flags.length + 1),
              bookId: "sentence-navigation",
              reviewed: false,
              createdAt: new Date().toISOString(),
            };
            flags.push(flag);
            data = flag;
          } else data = flags;
        } else if (req.url.includes("/annotations")) data = [];
        else if (req.url.includes("/conversations")) data = { items: [] };
        else if (req.url.includes("/review"))
          data = { flags, vocabulary: [], books: [] };
        else if (req.url.includes("/dictionary"))
          data = {
            entry: {
              word: input.word,
              headword: input.word,
              source: "Fixture",
              senses: [
                {
                  id: "1",
                  partOfSpeech: "noun",
                  meanings: ["translation"],
                  explanations: [],
                  definition: "",
                  examples: [],
                  labels: [],
                },
              ],
            },
            lookupCount: 1,
          };
        res.end(JSON.stringify({ status: "success", data }));
      });
    });
    server.middlewares.use("/sentence-navigation-test", async (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/sentence-navigation-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100dvh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-sentence-navigation.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    const browser =
      process.env.SENTENCE_BROWSER === "webkit"
        ? await webkit.launch()
        : await chromium.launch({
            channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
          });
    try {
      for (const mobile of [false, true])
        await t.test(
          (mobile ? "iPhone viewport " : "desktop ") +
            (process.env.SENTENCE_BROWSER === "webkit" ? "WebKit" : "Chrome"),
          async () => {
            const context = await browser.newContext({
              viewport: { width: mobile ? 390 : 1280, height: 844 },
              isMobile: mobile,
              hasTouch: mobile,
            });
            const page = await context.newPage();
            page.setDefaultTimeout(12000);
            const errors = [];
            page.on("pageerror", error => errors.push(error.message));
            await page.goto(
              server.resolvedUrls.local[0] + "sentence-navigation-test",
            );
            await page.waitForFunction(
              () =>
                window.sentenceNavigationTest?.reader.locationsReady &&
                !window.sentenceNavigationTest.reader.loading,
            );
            await page.waitForFunction(() => window.sentenceNavigationTest.reader.totalPages > 2);
            const previews = await page.evaluate(async () => {
              const { reader } = window.sentenceNavigationTest;
              const results = [];
              for (const progress of [0, .1, .25, .5, .75, .9, 1]) {
                const cached = reader.getProgressDestination(progress);
                const cfi = reader.searchBook.locations.cfiFromPercentage(progress);
                const exact = await reader.describeLocation(cfi);
                results.push({ progress, cached, exact: exact?.label, synchronous: typeof cached === 'string' });
              }
              return results;
            });
            for (const preview of previews) {
              assert.equal(preview.synchronous, true, JSON.stringify(preview));
              assert.equal(preview.cached, preview.exact, JSON.stringify(preview));
            }

            await page.evaluate(() => window.sentenceNavigationTest.reader.pageNavigation.go('2', 'screen'));
            await page.waitForFunction(() => window.sentenceNavigationTest.reader.pageLabel.startsWith('Page 2 '));
            assert.equal(await page.evaluate(() => window.sentenceNavigationTest.reader.searchBook.spine.get(window.sentenceNavigationTest.reader.state.location).index), 0);
            await page.evaluate(() => window.sentenceNavigationTest.reader.pageNavigation.go('1', 'screen'));
            await page.waitForFunction(() => window.sentenceNavigationTest.reader.pageLabel.startsWith('Page 1 '));
            const settle = () =>
              page.evaluate(
                () =>
                  new Promise(resolve =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
              );
            const active = () =>
              page.evaluate(
                () => window.sentenceNavigationTest.reader.sentenceMode.active,
              );
            const sentence = () =>
              page.evaluate(
                () =>
                  window.sentenceNavigationTest.reader.sentenceMode.sentence
                    .cfi,
              );
            const enter = async () => {
              await page.getByRole("button", { name: "Reader menu", exact: true }).click();
              await page
                .getByRole("button", { name: "Sentence Mode", exact: true })
                .click();
              await page.waitForFunction(
                () =>
                  window.sentenceNavigationTest.reader.sentenceMode.active &&
                  !!window.sentenceNavigationTest.reader.sentenceMode
                    .sentence &&
                  !window.sentenceNavigationTest.reader.sentenceMode.busy,
              );
            };
            const advance = async (direction, count) => {
              for (let i = 0; i < count; i++) {
                const before = await sentence();
                await page
                  .getByRole("button", {
                    name: direction > 0 ? "Next" : "Back",
                    exact: true,
                  })
                  .click();
                await page.waitForFunction(
                  cfi =>
                    window.sentenceNavigationTest.reader.sentenceMode.sentence
                      .cfi !== cfi &&
                    !window.sentenceNavigationTest.reader.sentenceMode.busy,
                  before,
                );
              }
            };
            const restored = async cfi => {
              await page.waitForFunction(
                () =>
                  !window.sentenceNavigationTest.reader.sentenceMode.active &&
                  !window.sentenceNavigationTest.reader.sentenceMode.busy,
              );
              await page.waitForFunction(
                cfi => window.sentenceNavigationTest.visible(cfi),
                cfi,
              );
              await settle();
              assert.equal(
                await page.evaluate(cfi => {
                  const { reader, EpubCFI } = window.sentenceNavigationTest;
                  const expected = new EpubCFI(cfi),
                    actual = new EpubCFI(reader.state.location);
                  expected.collapse(true);
                  actual.collapse(true);
                  return expected.toString() === actual.toString();
                }, cfi),
                true,
                "Persisted location remains at the exact displayed sentence",
              );
            };
            const select = async cfi => {
              await page.evaluate(
                cfi => window.sentenceNavigationTest.selectCfi(cfi),
                cfi,
              );
              await page.waitForFunction(
                () => !!window.sentenceNavigationTest.reader.textSelection,
              );
            };
            await enter();
            await advance(1, 25);
            const forward = await sentence();
            const stale = await page.evaluate(() =>
              window.sentenceNavigationTest.sourceCfi(0, 0),
            );
            await page.evaluate(
              location =>
                window.sentenceNavigationTest.reader.updateState({
                  location,
                  progress: 0,
                }),
              stale,
            );
            await page
              .getByRole("button", { name: "Close sentence mode", exact: true })
              .click();
            await restored(forward);
            await select(forward);
            await enter();
            assert.equal(
              await sentence(),
              forward,
              "A Page Mode selection starts in its containing sentence",
            );
            await advance(-1, 12);
            const backward = await sentence();
            await page.keyboard.press("Escape");
            await restored(backward);
            // Both exits use the same sentence CFI and renderer-resolved page.
            await select(backward);
            await enter();
            await page
              .getByRole("button", { name: "Close sentence mode", exact: true })
              .click();
            await restored(backward);
            const nearBoundary = await page.evaluate(() =>
              window.sentenceNavigationTest.sourceCfi(0, 40),
            );
            await page.evaluate(
              cfi => window.sentenceNavigationTest.reader.returnTo(cfi),
              nearBoundary,
            );
            await page.waitForFunction(
              cfi => window.sentenceNavigationTest.visible(cfi),
              nearBoundary,
            );
            await select(nearBoundary);
            await enter();
            await advance(1, 8);
            const across = await sentence();
            assert.equal(
              await page.evaluate(
                () =>
                  new window.sentenceNavigationTest.EpubCFI(
                    window.sentenceNavigationTest.reader.sentenceMode.sentence.cfi,
                  ).spinePos,
              ),
              1,
            );
            await page.evaluate(async () => {
              const { reader: r, sourceCfi } = window.sentenceNavigationTest;
              const stale = await sourceCfi(0, 0);
              r.updateState({
                location: stale,
                progress: 0,
                preferences: { ...r.state.preferences, fontSize: 28 },
              });
            });
            await page.setViewportSize({
              width: mobile ? 430 : 1030,
              height: 760,
            });
            await page
              .getByRole("button", { name: "Close sentence mode", exact: true })
              .click();
            await restored(across);
            await page.evaluate(async () => {
              const r = window.sentenceNavigationTest.reader;
              await r.searchBook.rendition.q.enqueue(() => Promise.resolve());
              await r.searchBook.rendition.reportLocation();
              await r.retrySave();
            });
            await restored(across);
            assert.equal(
              saved.at(-1).location,
              across,
              "Font/layout restoration persists the active sentence instead of the stale preference CFI",
            );

            await select(across);
            await enter();
            await advance(-1, 8);
            const backAcross = await sentence();
            assert.equal(
              await page.evaluate(
                () =>
                  new window.sentenceNavigationTest.EpubCFI(
                    window.sentenceNavigationTest.reader.sentenceMode.sentence.cfi,
                  ).spinePos,
              ),
              0,
            );
            await page.keyboard.press("Escape");
            await restored(backAcross);
            // Without a selection, entry starts at the first sentence intersecting the rendered page.
            await page.evaluate(() =>
              window.sentenceNavigationTest.reader.closeLookup(),
            );
            const firstVisible = await page.evaluate(async () => {
              const { reader, sourceCfi, visible } =
                window.sentenceNavigationTest;
              const section = reader.location.start.index;
              for (let i = 0; i < 44; i++) {
                const cfi = await sourceCfi(section, i);
                if (visible(cfi, true)) return cfi;
              }
            });
            await enter();
            assert.equal(
              await sentence(),
              firstVisible,
              "Unselected entry uses the current screen page, not a stored book page",
            );
            // Escape dismisses lookup, then selection, then Sentence Mode.
            await page.locator("[data-sentence-word]").first().click();
            await page
              .getByRole("button", { name: "Translate", exact: true })
              .click();
            await page
              .getByRole("button", {
                name: "Pronounce English word",
                exact: true,
              })
              .waitFor();
            await page.keyboard.press("Escape");
            assert.equal(await active(), true);
            assert.equal(await page.locator(".reader-dictionary").count(), 0);
            await page.locator("[data-sentence-word]").first().click();
            await page.keyboard.press("Escape");
            assert.equal(await active(), true);
            assert.equal(
              await page.locator(".reader-sentence-word-active").count(),
              0,
            );
            await page.evaluate(() => {
              const words = document.querySelectorAll("[data-sentence-word]");
              const first = document.createTreeWalker(words[0], 4).nextNode(),
                last = document.createTreeWalker(words[1], 4).nextNode();
              const range = document.createRange();
              range.setStart(first, 0);
              range.setEnd(last, last.textContent.length);
              const native = window.getSelection();
              native.removeAllRanges();
              native.addRange(range);
              document.dispatchEvent(new Event("selectionchange"));
            });
            await page.waitForFunction(
              () => !document.querySelector('[data-shortcut="t"]').disabled,
            );
            await page.keyboard.press("Escape");
            assert.equal(await active(), true);
            assert.equal(
              await page.evaluate(() => window.getSelection().isCollapsed),
              true,
              "Escape clears native text selection before leaving Sentence Mode",
            );

            const escapeTarget = await sentence();
            await page.keyboard.press("Escape");
            await restored(escapeTarget);
            if (!mobile) {
              await select(escapeTarget);
              const beforeFlags = flags.length;
              await page.keyboard.down("Control");
              await page.keyboard.press("s");
              await page.keyboard.press("m");
              await page.keyboard.up("Control");
              await page.waitForFunction(
                () =>
                  window.sentenceNavigationTest.reader.sentenceMode.active &&
                  !window.sentenceNavigationTest.reader.sentenceMode.busy,
              );
              assert.equal(await sentence(), escapeTarget);
              assert.equal(
                flags.length,
                beforeFlags,
                "Ctrl+S+M does not save a flag",
              );
              await page
                .getByRole("button", {
                  name: "Close sentence mode",
                  exact: true,
                })
                .click();
              await restored(escapeTarget);
              await select(escapeTarget);
              await page.keyboard.press("Control+s");
              await page.waitForFunction(
                count =>
                  window.sentenceNavigationTest.reader.flags.items.length >
                  count,
                beforeFlags,
              );
              assert.equal(
                flags.length,
                beforeFlags + 1,
                "Standalone Ctrl+S still saves for later",
              );
              await select(escapeTarget);
              const beforeMetaFlags = flags.length;
              await page.keyboard.down("Meta");
              await page.keyboard.press("s");
              await page.keyboard.press("m");
              await page.keyboard.up("Meta");
              await page.waitForFunction(
                () =>
                  window.sentenceNavigationTest.reader.sentenceMode.active &&
                  !window.sentenceNavigationTest.reader.sentenceMode.busy,
              );
              assert.equal(await sentence(), escapeTarget);
              assert.equal(
                flags.length,
                beforeMetaFlags,
                "Cmd+S+M opens Sentence Mode without saving a flag",
              );
              await page
                .getByRole("button", {
                  name: "Close sentence mode",
                  exact: true,
                })
                .click();
              await restored(escapeTarget);
              await page.evaluate(() => {
                window.sentenceNavigationTest.reader.closeLookup();
                document
                  .querySelector(".reader-viewport iframe")
                  .contentWindow.focus();
              });
              await page.keyboard.press("Escape");
              for (let i = 0; i < 4; i++)
                await page.keyboard.press("ArrowRight");
              await page.waitForSelector(".reader-keyboard-word");
              const keyboardSentence = await page.evaluate(() => {
                const { reader, EpubCFI, extractReaderSentences } =
                  window.sentenceNavigationTest;
                const annotation = Object.values(
                  reader.searchBook.rendition.annotations._annotations,
                ).find(item => item.className === "reader-keyboard-word");
                const focus = new EpubCFI(annotation.cfiRange);
                focus.collapse(true);
                const compare = new EpubCFI().compare;
                const section = reader.searchBook.spine.get(
                  annotation.cfiRange,
                );
                return extractReaderSentences(section).find(item => {
                  const start = new EpubCFI(item.cfi),
                    end = new EpubCFI(item.cfi);
                  start.collapse(true);
                  end.collapse(false);
                  return (
                    compare(start.toString(), focus.toString()) <= 0 &&
                    compare(focus.toString(), end.toString()) < 0
                  );
                }).cfi;
              });
              assert.equal(
                await page.evaluate(
                  () =>
                    document
                      .querySelector(".reader-viewport iframe")
                      .contentDocument.getSelection().isCollapsed,
                ),
                true,
              );
              const beforeWordFlags = flags.length;
              await page.keyboard.down("Control");
              await page.keyboard.press("s");
              await page.keyboard.press("m");
              await page.keyboard.up("Control");
              await page.waitForFunction(
                () =>
                  window.sentenceNavigationTest.reader.sentenceMode.active &&
                  !window.sentenceNavigationTest.reader.sentenceMode.busy,
              );
              assert.equal(
                await sentence(),
                keyboardSentence,
                "Keyboard word focus starts Sentence Mode at its containing sentence",
              );
              assert.equal(flags.length, beforeWordFlags);
              await page
                .getByRole("button", {
                  name: "Close sentence mode",
                  exact: true,
                })
                .click();
              await restored(keyboardSentence);
            }
            assert.deepEqual(errors, []);
            await context.close();
          },
        );
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
