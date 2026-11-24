const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");

const filler = (i) =>
  `Paragraph ${i} keeps the manuscript moving with ordinary prose. It has a second sentence for company.`;
const wrapped =
  "Mara carried the unopened letter from room to room while the tide came in under the pale windows and the gulls argued over the empty harbour, as though walking could decide for her whether the years inside it were worth reading.";
const oversized = Array.from({ length: 140 }, (_, i) => `clause${i} keeps the long sentence going`).join(", ") + ".";
const finalSentence = "The last light settled on the unopened letter.";
const paragraphs = [
  ...Array.from({ length: 30 }, (_, i) => filler(i)),
  `Before the letter. ${wrapped} After the letter.`,
  ...Array.from({ length: 30 }, (_, i) => filler(30 + i)),
  `Opening words. ${oversized} Closing words.`,
  ...Array.from({ length: 12 }, (_, i) => filler(70 + i)),
  `Almost done. ${finalSentence}`,
];
const book = {
  id: "222222222222222222222222",
  userId: "111111111111111111111111",
  name: "The Shape of Quiet",
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  isArchived: false,
  isReadMode: false,
  filterBy: "chapters",
  characters: [],
  themes: [],
  plotlines: [],
  notes: [],
  chapters: [
    {
      id: "333333333333333333333333",
      bookId: "222222222222222222222222",
      type: "chapters",
      name: "The house by the sea",
      description: [{ type: "paragraph", children: [{ text: "" }] }],
      text: paragraphs.map((text) => ({ type: "paragraph", children: [{ text }] })),
      annotations: [],
    },
  ],
};

