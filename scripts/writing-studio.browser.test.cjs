async function chooseWorkspace(page, name) {
  const selector = page.getByRole("combobox", { name: "Manuscript category", includeHidden: true });
  await selector.waitFor({ state: "attached" });
  if (!(await selector.isVisible())) await page.locator(".ws-mobile-nav").click();
  await selector.click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function toggleOverview(page) {
  const current = await page.getByRole("combobox", { name: "Manuscript category", includeHidden: true }).innerText();
  await chooseWorkspace(page, current.includes("Chapter Overview") ? "Chapters" : "Chapter Overview");
}
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const paragraph = (text) => [{ type: "paragraph", children: [{ text }] }];
const initial = {
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
      description: paragraph(
        "A homecoming. Late autumn. The letter is still unopened.",
      ),
      text: paragraph(
        "When Mara returned to the coast, the house was exactly as she remembered it. The windows held the pale afternoon light, and somewhere beyond the garden wall, the sea kept its own time.\n\nShe set her suitcase beside the door. For a moment, she let herself believe that nothing had changed.",
      ),
    },
    {
      id: "444444444444444444444444",
      bookId: "222222222222222222222222",
      type: "chapters",
      name: "An unopened letter",
      description: paragraph(""),
      text: paragraph(
        "The letter had waited twenty years. One more morning would not hurt.",
      ),
    },
  ],
};
test(
  "writing studio real components: library, editing, saves, recovery, organization, export and responsive layouts",
  { timeout: 180000 },
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
    const deps = [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "slate",
      "slate-react",
      "slate-history",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "react-icons",
      "i18next",
      "react-i18next",
      "axios",
    ];
    const server = await createServer({
      configFile: false,
      appType: "custom",
      publicDir: path.join(root, "frontend/public"),
      root,
      cacheDir: path.join(root, ".studio-test-cache"),
      plugins: [react()],
      publicDir: path.join(root, "frontend/public"),
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
          replacement: path
            .join(root, "frontend/node_modules", name)
            .replaceAll("\\", "/"),
        })),
      },
      optimizeDeps: { entries: ["scripts/fixtures/writing-studio.tsx"] },
      server: {
        host: "127.0.0.1",
        port: 0,
        fs: { allow: [root, "C:/dev/Roza/frontend/node_modules"] },
      },
    });
    let saved = structuredClone(initial),
      fail = false,
      delay = 0,
      saveCount = 0;
    const books = [saved];
    server.middlewares.use("/api/", async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url.startsWith("/reader"))
        return res.end(
          JSON.stringify({ status: "success", data: { enabled: false } }),
        );
      if (req.url.startsWith("/auth"))
        return res.end(
          JSON.stringify({
            status: "success",
            data: { id: initial.userId, language: "en" },
          }),
        );
      if (req.method === "PATCH" || req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const incoming = JSON.parse(raw);
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (fail) {
          res.statusCode = 503;
          return res.end(
            JSON.stringify({ message: "Test network unavailable" }),
          );
        }
        saveCount++;
        if (req.method === "POST") {
          saved = {
            ...incoming,
            id: "555555555555555555555555",
            updatedAt: new Date().toISOString(),
          };
          books.push(saved);
        } else {
          if (incoming.updatedAt !== saved.updatedAt) {
            res.statusCode = 409;
            return res.end(
              JSON.stringify({
                message: "This manuscript changed in another session.",
              }),
            );
          }
          saved = { ...incoming, updatedAt: new Date().toISOString() };
          books[books.findIndex((b) => b.id === saved.id)] = saved;
        }
        return res.end(JSON.stringify({ status: "success", data: saved }));
      }
      res.end(
        JSON.stringify({
          status: "success",
          data: /^\/book\//.test(req.url)
            ? books.find((b) => req.url.includes(b.id))
            : books.filter((b) => !b.isArchived),
        }),
      );
    });
    server.middlewares.use(async (req, res) => {
      if (req.url.startsWith("/.well-known/")) { res.statusCode = 404; return res.end(); }
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
    const screenshots = path.join(root, "docs/writing-studio/screenshots");
    fs.mkdirSync(screenshots, { recursive: true });
    try {
      browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
      });
      const page = await browser.newPage({
        viewport: { width: 1365, height: 900 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("dialog", (dialog) => {
        if (dialog.type() === "beforeunload") { void dialog.accept(); return; }
        errors.push("Unexpected native confirmation");
        void dialog.dismiss();
      });
      const base = server.resolvedUrls.local[0];
      await page.goto(base + "books");
      await page
        .getByRole("link", { name: "Write The Shape of Quiet", exact: true })
        .waitFor();
      await page.screenshot({
        path: path.join(screenshots, "library-desktop.png"),
      });
      await page
        .getByRole("link", { name: "Details for The Shape of Quiet" })
        .click();
      await page
        .getByRole("heading", { name: "The Shape of Quiet", exact: true })
        .waitFor();
      assert.equal(
        await page.locator(".ws-book-stats dd").first().innerText(),
        "63",
      );
      await page
        .getByRole("button", { name: "Rename book", exact: true })
        .click();
      await page
        .getByLabel("Book title", { exact: true })
        .fill("The Shape of Quiet — revised");
      fail = true;
      await page
        .getByRole("button", { name: "Save title", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Test network unavailable" })
        .waitFor();
      assert.ok(
        await page
          .getByRole("heading", { name: "The Shape of Quiet", exact: true })
          .isVisible(),
      );
      fail = false;
      await page
        .getByRole("button", { name: "Save title", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "The Shape of Quiet — revised",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", { name: "Characters 0", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "A place for your ideas.", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Chapters 2", exact: true })
        .click();
      await page.getByLabel("Search book contents").fill("unopened");
      assert.equal(await page.locator(".ws-content-list > li").count(), 1);
      await page.getByLabel("Search book contents").fill("");
      assert.equal(
        await page.evaluate(() => {
          window.scrollTo(0, 100);
          return document.scrollingElement.scrollTop > 0;
        }),
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(screenshots, "book-overview-desktop.png"),
      });
      await page
        .getByRole("link", { name: /The house by the sea When Mara/ })
        .click();
      await page
        .getByRole("heading", { name: "The house by the sea", exact: true })
        .waitFor();
      assert.ok(
        (await page.locator(".ws-preview").first().innerText()).includes(
          "When Mara",
        ),
      );
      const pdfEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download chapter PDF", exact: true })
        .click();
      assert.ok((await pdfEvent).suggestedFilename().includes("The house"));
      await page
        .getByRole("link", { name: "All chapters", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Read manuscript", exact: true })
        .click();
      assert.equal(await page.locator(".ws-reading-page").count(), 2);
      await page
        .getByRole("button", { name: "Back to overview", exact: true })
        .click();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: path.join(screenshots, "book-overview-mobile.png"),
      });
      await page
        .getByRole("link", { name: "Continue writing →", exact: true })
        .click();
      await page.setViewportSize({ width: 1365, height: 900 });
      const editor = page.locator('[aria-label="Manuscript"]');
      await editor.waitFor();
      await page.screenshot({
        path: path.join(screenshots, "studio-desktop.png"),
      });

      // One selector owns every manuscript workspace, including browser history.
      const selector = page.getByRole("combobox", { name: "Manuscript category", includeHidden: true });
      await selector.click();
      assert.deepEqual(await page.getByRole("option").allTextContents(),
        ["Chapters✓", "Chapter Overview", "Tasks", "Characters", "Plotlines", "Themes", "Notes"]);
      await page.keyboard.press("Escape");
      for (const name of ["Characters", "Plotlines", "Themes", "Notes", "Tasks", "Chapter Overview", "Chapters"]) {
        await chooseWorkspace(page, name);
        assert.ok((await selector.innerText()).includes(name));
        await selector.click();
        assert.equal(await page.getByRole("option", { name, exact: true }).getAttribute("aria-selected"), "true");
        await page.keyboard.press("Escape");
        if (["Tasks", "Chapter Overview"].includes(name)) {
          assert.equal(await page.locator(".ws-chapters").count(), 0);
        }
      }
      await chooseWorkspace(page, "Tasks");
      await page.goBack();
      await page.waitForURL(url => url.searchParams.get("workspace") === "chapters");
      assert.match(await selector.innerText(), /Chapters/);
      await page.goForward();
      await page.waitForURL(url => url.searchParams.get("workspace") === "tasks");
      assert.match(await selector.innerText(), /Tasks/);
      await chooseWorkspace(page, "Chapters");
      assert.equal(await page.getByRole("button", { name: "Open chapter overview" }).count(), 0);
      assert.equal(await page.locator(".ws-task-entry").count(), 0);
      // The overview keeps the current editor instance and uses the same save queue.
      await editor.fill("Unsaved overview context.");
      await toggleOverview(page);
      const board = page.getByRole("region", { name: "Chapter overview" });
      await board.waitFor();
      assert.equal(await board.locator(".ws-board-card").count(), 2);
      const firstCard = board.locator('.ws-board-card').first();
      await firstCard.locator('.ws-card-preview').hover();
      await page.getByRole('tooltip').waitFor();
      assert.equal(await page.getByRole('tooltip').innerText(), initial.chapters[0].description[0].children[0].text);
      assert.equal(await firstCard.locator('.ws-card-preview').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
      await page.screenshot({ path: path.join(screenshots, 'chapter-summary-tooltip.png') });
      await page.keyboard.press('Escape');
      await page.getByRole('tooltip').waitFor({ state: 'detached' });
      await firstCard.getByRole('button', { name: 'Edit chapter', exact: true }).click();
      const chapterModal = page.getByRole('dialog', { name: 'Edit chapter', exact: true });
      await chapterModal.waitFor();
      await chapterModal.getByRole('textbox', { name: 'Chapter manuscript', exact: true }).fill('Modal chapter revision.');
      await page.screenshot({ path: path.join(screenshots, 'chapter-edit-modal.png') });
      await chapterModal.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: '✓ All changes saved' }).waitFor();
      assert.equal(saved.chapters[0].text[0].children[0].text, 'Modal chapter revision.');
      assert.equal(await editor.innerText(), 'Modal chapter revision.');
      assert.equal(await board.isVisible(), true);
      await firstCard.getByRole('button', { name: 'Edit chapter', exact: true }).click();
      await chapterModal.getByRole('textbox', { name: 'Chapter manuscript', exact: true }).fill('Unsaved overview context.');
      await chapterModal.getByRole('button', { name: 'Done', exact: true }).click();
      const overviewToggle = page.getByRole('combobox', { name: 'Manuscript category' });
      assert.match(await overviewToggle.innerText(), /Chapter Overview/);
      const cards = await board.locator('.ws-board-card').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width };
      }));
      assert.ok(cards[0].width >= 280 && cards[0].width <= 400);
      assert.equal(cards[0].y, cards[1].y);
      assert.ok(cards[1].x > cards[0].x);
      await toggleOverview(page);
      assert.match(await overviewToggle.innerText(), /Chapters/);
      assert.equal(await editor.innerText(), 'Unsaved overview context.');
      await toggleOverview(page);
      await board
        .getByRole("button", { name: "Preview The house by the sea" })
        .click();
      await page.getByRole("dialog").waitFor();
      assert.match(
        await page.locator(".ws-chapter-reading").innerText(),
        /Unsaved overview context/,
      );
      await page.getByRole("button", { name: "Next →", exact: true }).click();
      assert.match(
        await page.locator(".ws-chapter-reading").innerText(),
        /twenty years/,
      );
      await page.keyboard.press("Escape");
      await board
        .getByRole("button", { name: "Add summary", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Chapter summary", exact: true })
        .fill("The letter changes everything.");
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      // Keyboard drag is available from each handle.
      const handle = board.getByRole("button", {
        name: "Reorder An unopened letter",
        exact: true,
      });
      await handle.focus();
      await page.keyboard.press("Space");
      await page.waitForFunction(
        () => !!document.querySelector(".is-dragging"),
      );
      // Let the drag sensor finish measuring the grid before moving.
      await page.waitForTimeout(100);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await page.waitForFunction(
        () =>
          document.querySelector(".ws-board-card h2")?.textContent ===
          "An unopened letter",
      );
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(saved.chapters[0].name, "An unopened letter");
      assert.equal(
        saved.chapters[0].description[0].children[0].text,
        "The letter changes everything.",
      );
      await page.screenshot({
        path: path.join(screenshots, "chapter-overview-desktop.png"),
      });
      await page.reload();
      await page.getByRole("region", { name: "Chapter overview" }).waitFor();
      assert.match(
        await board.locator(".ws-board-card").first().innerText(),
        /An unopened letter/,
      );
      assert.match(
        await board.locator(".ws-board-card").first().innerText(),
        /The letter changes everything/,
      );
      const chapterMenu = board.locator('.ws-item-menu').first();
      await chapterMenu.locator('summary').click();
      assert.equal(await chapterMenu.getByRole('button', { name: /^(Move up|Move down|Duplicate)$/ }).count(), 0);
      await page.locator('.ws-board-heading button').first().focus();
      assert.equal(await chapterMenu.getAttribute('open'), null);
      await chapterMenu.locator('summary').click();
      await board.getByRole('heading', { name: 'Chapter overview', exact: true }).click();
      assert.equal(await chapterMenu.getAttribute('open'), null);
      await chapterMenu.locator('summary').click();
      await page.keyboard.press('Escape');
      assert.equal(await chapterMenu.getAttribute('open'), null);
      // A failed reorder stays visible and recoverable until explicit retry.
      fail = true;
      await board.locator(".ws-drag-handle").first().focus();
      await page.keyboard.press("Space");
      await page.waitForFunction(() => !!document.querySelector(".is-dragging"));
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await page.getByRole("button", { name: "Save failed · retry" }).waitFor();
      assert.equal(saved.chapters[0].name, "An unopened letter");
      fail = false;
      await page.getByRole("button", { name: "Save failed · retry" }).click();
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(saved.chapters[0].name, "The house by the sea");
      await board.locator(".ws-drag-handle").first().focus();
      await page.keyboard.press("Space");
      await page.waitForFunction(() => !!document.querySelector(".is-dragging"));
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      // Pointer dragging restores the original sequence and persists it.
      await page.waitForTimeout(300);
      const secondHandle = board.getByRole("button", {
        name: "Reorder The house by the sea",
        exact: true,
      });
      await secondHandle.scrollIntoViewIfNeeded();
      const from = await secondHandle.boundingBox();
      const targetCard = await handle.locator("xpath=ancestor::*[contains(@class, 'ws-board-card')]").boundingBox();
      const sourceCard = await secondHandle.locator("xpath=ancestor::*[contains(@class, 'ws-board-card')]").boundingBox();
      const to = {
        x: targetCard.x + (targetCard.width - sourceCard.width) / 2 + from.x - sourceCard.x,
        y: targetCard.y + (targetCard.height - sourceCard.height) / 2 + from.y - sourceCard.y,
        width: from.width,
        height: from.height,
      };
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 - 12, from.y + from.height / 2);
      await page.waitForFunction(() => !!document.querySelector(".is-dragging"));
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 20,
      });
      await page.waitForTimeout(300);
      await board.locator(".ws-board-card.is-over").waitFor();
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector(".ws-board-card h2")?.textContent === "The house by the sea");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(saved.chapters[0].name, "The house by the sea");
      await chooseWorkspace(page, "Chapters");
      assert.equal(await editor.innerText(), "Unsaved overview context.");
      await toggleOverview(page);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: path.join(screenshots, "chapter-overview-mobile.png"),
      });
      await board
        .getByRole("button", { name: "Preview An unopened letter" })
        .click();
      await page.screenshot({
        path: path.join(screenshots, "chapter-preview-mobile.png"),
      });
      await page.keyboard.press("Escape");
      await chooseWorkspace(page, "Chapters");
      await page.setViewportSize({ width: 1365, height: 900 });
      await editor.fill("First chapter revised.");
      await page.getByRole("button", { name: /An unopened letter/ }).click();
      await editor.fill("Second chapter revised.");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(
        saved.chapters[0].text[0].children[0].text,
        "First chapter revised.",
      );
      assert.equal(
        saved.chapters[1].text[0].children[0].text,
        "Second chapter revised.",
      );
      for (const section of ["Chapter Overview", "Tasks", "Notes", "Chapters"]) await chooseWorkspace(page, section);
      assert.equal(await page.getByRole("textbox", { name: "Chapter or page title", exact: true }).inputValue(), "An unopened letter");
      assert.equal(await editor.innerText(), "Second chapter revised.");
      delay = 300;
      await editor.fill("While saving");
      await page.keyboard.press("Control+s");
      await editor.fill("Newest draft during save");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(
        saved.chapters[1].text[0].children[0].text,
        "Newest draft during save",
      );
      delay = 0;
      fail = true;
      await editor.fill("Recover after interruption");
      await page.getByRole("button", { name: "Save failed · retry" }).waitFor();
      await page.getByRole('button',{name:'Back to library',exact:true}).click();
      const leaveDialog = page.getByRole('dialog',{name:'Leave with unsaved edits?'});
      await leaveDialog.getByRole('button',{name:'Keep writing',exact:true}).click();
      assert.equal(await editor.innerText(),'Recover after interruption');
      await page.reload();
      await page
        .getByRole("button", { name: "Restore draft", exact: true })
        .click();
      await editor.waitFor();
      assert.equal(await editor.innerText(), "Recover after interruption");
      fail = false;
      await page.keyboard.press("Control+s");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      await editor.click();
      await page.keyboard.press("End");
      await page.keyboard.type(" Extra");
      await page.keyboard.press("Control+z");
      assert.equal(await editor.innerText(), "Recover after interruption");
      await page.keyboard.press("Control+Shift+z");
      assert.match(await editor.innerText(), /Extra/);
      await page
        .getByRole("button", { name: "＋ Add chapter", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Chapter or page title" })
        .fill("New chapter");
      await editor.fill("A fresh start.");
      await toggleOverview(page);
      await page.setViewportSize({ width: 1100, height: 900 });
      const wrappedCards = await board.locator('.ws-board-card').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width };
      }));
      assert.equal(wrappedCards.length, 3);
      assert.equal(wrappedCards[0].y, wrappedCards[1].y);
      assert.ok(wrappedCards[2].y > wrappedCards[0].y);
      assert.equal(wrappedCards[2].x, wrappedCards[0].x);
      assert.equal(await board.locator('.ws-board').evaluate(node => node.scrollWidth <= node.clientWidth), true);
      await page.screenshot({ path: path.join(screenshots, 'chapter-overview-grid.png') });
      await toggleOverview(page);
      await page.setViewportSize({ width: 1365, height: 900 });
      const writingMenu = page.locator('.ws-writing .ws-item-menu');
      await writingMenu.locator('summary').click();
      assert.equal(await writingMenu.getByRole('button', { name: /^(Move up|Move down|Duplicate)$/ }).count(), 0);
      await page.getByRole('button', { name: 'Read', exact: true }).focus();
      assert.equal(await writingMenu.getAttribute('open'), null);
      await writingMenu.locator('summary').click();
      await page.locator('.ws-eyebrow').first().click();
      assert.equal(await writingMenu.getAttribute('open'), null);
      await writingMenu.locator('summary').click();
      await page.getByRole('button', { name: 'Archive page', exact: true }).click();
      const archivePageDialog = page.getByRole("dialog", {
        name: "Archive this page?",
      });
      await archivePageDialog
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.ok(
        !saved.chapters.find((c) => c.name === "New chapter")
          ?.isArchived,
      );
      await page.getByText("More", { exact: true }).click();
      await page
        .getByRole("button", { name: "Archive page", exact: true })
        .click();
      await archivePageDialog
        .getByRole("button", { name: "Archive", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Undo archive", exact: true })
        .click();
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.ok(
        saved.chapters.some((c) => c.name === "New chapter" && !c.isArchived),
      );
      assert.equal(saved.chapters.at(-1).name, "New chapter");
      await page.getByRole("button", { name: "Options", exact: true }).click();
      const downloadEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export manuscript (.html)", exact: true })
        .click();
      const file = await downloadEvent;
      assert.ok(file.suggestedFilename().endsWith(".html"));
      const exported = fs.readFileSync(await file.path(), "utf8");
      assert.ok(exported.includes("A fresh start."));
      await page.getByLabel("Appearance").selectOption("dark");
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await page.screenshot({
        path: path.join(screenshots, "studio-dark.png"),
      });
      await page.keyboard.press("Control+Shift+f");
      assert.ok(
        await page
          .getByRole("button", { name: "Exit focus", exact: true })
          .isVisible(),
      );
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Read", exact: true }).click();
      assert.equal(await editor.getAttribute("contenteditable"), "false");
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: /☰/ }).click();
      await page.getByRole("button", { name: /The house by the sea/ }).click();
      assert.ok(await editor.isVisible());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: path.join(screenshots, "studio-mobile.png"),
      });
      await page
        .getByRole("button", { name: "Back to library", exact: true })
        .click();
      await page
        .getByRole("button", { name: "＋ New manuscript", exact: true })
        .click();
      await page
        .getByLabel("What’s your working title?")
        .fill("A new beginning");
      await page
        .getByRole("button", { name: "Create manuscript", exact: true })
        .click();
      await page
        .getByRole("button", { name: "＋ Create a chapter", exact: true })
        .click();
      await editor.fill("The first words.");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      await page.reload();
      await editor.waitFor();
      assert.equal(await editor.innerText(), "The first words.");
      assert.ok(saveCount >= 6);
      await page.setViewportSize({ width: 820, height: 1180 });
      const longText = Array.from({ length: 20000 }, (_, i) => "word" + i).join(
        " ",
      );
      await editor.fill(longText);
      await page.keyboard.press("Control+s");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(saved.chapters[0].text[0].children[0].text, longText);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 1,
        ),
        true,
      );
      const scrollCheck = await page.evaluate(() => {
        const writer = document.querySelector(".ws-writing");
        writer.scrollTop = 600;
        return {
          inner: writer.scrollTop,
          outer: document.scrollingElement.scrollTop,
        };
      });
      assert.ok(scrollCheck.inner > 0);
      assert.equal(scrollCheck.outer, 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.evaluate(() => (document.documentElement.dir = "rtl"));
      await page
        .getByRole("textbox", { name: "Chapter or page title" })
        .fill("פרק ראשון — מסע הביתה");
      await editor.fill("זהו סיפור חדש. המילים נשמרות גם מימין לשמאל.");
      await page.keyboard.press("Control+s");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      await page.screenshot({
        path: path.join(screenshots, "studio-tablet-rtl.png"),
      });
      saved = { ...saved, updatedAt: "2099-01-01T00:00:00.000Z" };
      books[books.findIndex((b) => b.id === saved.id)] = saved;
      await editor.fill("Conflicting local draft");
      await page.getByRole("button", { name: "Save failed · retry" }).waitFor();
      await page.reload();
      await page
        .getByRole("button", { name: "Download recovery draft", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Restore draft", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Keep server version", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Discard recovery draft?" })
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Keep server version", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Discard recovery draft?" })
        .getByRole("button", { name: "Discard draft", exact: true })
        .click();
      assert.ok(
        !(await editor.innerText()).includes("Conflicting local draft"),
      );
      await page
        .getByRole("button", { name: "Back to library", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Archive A new beginning", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Archive this book?" })
        .getByRole("button", { name: "Archive", exact: true })
        .click();
      await page
        .getByRole("link", { name: "Write A new beginning", exact: true })
        .waitFor({ state: "detached" });
      assert.equal(saved.isArchived, true);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
