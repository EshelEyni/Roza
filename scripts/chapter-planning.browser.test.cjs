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
if (process.env.CARD_SCROLL_ONLY === '1') initial.chapters[0].description = paragraph('A complete chapter summary with selectable text. '.repeat(100));
test(
  "chapter planning: connected entities, tasks, preview, refresh and responsive layouts",
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
      cacheDir: path.join(root, ".planning-test-cache"),
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
    const screenshots = path.join(root, "docs/chapter-planning/screenshots");
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
      await page.getByRole("link", {name: "Write The Shape of Quiet", exact:true}).click();
      const editorWidth=await page.locator('.ws-writing .ws-page').evaluate(el=>el.getBoundingClientRect().width);
      const planning = page.locator('.ws-writing .cp-chapter-bible');
      assert.equal(await page.locator('.ws-writing .cp-inspector').count(),0);
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await page.getByRole('heading',{name:'Chapter Bible - The house by the sea',exact:true}).waitFor();
      assert.equal(await page.locator('.ws-writing .ws-page-footer').count(),0);
      assert.equal(await page.locator('.ws-writing .ws-chapter-title').count(),0);
      assert.equal(await planning.locator('[role=status]').count(),0);
      assert.equal(await page.locator('.ws-writing .ws-page').evaluate(el=>el.getBoundingClientRect().width),editorWidth);
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      assert.equal(await page.locator('.ws-writing .ws-page-footer').count(),1);
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await planning.getByRole('button',{name:'Tasks',exact:true}).click();
      await planning.getByLabel('New chapter task', {exact:true}).fill('Research the harbour');
      await planning.getByRole('button', {name:'Add task', exact:true}).click();
      await planning.getByLabel('Complete Research the harbour').check();
      await planning.getByRole('button',{name:'Themes',exact:true}).click();
      await planning.getByLabel('New themes name').fill('זיכרון / Memory');
      await planning.getByLabel('New themes name').press('Enter');
      await planning.getByRole('button',{name:'Plotlines',exact:true}).click();
      await planning.getByLabel('New plotlines name').fill('The unopened letter');
      await planning.getByLabel('New plotlines name').press('Enter');
      await planning.getByLabel('The unopened letter chapter contribution').fill('Mara discovers the sender.');
      await planning.getByRole('button',{name:'Characters',exact:true}).click();
      await planning.getByLabel('New characters name').fill('Mara');
      await planning.getByLabel('New characters name').press('Enter');
      await planning.getByLabel('Mara chapter contribution').fill('Returns to her childhood home.');
      await page.locator('.ws-writing').evaluate(el=>el.scrollTo(0,0));
      await page.screenshot({path:path.join(screenshots,'planning-desktop.png')});
      await page.getByRole('button',{name:/All changes saved|Unsaved changes|Saving…/}).first().click();
      await page.getByRole('button',{name:'✓ All changes saved', exact:true}).waitFor();
      assert.equal(saved.chapters[0].planning.characters.length,1);
      assert.equal(saved.chapters[0].planning.plotlines[0].note,'Mara discovers the sender.');
      const taskId=saved.taskBoard.lists[0].cards[0].id;
      await planning.getByRole('button',{name:'Tasks',exact:true}).click();
      await planning.getByRole('button',{name:'Open in board'}).click();
      await page.getByRole('dialog',{name:'Task details'}).waitFor();
      assert.equal(await page.getByLabel('Task chapter').inputValue(),initial.chapters[0].id);
      await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();
      await page.getByLabel('Filter tasks by chapter').selectOption(initial.chapters[0].id);
      assert.equal(await page.locator('.tb-card-open').count(),1);
      await chooseWorkspace(page,'Chapters');
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await planning.getByRole('button',{name:'Mara',exact:true}).click();
      assert.match(await page.getByRole('combobox',{name:'Manuscript category',includeHidden:true}).innerText(),/Characters/);
      await chooseWorkspace(page,'Chapters');
      await page.locator('.ws-chapters').getByRole('button',{name:/An unopened letter/}).click();
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await planning.getByLabel('Associate characters with chapter',{exact:true}).selectOption(saved.characters[0].id);
      await page.locator('.ws-chapters').getByRole('button',{name:/The house by the sea/}).click();
      await chooseWorkspace(page,'Chapter Overview');
      await page.getByLabel('Filter chapter planning').selectOption('unfinished');
      assert.equal(await page.locator('.ws-board-card').count(),0);
      await page.getByLabel('Filter chapter planning').selectOption('');
      await page.getByRole('button',{name:'Preview The house by the sea',exact:true}).click();
      const preview=page.getByRole('dialog',{name:'Chapter reading preview'});
      const inspector=preview.locator('.cp-inspector');
      await inspector.locator(':scope > summary').click();
      await inspector.locator('details > summary').filter({hasText:/^Tasks/}).click();
      await inspector.getByLabel('Complete Research the harbour').uncheck();
      await preview.getByRole('button',{name:'Done',exact:true}).click();
      await page.getByRole('button',{name:/All changes saved|Unsaved changes|Saving…/}).first().click();
      await page.getByRole('button',{name:'✓ All changes saved',exact:true}).waitFor();
      await page.reload();
      await page.getByLabel('Filter chapter planning').selectOption('unfinished');
      assert.equal(await page.locator('.ws-board-card').count(),1);
      assert.equal(saved.taskBoard.lists[0].cards[0].id,taskId);
      await page.getByLabel('Filter chapter planning').selectOption('');
      const handle=page.getByRole('button',{name:'Reorder An unopened letter',exact:true});
      await handle.focus(); await page.keyboard.press('Space');
      await page.waitForFunction(()=>!!document.querySelector('.is-dragging'));
      await page.waitForTimeout(100); await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300); await page.keyboard.press('Space');
      await page.waitForFunction(()=>document.querySelector('.ws-board-card h2')?.textContent==='An unopened letter');
      await page.getByRole('button',{name:/All changes saved|Unsaved changes|Saving…/}).first().click();
      await page.getByRole('button',{name:'✓ All changes saved',exact:true}).waitFor();
      assert.equal(saved.chapters[1].planning.plotlines[0].note,'Mara discovers the sender.');
      assert.equal(saved.chapters[0].planning.characters[0].entityId,saved.chapters[1].planning.characters[0].entityId);
      assert.equal(saved.taskBoard.lists[0].cards[0].chapterId,initial.chapters[0].id);
      await page.getByLabel('Filter chapter planning').selectOption('characters:'+saved.characters[0].id);
      assert.equal(await page.locator('.ws-board-card').count(),2);
      await page.setViewportSize({width:768,height:1024});
      await page.screenshot({path:path.join(screenshots,'planning-tablet.png')});
      await page.setViewportSize({width:390,height:844});
      await chooseWorkspace(page,'Chapters');
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await planning.getByRole('button',{name:'Characters',exact:true}).click();
      await page.screenshot({path:path.join(screenshots,'planning-mobile.png')});
      const bibleWidth=await page.locator('.ws-writing .ws-page').evaluate(el=>el.getBoundingClientRect().width);
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      assert.equal(await page.locator('.ws-writing .ws-page').evaluate(el=>el.getBoundingClientRect().width),bibleWidth);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
    } finally { await browser?.close(); await server.close(); }
  },
);