test("reading mode keyboard: Page Down limit and sentence-only navigation", { timeout: 180000 }, async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, "frontend/node_modules/vite/dist/node/index.js")));
  const { default: react } = await import(
    pathToFileURL(path.join(root, "frontend/node_modules/@vitejs/plugin-react/dist/index.mjs"))
  );
  const deps = [
    "react", "react-dom", "react-router-dom", "@tanstack/react-query", "slate", "slate-react", "slate-history",
    "@dnd-kit/core", "@dnd-kit/sortable", "react-icons", "i18next", "react-i18next", "axios",
  ];
  const server = await createServer({
    configFile: false,
    appType: "custom",
    root,
    publicDir: path.join(root, "frontend/public"),
    cacheDir: path.join(root, ".studio-test-cache"),
    plugins: [react()],
    css: {
      postcss: {
        plugins: [
          require("../frontend/node_modules/tailwindcss")({
            ...require("../frontend/tailwind.config.cjs"),
            content: [path.join(root, "frontend/src/**/*.{ts,tsx}")],
          }),
          require("../frontend/node_modules/autoprefixer"),
        ],
      },
    },
    resolve: {
      alias: deps.map((name) => ({
        find: name,
        replacement: path.join(root, "frontend/node_modules", name).replaceAll("\\", "/"),
      })),
    },
    optimizeDeps: { entries: ["scripts/fixtures/writing-studio.tsx"] },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
  });
  server.middlewares.use("/api/", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/reader")) return res.end(JSON.stringify({ status: "success", data: { enabled: false } }));
    if (req.url.startsWith("/auth")) {
      return res.end(JSON.stringify({ status: "success", data: { id: book.userId, language: "en" } }));
    }
    res.end(JSON.stringify({ status: "success", data: /^\/book\//.test(req.url) ? book : [book] }));
  });
  server.middlewares.use(async (req, res) => {
    if (req.url.startsWith("/.well-known/")) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      await server.transformIndexHtml(
        req.url,
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/writing-studio.tsx"></script></body></html>',
      ),
    );
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", args: ["--disable-smooth-scrolling"] });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0] + `book-edit/${book.id}/chapters/${book.chapters[0].id}`);
    const editor = page.locator('[aria-label="Manuscript"]');
    await editor.waitFor();
    await page.getByRole("button", { name: "Read", exact: true }).click();
    assert.equal(await editor.getAttribute("contenteditable"), "false");
    await page.evaluate(() => {
      window.addEventListener("keydown", (event) => {
        if (event.key === "PageDown") window.lastPageDownPrevented = event.defaultPrevented;
      });
    });

    // Geometry of the marked sentence relative to the reading scroller and any sticky cover.
    const state = () =>
      editor.evaluate((element) => {
        const scroller = element.closest(".ws-writing");
        const box = scroller.getBoundingClientRect();
        const cover = scroller.querySelector(".test-sticky-cover");
        const viewTop = Math.max(box.top + scroller.clientTop, cover ? cover.getBoundingClientRect().bottom : -Infinity);
        const viewBottom = box.top + scroller.clientTop + scroller.clientHeight;
        const marks = [...CSS.highlights.values()].flatMap((highlight) =>
          [...highlight]
            .filter((range) => element.contains(range.startContainer))
            .map((range) => ({ range, priority: highlight.priority })),
        );
        const sentence = marks.find((mark) => mark.priority === 0)?.range;
        const word = marks.find((mark) => mark.priority === 1)?.range;
        const rects = sentence ? [...sentence.getClientRects()].filter((rect) => rect.height) : [];
        let precedingTop;
        if (sentence) {
          const block = sentence.startContainer.parentElement.closest('[data-slate-node="element"]');
          const precedingText = sentence.cloneRange();
          precedingText.setStart(block.previousElementSibling || block, 0);
          precedingText.setEnd(sentence.startContainer, sentence.startOffset);
          precedingTop = Math.max(-Infinity, ...[...precedingText.getClientRects()]
            .filter(rect => rect.width && rect.height && rect.bottom <= rects[0].top + 1 &&
              rect.height <= rects[0].height + 1)
            .map(rect => rect.top));
        }
        return {
          precedingTop,
          scrollTop: scroller.scrollTop,
          maxScroll: scroller.scrollHeight - scroller.clientHeight,
          clientHeight: scroller.clientHeight,
          viewTop,
          viewBottom,
          sentence: sentence?.toString(),
          word: word?.toString(),
          top: Math.min(...rects.map((rect) => rect.top)),
          bottom: Math.max(...rects.map((rect) => rect.bottom)),
          lastLineTop: Math.max(...rects.map((rect) => rect.top)),
          lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
        };
      });
    const clickWord = async (word) => {
      await editor.evaluate((element, word) => {
        const scroller = element.closest(".ws-writing");
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let leaf = walker.nextNode(); leaf; leaf = walker.nextNode()) {
          const start = leaf.textContent.indexOf(word);
          if (start < 0) continue;
          const range = document.createRange();
          range.setStart(leaf, start);
          range.setEnd(leaf, start + word.length);
          const box = scroller.getBoundingClientRect();
          scroller.scrollTop += range.getBoundingClientRect().top - (box.top + box.height / 2);
          return;
        }
        throw new Error(`Word not found: ${word}`);
      }, word);
      const point = await editor.evaluate((element, word) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let leaf = walker.nextNode(); leaf; leaf = walker.nextNode()) {
          const start = leaf.textContent.indexOf(word);
          if (start < 0) continue;
          const range = document.createRange();
          range.setStart(leaf, start);
          range.setEnd(leaf, start + word.length);
          const rect = range.getClientRects()[0];
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }, word);
      await page.mouse.click(point.x, point.y);
    };
    const placeSentenceTop = (offset) =>
      editor.evaluate((element, offset) => {
        const scroller = element.closest(".ws-writing");
        const sentence = [...CSS.highlights.values()]
          .filter((highlight) => highlight.priority === 0)
          .flatMap((highlight) => [...highlight])
          .find((range) => element.contains(range.startContainer));
        const cover = scroller.querySelector(".test-sticky-cover");
        const top = Math.max(scroller.getBoundingClientRect().top + scroller.clientTop, cover ? cover.getBoundingClientRect().bottom : -Infinity);
        scroller.scrollTop += sentence.getBoundingClientRect().top - (top + offset);
      }, offset);
    const fullyVisible = (s) => s.top >= s.viewTop - 1 && s.bottom <= s.viewBottom + 1;

    // No selection: native Page Down is untouched.
    let before = await state();
    assert.equal(before.sentence, undefined);
    await editor.focus();
    await page.keyboard.press("PageDown");
    await page.waitForFunction((start) => document.querySelector(".ws-writing").scrollTop > start, before.scrollTop);
    assert.equal(await page.evaluate(() => window.lastPageDownPrevented), false);

    // Select a wrapped sentence and place it near the bottom of the pane.
    await clickWord("tide");
    before = await state();
    assert.equal(before.sentence, wrapped);
    assert.equal(before.word, "tide");
    assert.ok(before.lines > 1, "the selected sentence should wrap");
    await placeSentenceTop(before.clientHeight - (before.bottom - before.top) - 4);
    before = await state();
    assert.ok(before.top - before.viewTop > before.clientHeight * 0.875);
    await page.keyboard.press("PageDown");
    let after = await state();
    assert.equal(await page.evaluate(() => window.lastPageDownPrevented), true);
    assert.ok(fullyVisible(after), JSON.stringify(after));
    assert.ok(Math.abs(after.precedingTop - after.viewTop) <= 1);
    const atLimit = after.scrollTop;

    // Repeated presses at the limit keep the position, sentence and word mark.
    for (let i = 0; i < 4; i++) await page.keyboard.press("PageDown");
    after = await state();
    assert.equal(after.scrollTop, atLimit);
    assert.equal(after.sentence, wrapped);
    assert.equal(after.word, "tide");

    // Changing the selection moves the limit.
    await page.keyboard.press("Control+ArrowRight");
    after = await state();
    assert.equal(after.sentence, "After the letter.");
    await page.keyboard.press("PageDown");
    after = await state();
    assert.ok(fullyVisible(after), JSON.stringify(after));
    assert.ok(Math.abs(after.precedingTop - after.viewTop) <= 1);

    // Clearing the selection releases the limit.
    await page.keyboard.press("Escape");
    before = await state();
    assert.equal(before.sentence, undefined);
    await page.keyboard.press("PageDown");
    await page.waitForFunction((start) => document.querySelector(".ws-writing").scrollTop > start + 100, before.scrollTop);
    assert.equal(await page.evaluate(() => window.lastPageDownPrevented), false);

    // A sticky toolbar covering the scroller's top edge reduces the visible area.
    await editor.evaluate((element) => {
      const cover = document.createElement("div");
      cover.className = "test-sticky-cover";
      cover.style.cssText = "position:sticky;top:0;height:72px;z-index:5;background:#ccc";
      const scroller = element.closest(".ws-writing");
      scroller.prepend(cover);
    });
    await clickWord("tide");
    await placeSentenceTop(200);
    await page.keyboard.press("PageDown");
    after = await state();
    assert.ok(fullyVisible(after), JSON.stringify(after));
    assert.ok(Math.abs(after.precedingTop - after.viewTop) <= 1, "stops below the sticky cover");
    await editor.evaluate((element) => element.closest(".ws-writing").querySelector(".test-sticky-cover").remove());

    // An oversized sentence pages through but keeps its last line readable.
    await clickWord("clause10 ");
    before = await state();
    assert.ok(before.sentence.includes("clause0 ") && before.sentence.includes("clause139"), before.sentence.slice(0, 80));
    assert.ok(before.bottom - before.top > before.clientHeight, "sentence should be taller than the reading area");
    for (let i = 0; i < 6; i++) await page.keyboard.press("PageDown");
    after = await state();
    assert.equal(after.sentence, before.sentence);
    assert.ok(after.bottom > after.viewTop, "oversized sentence is still partly visible");
    assert.ok(after.lastLineTop >= after.viewTop - 1, "its last line stays readable");

    // An already partially clipped sentence is not pushed fully out of view.
    await clickWord("tide");
    await placeSentenceTop(-(await state()).lines * 10);
    await page.keyboard.press("PageDown");
    after = await state();
    assert.ok(after.bottom > after.viewTop && after.lastLineTop >= after.viewTop - 1);

    // A resized viewport derives the limit from the new layout.
    await page.setViewportSize({ width: 760, height: 560 });
    await clickWord("tide");
    after = await state();
    assert.ok(after.lines > 2);
    for (let i = 0; i < 3; i++) await page.keyboard.press("PageDown");
    after = await state();
    assert.ok(fullyVisible(after), JSON.stringify(after));
    assert.ok(Math.abs(after.precedingTop - after.viewTop) <= 1);
    await page.setViewportSize({ width: 1365, height: 900 });

    // Near the end of the manuscript the scroll clamps and the sentence stays visible.
    await clickWord("settled");
    await placeSentenceTop(0);
    before = await state();
    assert.ok(fullyVisible(before), JSON.stringify(before));
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("PageDown");
      after = await state();
      assert.ok(fullyVisible(after), JSON.stringify(after));
    }
    assert.equal(after.sentence, finalSentence);
    assert.ok(fullyVisible(after), JSON.stringify(after));
    assert.ok(after.scrollTop >= after.maxScroll - 1 || Math.abs(after.precedingTop - after.viewTop) <= 1);

    // Focus outside the reading surface keeps the browser's own Page Down.
    await clickWord("tide");
    await page.getByLabel("Chapter title").focus();
    await page.keyboard.press("PageDown");
    assert.equal(await page.evaluate(() => window.lastPageDownPrevented), false);
    assert.equal((await state()).sentence, wrapped);

    // Ticket #61: Ctrl+Arrow marks only the destination sentence, with no word highlight.
    const marks = async () => {
      const { sentence, word } = await state();
      return { sentence, word };
    };
    const sentenceColors = () =>
      editor.evaluate((element) =>
        [...CSS.highlights.entries()]
          .filter(([, highlight]) => [...highlight].some((range) => element.contains(range.startContainer)))
          .map(([name]) => {
            const style = getComputedStyle(element.querySelector("[data-slate-string]"), `::highlight(${name})`);
            return [style.backgroundColor, style.color];
          }),
      );
    await clickWord("tide");
    assert.deepEqual(await marks(), { sentence: wrapped, word: "tide" });
    await page.keyboard.press("Control+ArrowRight");
    assert.deepEqual(await marks(), { sentence: "After the letter.", word: undefined });
    assert.deepEqual(await sentenceColors(), [["rgb(216, 195, 165)", "rgb(57, 46, 36)"]]);

    // Right Arrow from a sentence-only mark marks its first word, then follows word navigation.
    await page.keyboard.press("ArrowRight");
    assert.deepEqual(await marks(), { sentence: "After the letter.", word: "After" });
    await page.keyboard.press("ArrowRight");
    assert.deepEqual(await marks(), { sentence: "After the letter.", word: "the" });
    await page.keyboard.press("ArrowLeft");
    assert.deepEqual(await marks(), { sentence: "After the letter.", word: "After" });

    // Left Arrow from a sentence-only mark moves to the previous sentence, across paragraphs.
    await page.keyboard.press("Control+ArrowLeft");
    assert.deepEqual(await marks(), { sentence: wrapped, word: undefined });
    await page.keyboard.press("ArrowLeft");
    assert.deepEqual(await marks(), { sentence: "Before the letter.", word: undefined });
    await page.keyboard.press("ArrowLeft");
    assert.deepEqual(await marks(), { sentence: "It has a second sentence for company.", word: undefined });
    assert.ok((await editor.evaluate((element) => {
      const sentence = [...CSS.highlights.values()].filter((h) => h.priority === 0).flatMap((h) => [...h])
        .find((range) => element.contains(range.startContainer));
      return sentence.startContainer.parentElement.closest('[data-slate-node="element"]').textContent;
    })).startsWith("Paragraph 29 "));
    await page.keyboard.press("ArrowLeft");
    assert.deepEqual(await marks(), {
      sentence: "Paragraph 29 keeps the manuscript moving with ordinary prose.", word: undefined,
    });

    // At the start of the document, Left Arrow keeps the first sentence marked.
    await clickWord("keeps");
    assert.deepEqual(await marks(), { sentence: "Paragraph 0 keeps the manuscript moving with ordinary prose.", word: "keeps" });
    await page.keyboard.press("Control+ArrowRight");
    assert.deepEqual(await marks(), { sentence: "It has a second sentence for company.", word: undefined });
    await page.keyboard.press("ArrowLeft");
    const first = { sentence: "Paragraph 0 keeps the manuscript moving with ordinary prose.", word: undefined };
    assert.deepEqual(await marks(), first);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert.deepEqual(await marks(), first);
    await page.keyboard.press("ArrowRight");
    assert.deepEqual(await marks(), { ...first, word: "Paragraph" });

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
