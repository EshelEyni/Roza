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
initial.taskBoard = {lists:[{id:'todo',title:'To Do',cards:[{id:'other-task',title:'Other chapter research',chapterId:initial.chapters[1].id,description:'',dueDate:'',labels:[],checklist:[],createdAt:'2026-11-01',updatedAt:'2026-11-01'}]},{id:'progress',title:'In Progress',cards:[]},{id:'done',title:'Done',cards:[]}]};
test(
  "chapter lists are isolated and general notes persist, edit and delete",
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
      await page.getByRole('link',{name:'Write The Shape of Quiet',exact:true}).click();

      const save=async()=>{ await page.getByRole('button',{name:/All changes saved|Unsaved changes|Saving…/}).first().click(); await page.getByRole('button',{name:'✓ All changes saved',exact:true}).waitFor(); };
      async function board(title) {
        await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
        await page.getByRole('region',{name:'Chapter Bible',exact:true}).getByRole('button',{name:'Tasks',exact:true}).click();
        const b=page.getByRole('region',{name:'Chapter task board'});
        await b.getByLabel('List title',{exact:true}).first().fill(title);
        assert.equal(await b.getByLabel('List title',{exact:true}).first().evaluate(el=>getComputedStyle(el).borderTopColor),'rgba(0, 0, 0, 0)');
        await b.locator('.tb-list').first().getByRole('button',{name:'＋ Add Card',exact:true}).click();
        await b.getByLabel('New task in '+title,{exact:true}).fill(title+' task');
        await b.getByLabel('New task in '+title,{exact:true}).press('Enter');
        await save(); await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      }
      async function note(text) {
        const action=page.getByRole('button',{name:'+ General Note',exact:true});
        if(!await action.isVisible()) await page.getByRole('button',{name:'Annotations',exact:true}).click();
        await action.click(); await page.locator('.ws-annotation-card.is-active').getByLabel('Annotation text').fill(text); await save();
      }
      await board('First list'); await note('First general note'); await note('Second general note');
      await page.locator('.ws-chapters').getByRole('button',{name:/An unopened letter/}).click();
      await board('Second list'); await note('Other chapter note');
      assert.equal(saved.chapters[0].taskBoard.lists[0].title,'First list');
      assert.equal(saved.chapters[1].taskBoard.lists[0].title,'Second list');
      assert.equal(saved.taskBoard.lists[0].title,'To Do');
      assert.equal(saved.taskBoard.lists[0].cards.length,1);
      await page.reload();
      await page.locator('.ws-chapters').getByRole('button',{name:/The house by the sea/}).click();
      assert.equal(saved.chapters[0].annotations.length,2);
      const general=page.getByRole('button',{name:'+ General Note',exact:true});
      if(!await general.isVisible()) await page.getByRole('button',{name:'Annotations',exact:true}).click();
      await page.locator('.ws-annotation-card').first().locator('.ws-note-select').click();
      await page.locator('.ws-annotation-card.is-active').getByLabel('Annotation text').fill('Edited general note'); await save();
      await page.locator('.ws-annotation-card.is-active').getByRole('button',{name:'Delete',exact:true}).click();
      await page.getByRole('button',{name:'Delete note',exact:true}).click(); await save();
      assert.equal(saved.chapters[0].annotations.length,1);
      assert.equal(saved.chapters[1].annotations[0].content,'Other chapter note');
      assert.equal(saved.chapters[1].annotations[0].anchor,null);
      assert.equal(saved.chapters[1].annotations[0].general,true);
      assert.deepEqual(errors,[]);
    } finally {await browser?.close();await server.close();}
  },
);
