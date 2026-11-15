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
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head><body><p>Hello, <em>read</em>ing<a role="doc-noteref" href="note.xhtml#n57"><sup>57</sup></a> world.<a role="doc-noteref" href="note.xhtml#n58">58</a> Next sentence!</p><p>Last paragraph.</p><p>Line<br/>break.</p><p hidden="hidden">Hidden text</p><script>bad()</script></body></html>',
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
    try {
      for (const mobile of [false, true])
        await t.test(mobile ? "iPhone viewport" : "desktop", async () => {
          saves.length = 0;
          flags.length = 0;
          flagWrites = 0;
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
            await page.addInitScript(() =>
              localStorage.setItem(
                "roza-sentence-word-steps",
                JSON.stringify({ ArrowRight: 9, ArrowLeft: 9 }),
              ),
            );
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
            await page.waitForFunction(
              () => window.rsvpTest.reader.flags.ready,
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
            assert.deepEqual(
              extraction.mapped.map((text) => text.replace(/57|58/g, "")),
              extraction.texts,
            );
            assert.equal(
              extraction.mapped[0],
              "Hello, reading57 world.58",
              "Original EPUB range keeps its source location",
            );
            const markers = await page
              .locator(".reader-sentence-note")
              .evaluateAll((elements) =>
                elements.map((el) => ({
                  text: el.textContent,
                  tag: el.tagName,
                  disabled: el.getAttribute("aria-disabled"),
                  opacity: Number(getComputedStyle(el).opacity),
                  size: parseFloat(getComputedStyle(el).fontSize),
                  parentSize: parseFloat(
                    getComputedStyle(
                      document.querySelector(".reader-sentence-text"),
                    ).fontSize,
                  ),
                  href: el.getAttribute("href"),
                })),
              );
            assert.deepEqual(
              markers.map((m) => m.text),
              ["57", "58"],
            );
            assert.ok(
              markers.every(
                (m) =>
                  m.tag === "SUP" &&
                  m.disabled === "true" &&
                  m.opacity < 0.6 &&
                  m.size < m.parentSize &&
                  m.href === null,
              ),
            );
            assert.deepEqual(
              await page.locator("[data-sentence-word]").allTextContents(),
              ["Hello", "reading", "world"],
            );
            await page
              .locator(".reader-sentence-note")
              .first()
              .click({ force: true });
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.sentenceMode.sentence.text,
              ),
              "Hello, reading world.",
            );
            const semantics = await page.evaluate(() => {
              const doc = new DOMParser().parseFromString(
                '<html><body><p>Number <a href="chapter.xhtml#p57">57</a>, formula x<sup>2</sup>, note<a href="#fn9"><sup>9</sup></a> stays.</p></body></html>',
                "text/html",
              );
              return window.rsvpTest.sentenceService
                .extractReaderSentences({
                  document: doc,
                  cfiFromRange: (range) => range.toString(),
                })
                .map((s) => ({ text: s.text, notes: s.notes }));
            });
            assert.equal(
              semantics[0].text,
              "Number 57, formula x2, note stays.",
            );
            assert.deepEqual(
              semantics[0].notes.map((n) => n.text),
              ["9"],
            );
            const rangeMapping = await page.evaluate(async () => {
              const { readerSentenceSelectionRange } = await import(
                "/frontend/src/services/readerSentenceSelectionRange.ts"
              );
              const doc = new DOMParser().parseFromString(
                '<p>A  <em>word</em><a role="doc-noteref" href="#n57">57</a>\n\tphrase.</p>',
                "text/html",
              );
              const range = doc.createRange();
              range.selectNodeContents(doc.querySelector("p"));
              return [
                readerSentenceSelectionRange(range, 2, 13)?.toString(),
                readerSentenceSelectionRange(range, 3, 5)?.toString(),
                readerSentenceSelectionRange(range, 2, 6)?.toString(),
                readerSentenceSelectionRange(range, 0, 100),
              ];
            });
            assert.deepEqual(rangeMapping, [
              "word57\n\tphrase",
              "or",
              "word",
              null,
            ]);

            await page.keyboard.press("Escape");
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.sentenceMode.active,
              ),
              true,
            );
            assert.equal(
              await page
                .getByRole("button", { name: "Translate", exact: true })
                .isDisabled(),
              true,
            );
            assert.equal(
              await page
                .getByRole("button", { name: "Copy", exact: true })
                .isDisabled(),
              false,
            );
            await page
              .getByRole("button", { name: "Copy", exact: true })
              .click();
            assert.equal(
              await page.evaluate(() => window.copied),
              "Hello, reading world.",
            );
            if (!mobile)
              await page.evaluate(() =>
                document.body.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "כ",
                    code: "KeyF",
                    bubbles: true,
                    cancelable: true,
                  }),
                ),
              );
            else
              await page
                .getByRole("button", { name: "Flag", exact: true })
                .click();
            await page.waitForFunction(() =>
              window.rsvpTest.reader.flags.items.some(
                (item) => item.text === "Hello, reading world.",
              ),
            );
            if (!mobile) await page.keyboard.press("Shift+A");
            else
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
            await page.keyboard.press("Escape");
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
            await page.keyboard.press("Escape");
            const selectSentence = async () => {
              await page.evaluate(() => {
                const root = document.querySelector(".reader-sentence-text");
                const range = document.createRange();
                range.selectNodeContents(root);
                const native = window.getSelection();
                native.removeAllRanges();
                native.addRange(range);
                document.dispatchEvent(new Event("selectionchange"));
              });
              await page.waitForFunction(
                () => !document.querySelector('[data-shortcut="t"]').disabled,
              );
            };
            await selectSentence();
            await page.keyboard.press("f");
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.panel),
              null,
            );
            const reflow = await page.evaluate(() => {
              const text =
                "Janis’s questioning of her mother’s conformity intensified as she sought knowledge and affirmation from this older iconoclastic group.";
              const paragraph = document.createElement("div");
              paragraph.className = "reader-sentence-text";
              paragraph.style.cssText =
                "position:absolute;left:-10000px;top:0;max-width:none";
              const parts = text.split(
                /([\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*)/gu,
              );
              parts.forEach((part, index) => {
                if (index % 2 === 0)
                  paragraph.append(document.createTextNode(part));
                else {
                  const word = document.createElement("span");
                  word.textContent = part;
                  paragraph.append(word);
                }
              });
              document.body.append(paragraph);
              const words = [...paragraph.querySelectorAll("span")];
              const positions = () =>
                words.map((word) => {
                  const rect = word.getBoundingClientRect();
                  return [rect.x, rect.y, rect.width, rect.height];
                });
              const changed = [];
              for (const width of [650, 620, 580, 390, 320])
                for (const fontSize of [28, 43]) {
                  paragraph.style.width = width + "px";
                  paragraph.style.fontSize = fontSize + "px";
                  const before = JSON.stringify(positions());
                  for (const word of words) {
                    word.className = "reader-sentence-word-active";
                    word.style.backgroundColor = "#cbb4ed";
                    if (JSON.stringify(positions()) !== before)
                      changed.push({ width, fontSize, word: word.textContent });
                    word.className = "";
                    word.style.backgroundColor = "";
                  }
                }
              paragraph.remove();
              return changed;
            });
            assert.deepEqual(
              reflow,
              [],
              "Word highlighting must preserve every word position and line break",
            );
            const cfi = await page.evaluate(
              () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
            );
            assert.equal(
              await page
                .getByRole("button", { name: "Back", exact: true })
                .isDisabled(),
              true,
            );
            if (mobile) {
              const lookupsBeforeFlag = lookups.length;
              await page.locator("[data-sentence-word]").nth(2).tap();
              assert.equal(
                await page
                  .locator(".reader-sentence-word-active")
                  .textContent(),
                "world",
                "Touch focuses the word before flagging",
              );
              await page
                .getByRole("button", { name: "Flag", exact: true })
                .tap();
              await page.waitForFunction(() =>
                window.rsvpTest.reader.flags.items.some(
                  (f) => f.text === "world",
                ),
              );
              assert.equal(
                await page
                  .locator(".reader-sentence-word-active")
                  .textContent(),
                "world",
              );
              assert.equal(lookups.length, lookupsBeforeFlag);
            }
            if (!mobile) {
              const activeWord = page.locator(".reader-sentence-word-active");
              await page.keyboard.press("Control+ArrowLeft"); // Explicitly clear the initial whole-sentence selection.
              await page.keyboard.press("ArrowRight");
              assert.equal(await activeWord.textContent(), "Hello");
              await page.keyboard.press("ArrowRight");
              assert.equal(await activeWord.textContent(), "reading");
              const lookupsBeforeFlag = lookups.length;
              await page.keyboard.press("Control+s");
              await page.waitForFunction(() =>
                window.rsvpTest.reader.flags.items.some(
                  (f) => f.text === "reading",
                ),
              );
              assert.equal(await activeWord.textContent(), "reading");
              assert.equal(
                await page.evaluate(async () => {
                  const { reader } = window.rsvpTest;
                  const flag = reader.flags.items.find(
                    (f) => f.text === "reading",
                  );
                  return (
                    await reader.searchBook.getRange(flag.cfi)
                  ).toString();
                }),
                "reading",
              );
              assert.equal(
                flags.find((f) => f.text === "reading").context,
                "Hello, reading world.",
              );
              const writes = flagWrites;
              await page.keyboard.press("f");
              await page.waitForTimeout(100);

              assert.equal(flagWrites, writes);
              assert.equal(flags.filter((f) => f.text === "reading").length, 1);
              assert.equal(lookups.length, lookupsBeforeFlag);
              await page.keyboard.press("ArrowLeft");
              assert.equal(await activeWord.textContent(), "Hello");
              await page.keyboard.press("ArrowLeft");
              assert.equal(await activeWord.textContent(), "Hello");
              await page.keyboard.press("ArrowRight");
              await page.keyboard.press("ArrowRight");
              assert.equal(await activeWord.textContent(), "world");
              await page.keyboard.press("ArrowRight");
              await page.waitForFunction(
                () =>
                  window.rsvpTest.reader.sentenceMode.sentence.text ===
                  "Next sentence!",
              );
              assert.equal(await activeWord.textContent(), "Next");
              await page.keyboard.press("ArrowLeft");
              await page.waitForFunction(
                () =>
                  window.rsvpTest.reader.sentenceMode.sentence.text ===
                  "Hello, reading world.",
              );
              assert.equal(await activeWord.textContent(), "world");
              assert.equal(
                await page.evaluate(
                  () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
                ),
                cfi,
              );
              assert.equal(
                await page.locator(".reader-sentence-text").textContent(),
                "Hello, reading57 world.58",
              );
              await page.keyboard.down("ArrowLeft");
              assert.equal(
                await activeWord.textContent(),
                "reading",
                "Left moves on keydown before release",
              );
              await page.keyboard.down("ArrowLeft");
              assert.equal(await activeWord.textContent(), "Hello");
              await page.keyboard.down("ArrowLeft");
              await page.keyboard.up("ArrowLeft");
              assert.equal(await activeWord.textContent(), "Hello");
              await page.keyboard.down("ArrowRight");
              assert.equal(
                await activeWord.textContent(),
                "reading",
                "Right moves on keydown before release",
              );
              await page.keyboard.down("ArrowRight");
              assert.equal(await activeWord.textContent(), "world");
              await page.keyboard.down("ArrowRight");
              await page.keyboard.up("ArrowRight");
              assert.equal(await activeWord.textContent(), "world");
              assert.equal(
                await page.evaluate(
                  () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
                ),
                cfi,
                "Holding a word arrow stops at the sentence edge",
              );
              const selectionText = async () =>
                page.evaluate(() => {
                  const native = window.getSelection();
                  if (!native?.rangeCount || native.isCollapsed) return "";
                  const fragment = native.getRangeAt(0).cloneContents();
                  fragment
                    .querySelectorAll(".reader-sentence-note")
                    .forEach((note) => note.remove());
                  return fragment.textContent.trim();
                });
              await page.keyboard.press("Shift+ArrowLeft");
              assert.equal(await selectionText(), "reading world");
              await page.keyboard.press("ArrowRight");
              assert.equal(
                await activeWord.textContent(),
                "world",
                "Right resumes at the active end of the backward selection",
              );
              await page.keyboard.press("Shift+ArrowLeft");
              await page.keyboard.press("ArrowLeft");
              assert.equal(
                await activeWord.textContent(),
                "Hello",
                "Left continues before the active end, instead of restarting at the final word",
              );
              await page.keyboard.press("ArrowRight");
              assert.equal(await activeWord.textContent(), "reading");
              await page.keyboard.press("Shift+ArrowRight");
              assert.equal(await selectionText(), "reading world");
              await page.keyboard.press("ArrowLeft");
              assert.equal(
                await activeWord.textContent(),
                "reading",
                "Left resumes at the active end of the forward selection",
              );
              await page.keyboard.press("Control+ArrowLeft");
              await page.keyboard.press("ArrowLeft");
              assert.equal(await activeWord.textContent(), "world");
              await page.keyboard.press("Control+ArrowLeft");
              await page.keyboard.down("ArrowRight");
              assert.equal(await activeWord.textContent(), "Hello");
              await page.keyboard.press("6");
              assert.equal(
                await activeWord.textContent(),
                "Hello",
                "Numbers do not alter the mark or configure navigation",
              );
              await page.keyboard.down("ArrowRight");
              assert.equal(await activeWord.textContent(), "reading");
              await page.keyboard.up("ArrowRight");
              assert.equal(
                await activeWord.textContent(),
                "reading",
                "Release does not add another step",
              );
              await page.keyboard.press("ArrowLeft");
              assert.equal(await activeWord.textContent(), "Hello");
              const markedText = async () =>
                page.evaluate(() => {
                  const native = window.getSelection();
                  if (!native?.rangeCount || native.isCollapsed) return "";
                  const fragment = native.getRangeAt(0).cloneContents();
                  fragment
                    .querySelectorAll(".reader-sentence-note")
                    .forEach((note) => note.remove());
                  return fragment.textContent.trim();
                });
              await page.keyboard.press("Shift+ArrowRight");
              assert.equal(await markedText(), "Hello, reading");
              const styleBefore = await page
                .locator("[data-sentence-word]")
                .evaluateAll((words) =>
                  words.map((word) => {
                    const r = word.getBoundingClientRect();
                    return [r.x, r.y, r.width, r.height];
                  }),
                );
              await page.evaluate(() => {
                const reader = window.rsvpTest.reader;
                reader.updateState({
                  preferences: {
                    ...reader.state.preferences,
                    selectionColor: "#cbb4ed",
                    selectionTextColor: "#302b26",
                  },
                });
              });
              await page.waitForFunction(
                () =>
                  getComputedStyle(
                    document.querySelector("[data-sentence-word]"),
                    "::selection",
                  ).backgroundColor === "rgb(203, 180, 237)",
              );
              const multiwordStyle = await page
                .locator("[data-sentence-word]")
                .first()
                .evaluate((word) => {
                  const style = getComputedStyle(word, "::selection");
                  return {
                    background: style.backgroundColor,
                    text: style.color,
                  };
                });
              assert.deepEqual(multiwordStyle, {
                background: "rgb(203, 180, 237)",
                text: "rgb(48, 43, 38)",
              });
              assert.equal(await markedText(), "Hello, reading");
              assert.deepEqual(
                await page
                  .locator("[data-sentence-word]")
                  .evaluateAll((words) =>
                    words.map((word) => {
                      const r = word.getBoundingClientRect();
                      return [r.x, r.y, r.width, r.height];
                    }),
                  ),
                styleBefore,
                "Selection colors do not change word positions",
              );

              assert.equal(await page.locator(".reader-dictionary").count(), 0);
              await page.keyboard.press("c");
              assert.equal(
                await page.evaluate(() => window.copied),
                "Hello, reading",
              );
              await page.keyboard.press("Shift+ArrowRight");
              assert.equal(await markedText(), "Hello, reading world");
              await page.keyboard.press("Shift+ArrowLeft");
              assert.equal(await markedText(), "Hello, reading");
              await page.keyboard.press("Shift+ArrowLeft");
              assert.equal(await markedText(), "Hello,");
              await page.keyboard.press("Shift+ArrowLeft");
              assert.equal(await markedText(), "");
              assert.equal(
                await page
                  .getByRole("button", { name: "Translate", exact: true })
                  .isDisabled(),
                true,
              );
              await page.keyboard.press("Control+ArrowLeft");
              await page.keyboard.press("ArrowLeft");
              assert.equal(await activeWord.textContent(), "world");
              await page.keyboard.press("Shift+ArrowLeft");
              assert.equal(await markedText(), "reading world");
              await page.keyboard.press("Shift+ArrowRight");
              assert.equal(await markedText(), "world");
            }
            await page.keyboard.press("Control+ArrowRight");
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence.text ===
                "Next sentence!",
            );
            assert.equal(
              await page.locator(".reader-sentence-word-active").textContent(),
              "Next",
            );
            if (!mobile) {
              await page.locator("[data-sentence-word]").last().click();
              assert.equal(
                await page
                  .locator(".reader-sentence-word-active")
                  .textContent(),
                "sentence",
              );
            }
            await page.keyboard.press("Control+ArrowLeft");
            await page.waitForFunction(
              () =>
                window.rsvpTest.reader.sentenceMode.sentence.text ===
                "Hello, reading world.",
            );
            await page.waitForFunction(() => document.querySelector('.reader-sentence-word-active')?.textContent === 'Hello');
            assert.equal(
              await page.getByRole("button", { name: "Translate", exact: true }).isDisabled(),
              false,
              "Sentence navigation clears the old range and focuses the new sentence start",
            );
            if (!mobile) {
              const words = page.locator("[data-sentence-word]");
              await page.evaluate(() => {
                const reader = window.rsvpTest.reader;
                reader.updateState({
                  preferences: {
                    ...reader.state.preferences,
                    translationColor: "#99cc88",
                    translationTextColor: "#223344",
                  },
                });
              });
              await words.nth(1).dblclick();
              await page.waitForFunction(
                () => !document.querySelector('[data-shortcut="t"]').disabled,
              );
              assert.equal(
                await page.locator(".reader-dictionary").count(),
                0,
                "Mouse selection does not open lookup",
              );
              await page.evaluate(() =>
                document.body.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "א",
                    code: "KeyT",
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                  }),
                ),
              );
              await page.getByText("שלום", { exact: true }).first().waitFor();
              assert.equal(lookups.at(-1).word, "reading");
              assert.equal(lookups.at(-1).passage, false);
              await page.keyboard.press("Escape");
              await page.waitForFunction(
                () =>
                  document.querySelector(".reader-sentence-translated")
                    ?.textContent === "reading",
              );
              assert.deepEqual(
                await page
                  .locator(".reader-sentence-translated")
                  .first()
                  .evaluate((el) => {
                    const s = getComputedStyle(el);
                    return { background: s.backgroundColor, color: s.color };
                  }),
                { background: "rgb(153, 204, 136)", color: "rgb(34, 51, 68)" },
              );
              assert.equal(
                await page
                  .getByRole("button", { name: "Translate", exact: true })
                  .isDisabled(),
                true,
                "Translated word remains painted while no active selection is required for other actions",
              );
              await page.keyboard.press("ArrowRight");
              assert.equal(
                await page
                  .locator(".reader-sentence-word-active")
                  .textContent(),
                "world",
                "Closing translation preserves the selected word cursor",
              );
              assert.equal(
                await page
                  .locator(".reader-sentence-translated")
                  .first()
                  .textContent(),
                "reading",
                "Translation marking survives moving the active word",
              );
              const first = await words.nth(1).boundingBox();
              const last = await words.nth(2).boundingBox();
              await page.mouse.move(first.x + 0.5, first.y + first.height / 2);
              await page.mouse.down();
              await page.mouse.move(
                last.x + last.width - 0.5,
                last.y + last.height / 2,
                { steps: 12 },
              );
              await page.mouse.up();
              await page.waitForFunction(
                () => !document.querySelector('[data-shortcut="t"]').disabled,
              );
              assert.equal(await page.locator(".reader-dictionary").count(), 0);
              await page
                .getByRole("button", { name: "Copy", exact: true })
                .click();
              assert.equal(
                await page.evaluate(() => window.copied),
                "reading world",
              );
              await page
                .getByRole("button", { name: "Flag", exact: true })
                .click();
              await page.waitForFunction(() =>
                window.rsvpTest.reader.flags.items.some(
                  (f) => f.text === "reading world",
                ),
              );
              const phraseRange = await page.evaluate(async () => {
                const { reader } = window.rsvpTest;
                const flag = reader.flags.items.find(
                  (f) => f.text === "reading world",
                );
                return (await reader.searchBook.getRange(flag.cfi)).toString();
              });
              assert.equal(phraseRange, "reading57 world");
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
                "reading world",
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
                "reading world",
              );
              await page.keyboard.press("Escape");
            }
            await selectSentence();
            if (!mobile) await page.keyboard.press("c");
            else
              await page
                .getByRole("button", { name: "Copy", exact: true })
                .click();
            assert.equal(
              await page.evaluate(() => window.copied),
              "Hello, reading world.",
            );
            if (!mobile) await page.keyboard.press("t");
            else
              await page
                .getByRole("button", { name: "Translate", exact: true })
                .click();
            await page.getByText("שלום", { exact: true }).first().waitFor();
            assert.equal(lookups.at(-1).word, "Hello, reading world.");
            assert.equal(lookups.at(-1).passage, true);
            assert.equal(lookups.at(-1).provider, "google");
            assert.equal(lookups.at(-1).location, cfi);
            await page.keyboard.press("Escape");
            await page.waitForFunction(
              () => !document.querySelector(".reader-dictionary"),
            );
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.sentenceMode.active,
              ),
              true,
            );
            if (!mobile) await page.keyboard.press("n");
            else
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
            await page.waitForFunction(() => document.activeElement?.id === "reader-annotation-note");
            await page.locator("#reader-annotation-note").fill("tacnf");
            assert.equal(
              await page.evaluate(() => window.rsvpTest.reader.panel),
              "annotations",
            );
            assert.equal(await page.locator(".reader-dictionary").count(), 0);
            assert.equal(
              await page.locator("#reader-annotation-note").inputValue(),
              "tacnf",
            );
            await page.locator("#reader-annotation-note").fill("Sentence note");
            await page.keyboard.press("Control+ArrowDown"); // Flag checkbox
            await page.keyboard.press("Control+ArrowDown"); // Save
            await page.keyboard.press("ArrowUp");
            await page.keyboard.press("Control+ArrowUp"); // Back to the note
            assert.equal(await page.evaluate(() => document.activeElement?.id), "reader-annotation-note");
            await page.keyboard.press("Control+Enter"); // Activate the selected Save action
            await page.waitForFunction(
              () => !window.rsvpTest.reader.annotations.draft,
            );
            assert.equal(annotations.at(-1).text, "Hello, reading world.");
            assert.equal(annotations.at(-1).cfi, cfi);
            await page.keyboard.press("Escape");
            await page.waitForFunction(() => !window.rsvpTest.reader.panel);
            await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Annotate");
            assert.equal(
              await page.evaluate(
                () => window.rsvpTest.reader.sentenceMode.active,
              ),
              true,
            );
            assert.equal(
              await page
                .getByRole("button", { name: "More", exact: true })
                .count(),
              0,
            );
            if (!mobile) await page.keyboard.press("a");
            else
              await page
                .getByRole("button", { name: "Ask AI", exact: true })
                .click();
            await page.waitForFunction(
              () => window.rsvpTest.reader.panel === "chat",
            );
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            assert.equal(
              await page.evaluate(() =>
                document.activeElement?.matches(
                  'textarea[id^="reader-chat-question"]',
                ),
              ),
              true,
              "Ask AI focuses the question input instead of the close button",
            );
            await page
              .locator('textarea[id^="reader-chat-question"]:focus')
              .fill("Explain this sentence");
            assert.equal(
              await page
                .locator('textarea[id^="reader-chat-question"]:focus')
                .inputValue(),
              "Explain this sentence",
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
            const assertFits = async () => {
              const geometry = await page.evaluate(() => {
                const selectors = [
                  ".reader-sentence-stage",
                  ".reader-sentence-text",
                  ".reader-sentence-mode",
                ];
                return selectors.map((selector) => {
                  const el = document.querySelector(selector);
                  return {
                    selector,
                    height: el.clientHeight,
                    scrollHeight: el.scrollHeight,
                    width: el.clientWidth,
                    scrollWidth: el.scrollWidth,
                  };
                });
              });
              for (const rect of geometry) {
                assert.ok(rect.height > 0);
                assert.ok(
                  rect.scrollHeight <= rect.height + 1,
                  JSON.stringify(rect),
                );
                assert.ok(
                  rect.scrollWidth <= rect.width + 1,
                  JSON.stringify(rect),
                );
              }
            };
            await assertFits();
            const controls = await page
              .locator(".reader-sentence-controls")
              .evaluate((el) => {
                const nav = [
                  ...el.querySelectorAll(".reader-sentence-nav button"),
                ].map((b) => b.getBoundingClientRect().top);
                const actions = [
                  ...el.querySelectorAll(".reader-sentence-actions button"),
                ].map((b) => b.getBoundingClientRect().top);
                return {
                  nav,
                  actions,
                  labels: [
                    ...el.querySelectorAll(".reader-sentence-actions span"),
                  ].map((e) => getComputedStyle(e).display),
                };
              });
            if (mobile) {
              assert.ok(controls.nav[0] < controls.nav[1]);
              assert.ok(controls.labels.every((d) => d === "none"));
            } else {
              assert.equal(controls.nav[0], controls.nav[1]);
              assert.ok(
                controls.actions.every((y) => y === controls.actions[0]),
              );
            }
            // Exercise the real component with short, long and very long sentences.
            const original = await page.evaluate(
              () => window.rsvpTest.reader.sentenceMode.sentence.text,
            );
            let anchored;
            for (const length of [1, 80, 200]) {
              await page.evaluate((length) => {
                const reader = window.rsvpTest.reader;
                reader.sentenceMode.sentence.text =
                  Array(length)
                    .fill(
                      "A longer sentence needs to remain inside the reading area",
                    )
                    .join(", ") + ".";
                reader.updateState({ progress: reader.state.progress });
              }, length);
              await page.evaluate(
                () =>
                  new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
              );
              await assertFits();
              const tops = await page.evaluate(() =>
                [".reader-sentence-chapter", ".reader-sentence-text"].map(
                  (selector) =>
                    document.querySelector(selector).getBoundingClientRect()
                      .top,
                ),
              );
              if (anchored) assert.deepEqual(tops, anchored);
              else anchored = tops;
            }
            await page.evaluate((original) => {
              const reader = window.rsvpTest.reader;
              reader.sentenceMode.sentence.text = original;
              reader.updateState({ progress: reader.state.progress });
            }, original);
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
