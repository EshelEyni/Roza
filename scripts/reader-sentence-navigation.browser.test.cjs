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
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">sentence-navigation</dc:identifier><dc:title>Sentence navigation</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
  );
  for (let chapter = 0; chapter < 2; chapter++)
    zip.file(
      chapter ? "b.xhtml" : "a.xhtml",
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${chapter + 1}</title></head><body>${Array.from({ length: 44 }, (_, index) => `<p id="s${index}">Sentence ${chapter + 1} number ${index + 1} describes a careful reader walking beside the river while remembering the distant mountains and every conversation shared during a long and peaceful afternoon.</p>`).join("")}</body></html>`,
    );
  zip.file("nav.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="a.xhtml#s0">Book title</a><ol><li><a href="a.xhtml#s0">Part One</a></li><li><a href="a.xhtml#s22">Part Two</a></li><li><a href="b.xhtml#s22">Part Three</a></li></ol></li></ol></nav></body></html>');
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
            // Contents chapters can share a file and span later files.
            let remainingBeforeSplit;
            for (const [section, sentence, title] of [[0, 10, 'Part One'], [0, 30, 'Part Two'], [1, 10, 'Part Two'], [1, 30, 'Part Three']]) {
              await page.evaluate(async ({ section, sentence }) => {
                const fixture = window.sentenceNavigationTest;
                await fixture.reader.returnTo(await fixture.sourceCfi(section, sentence));
              }, { section, sentence });
              await page.waitForFunction(title => window.sentenceNavigationTest.reader.chapter === title, title);
              await page.waitForFunction(() => window.sentenceNavigationTest.reader.remainingSectionPages !== null);
              const remaining = await page.evaluate(() => window.sentenceNavigationTest.reader.remainingSectionPages);
              if (section === 0 && sentence === 30) remainingBeforeSplit = remaining;
              if (section === 1 && sentence === 10) assert.ok(remaining < remainingBeforeSplit, 'Remaining chapter pages must not reset at a spine-file boundary');
            }
            await page.evaluate(async () => {
              const fixture = window.sentenceNavigationTest;
              return fixture.reader.sentenceMode.toggle(await fixture.sourceCfi(0, 30));
            });
            await page.waitForFunction(() => window.sentenceNavigationTest.reader.sentenceMode.active && !window.sentenceNavigationTest.reader.sentenceMode.busy);
            assert.equal(await page.evaluate(() => window.sentenceNavigationTest.reader.sentenceMode.chapterTitle), 'Part Two');
            assert.equal(await page.evaluate(() => window.sentenceNavigationTest.reader.sentenceMode.count), 44);
            await page.evaluate(() => window.sentenceNavigationTest.reader.sentenceMode.toggle());
            await page.waitForFunction(() => !window.sentenceNavigationTest.reader.sentenceMode.active && !window.sentenceNavigationTest.reader.sentenceMode.busy);
            await page.evaluate(async () => window.sentenceNavigationTest.reader.returnTo(await window.sentenceNavigationTest.sourceCfi(0, 0)));
            const unnamed = await page.evaluate(async () => {
              const { loadReaderChapterItems } = await import('/frontend/src/services/readerChapters.ts');
              const { extractReaderSentences } = await import('/frontend/src/services/readerSentences.ts');
              const book = window.sentenceNavigationTest.reader.searchBook;
              const noContents = { spine: book.spine, navigation: { toc: [] }, loaded: { navigation: Promise.resolve() }, load: book.load.bind(book) };
              const result = await loadReaderChapterItems(noContents, 0, extractReaderSentences);
              return { chapters: result.chapters.length, chapter: result.chapter, count: result.items.length };
            });
            assert.deepEqual(unnamed, { chapters: 0, chapter: null, count: 88 }, 'Books without Contents must not invent spine-file chapters');
            await page.evaluate(() => window.sentenceNavigationTest.reader.togglePanel('contents'));
            await page.getByRole('button', { name: 'Part Two', exact: true }).click();
            await page.waitForFunction(() => window.sentenceNavigationTest.reader.chapter === 'Part Two');
            assert.equal(await page.evaluate(() => window.sentenceNavigationTest.reader.panel), 'contents', 'Contents stays open after navigation');
            await page.getByRole('button', { name: 'Part One', exact: true }).click();
            await page.waitForFunction(() => window.sentenceNavigationTest.reader.chapter === 'Part One');
            assert.equal(await page.locator('.reader-contents button.is-active').count(), 1, 'Only the deepest matching Contents entry is highlighted');
            assert.equal(await page.locator('.reader-contents button.is-active').textContent(), 'Part One');
            await page.evaluate(() => { window.dispatchEvent(new Event('blur')); document.activeElement.blur(); window.dispatchEvent(new Event('focus')); });
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !window.sentenceNavigationTest.reader.panel);
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
            const footer = page.locator('.reader-sentence-controls');
            assert.deepEqual(await footer.locator('.reader-sentence-actions span').allTextContents(), ['Translate', 'Ask AI', 'Copy', 'Note', 'Flag', 'Set target']);
            const checkFooter = async () => {
              const layout = await footer.evaluate(el => {
                const actions = [...el.querySelectorAll('.reader-sentence-actions button')].map(b => b.getBoundingClientRect());
                const progress = el.querySelector('.reader-sentence-progress').getBoundingClientRect();
                const nav = [...el.querySelectorAll('.reader-sentence-nav button')].map(b => b.getBoundingClientRect());
                return { actionRow: actions.every(r => Math.abs(r.top - actions[0].top) <= 1), rowOrder: progress.bottom <= actions[0].top && actions[0].bottom <= nav[0].top, navRow: Math.abs(nav[0].top - nav[1].top) <= 1, width: el.clientWidth, scrollWidth: el.scrollWidth };
              });
              assert.equal(layout.actionRow && layout.rowOrder && layout.navRow, true, JSON.stringify(layout));
              assert.ok(layout.scrollWidth <= layout.width + 1, JSON.stringify(layout));
            };
            await checkFooter();
            if (mobile) {
              await page.setViewportSize({width: 320, height: 700});
              await checkFooter();
              await page.setViewportSize({width: 390, height: 844});
            }
            if (process.env.SENTENCE_FOOTER_SCREENSHOTS) await page.screenshot({path: path.join(process.env.SENTENCE_FOOTER_SCREENSHOTS, mobile ? 'sentence-footer-mobile.png' : 'sentence-footer-desktop.png')});
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
