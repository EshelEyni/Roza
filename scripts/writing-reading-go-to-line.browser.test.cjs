const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");

// Ticket #59: Read Mode Go to line. Each paragraph is one numbered line in the gutter.
const paragraphs = Array.from({ length: 80 }, (_, i) =>
  `Line ${i + 1} opens here. It keeps the manuscript moving with ordinary prose for the reader.`);
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

test("reading mode: Ctrl+Shift+G goes to a line", { timeout: 180000 }, async () => {
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

    const dialog = page.getByRole("dialog", { name: "Go to line" });
    const input = dialog.getByLabel("Line number");
    const view = () =>
      editor.evaluate((element) => {
        const scroller = element.closest(".ws-writing");
        const box = scroller.getBoundingClientRect();
        const lines = [...element.querySelectorAll('[data-slate-node="element"]')].map((block) => {
          const rect = block.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        });
        const sentence = [...CSS.highlights.values()].filter((h) => h.priority === 0).flatMap((h) => [...h])
          .find((range) => element.contains(range.startContainer));
        return {
          scrollTop: scroller.scrollTop,
          top: box.top + scroller.clientTop,
          bottom: box.top + scroller.clientTop + scroller.clientHeight,
          lines,
          sentence: sentence?.toString(),
          gutter: [...element.parentElement.querySelectorAll(".ws-line-number")].map((button) => button.textContent),
        };
      });
    const inView = (state, number) => {
      const line = state.lines[number - 1];
      return line.top >= state.top - 1 && line.bottom <= state.bottom + 1;
    };
    const setScroll = (top) => editor.evaluate((element, top) => { element.closest(".ws-writing").scrollTop = top; }, top);

    let state = await view();
    assert.equal(state.gutter.length, 80);
    assert.equal(state.gutter[79], "80");
    await setScroll(1200);
    await editor.focus();
    const start = (await view()).scrollTop;
    assert.ok(start > 0);

    // The shortcut opens the dialog with the line field focused; Escape keeps the position.
    await page.keyboard.press("Control+Shift+G");
    await dialog.waitFor();
    assert.equal(await input.evaluate((element) => element === document.activeElement), true);
    assert.match(await dialog.textContent(), /Lines 1–80/);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal((await view()).scrollTop, start);

    // Blank, zero, out-of-range and fractional numbers keep the dialog open and show the range.
    await page.keyboard.press("Control+Shift+G");
    await dialog.waitFor();
    for (const value of ["", "0", "81", "2.5"]) {
      await input.fill(value);
      await page.keyboard.press("Enter");
      assert.match(await dialog.getByRole("alert").textContent(), /1–80/, value);
      assert.equal(await input.evaluate((element) => element === document.activeElement), true, value);
    }
    assert.equal((await view()).scrollTop, start);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal((await view()).scrollTop, start);

    // A later line: Enter confirms, closes the dialog and brings the line into view.
    await page.keyboard.press("Control+Shift+G");
    await input.fill("70");
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "detached" });
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    state = await view();
    assert.ok(state.scrollTop > start);
    assert.ok(inView(state, 70), JSON.stringify(state.lines[69]));
    assert.equal(state.sentence, "Line 70 opens here.");

    // Reading continues from the jumped-to line.
    await page.keyboard.press("ArrowRight");
    assert.equal((await view()).sentence, "Line 70 opens here.");

    // An earlier line, confirmed with the Go button.
    await page.keyboard.press("Control+Shift+G");
    await input.fill("3");
    await dialog.getByRole("button", { name: "Go" }).click();
    await dialog.waitFor({ state: "detached" });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    state = await view();
    assert.ok(inView(state, 3), JSON.stringify(state.lines[2]));
    assert.equal(state.sentence, "Line 3 opens here.");

    // Outside Read Mode the shortcut is not handled.
    await page.getByRole("button", { name: "Write", exact: true }).click();
    await page.evaluate(() => {
      window.addEventListener("keydown", (event) => {
        if (event.code === "KeyG") window.goToLinePrevented = event.defaultPrevented;
      });
    });
    await editor.focus();
    await page.keyboard.press("Control+Shift+G");
    assert.equal(await page.evaluate(() => window.goToLinePrevented), false);
    assert.equal(await dialog.count(), 0);

    // The URL restores the read tab, audiobook, and the wrapped line context after reload.
    const read = page.getByRole("button", { name: "Read", exact: true });
    const audiobook = page.getByRole("button", { name: "Audiobook", exact: true });
    await read.click();
    await page.keyboard.press("Control+Shift+G");
    await input.fill("40");
    await page.keyboard.press("Enter");
    await page.waitForURL(url => url.searchParams.get("line") === "40");
    await audiobook.click();
    await page.waitForURL(url => url.searchParams.get("audiobook") === "open");
    await page.reload();
    await page.getByRole("region", { name: "Audiobook mini player" }).waitFor();
    assert.equal(await read.getAttribute("aria-pressed"), "true");
    assert.equal((await view()).sentence, "Line 40 opens here.");
    const context = await editor.evaluate(element => {
      const scroller = element.closest(".ws-writing");
      const preceding = element.querySelectorAll('[data-slate-node="element"]')[38];
      const range = document.createRange();
      range.selectNodeContents(preceding);
      return [...range.getClientRects()].at(-1).top - scroller.getBoundingClientRect().top - scroller.clientTop;
    });
    assert.ok(Math.abs(context) <= 2, `Expected the preceding line at the top, got ${context}px`);
    await audiobook.click();
    await page.waitForURL(url => !url.searchParams.has("audiobook"));

    await page.keyboard.press("Escape");
    await setScroll(1700);
    await page.waitForURL(url => Number(url.searchParams.get("line")) > 0 && url.searchParams.get("line") !== "40");
    const scrolledLine = Number(new URL(page.url()).searchParams.get("line"));
    await page.reload();
    await editor.waitFor();
    assert.ok(inView(await view(), scrolledLine));

    for (const [name, tab] of [["Summary", "summary"], ["Chapter Bible", "bible"], ["Write", "write"]]) {
      const button = page.getByRole("button", { name, exact: true });
      await button.click();
      await page.waitForURL(url => url.searchParams.get("tab") === tab);
      await page.reload();
      await button.waitFor();
      assert.equal(await button.getAttribute("aria-pressed"), "true");
    }

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
