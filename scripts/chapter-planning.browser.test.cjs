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
      await page.getByRole('link',{name:'Write The Shape of Quiet',exact:true}).click();
      const editorWidth=await page.locator('.ws-writing .ws-page').evaluate(el=>el.getBoundingClientRect().width);
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      const planning=page.getByRole('region',{name:'Chapter Bible',exact:true});
      await planning.getByRole('heading',{name:'Chapter Bible',exact:true}).waitFor();
      assert.equal(await planning.locator('[role=status]').count(),0);
      assert.equal(await page.locator('.ws-writing .ws-page').evaluate(el=>el.getBoundingClientRect().width),editorWidth);
      async function create(kind, singular, name) {
        await planning.getByRole('button',{name:kind,exact:true}).click();
        await planning.getByRole('button',{name:'Add new '+singular,exact:true}).click();
        await planning.getByLabel('New '+kind.toLowerCase()+' name',{exact:true}).fill(name);
        await planning.getByLabel('New '+kind.toLowerCase()+' name',{exact:true}).press('Enter');
      }
      await create('Characters','character','Mara');
      await page.getByRole('dialog',{name:'Edit character',exact:true}).getByRole('textbox',{name:'Mara description',exact:true}).fill('A returning daughter.');
      await page.getByRole('dialog',{name:'Edit character',exact:true}).getByLabel('Mara chapter contribution').fill('Returns to her childhood home.');
      await page.getByRole('dialog',{name:'Edit character',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.locator('.cp-element-open').filter({hasText:'Mara'}).click();
      const readCharacter=page.getByRole('dialog',{name:'Mara details',exact:true});
      assert.equal(await readCharacter.locator('input, textarea, [contenteditable=true]').count(),0);
      await readCharacter.getByText('Returns to her childhood home.',{exact:true}).waitFor();
      await page.screenshot({path:path.join(screenshots,'character-details-desktop.png')});
      await readCharacter.getByRole('button',{name:'Done',exact:true}).click();
      assert.equal(await planning.locator('.cp-element-chevron').count(),0);
      await planning.locator('.cp-element-open').hover();
      assert.equal(await planning.locator('.cp-element-open').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
      await planning.getByLabel('Search characters',{exact:true}).fill('missing');
      assert.equal(await planning.locator('.cp-element').count(),0);
      await planning.getByLabel('Search characters',{exact:true}).fill('daughter');
      assert.equal(await planning.locator('.cp-element').count(),1);
      await planning.getByLabel('Search characters',{exact:true}).fill('');
      await create('Characters','character','Jonah');
      await page.getByRole('dialog',{name:'Edit character',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByRole('button',{name:'Remove Jonah from chapter',exact:true}).click();
      const removeCharacter=page.getByRole('dialog',{name:'Remove character from chapter?',exact:true});
      await removeCharacter.getByText(/only unlinks the character/).waitFor();
      assert.ok(await removeCharacter.evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft)>=20));
      assert.notEqual(await removeCharacter.evaluate(el=>getComputedStyle(el).borderRadius),'0px');
      await page.screenshot({path:path.join(screenshots,'confirmation-desktop.png')});
      await removeCharacter.getByRole('button',{name:'Cancel',exact:true}).click();
      assert.equal(await planning.locator('.cp-element').count(),2);
      await planning.getByRole('button',{name:'Remove Jonah from chapter',exact:true}).click();
      await page.getByRole('dialog',{name:'Remove character from chapter?',exact:true}).getByRole('button',{name:'Remove from chapter',exact:true}).click();
      assert.equal(await planning.locator('.cp-elements-hint').count(),0);
      await planning.getByRole('button',{name:'Link existing character',exact:true}).click();
      const picker=page.getByRole('dialog',{name:'Link existing characters',exact:true});
      await picker.getByRole('checkbox',{name:'Jonah',exact:true}).check();
      await picker.getByRole('checkbox',{name:'Mara',exact:true}).click();
      await page.getByRole('dialog',{name:'Remove character from chapter?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
      assert.equal(await picker.getByRole('checkbox',{name:'Mara',exact:true}).isChecked(),true);
      await picker.getByRole('checkbox',{name:'Jonah',exact:true}).click();
      await page.getByRole('dialog',{name:'Remove character from chapter?',exact:true}).getByRole('button',{name:'Remove from chapter',exact:true}).click();
      await picker.getByLabel('Search book characters',{exact:true}).fill('Mara');
      assert.equal(await picker.getByRole('checkbox').count(),1);
      await picker.getByRole('button',{name:'Done',exact:true}).click();
      assert.equal(await planning.locator('.cp-element').count(),1);
      await page.screenshot({path:path.join(screenshots,'planning-desktop.png')});
      await planning.getByRole('button',{name:'Edit Mara',exact:true}).click();
      await page.getByRole('dialog',{name:'Edit character',exact:true}).getByLabel('Mara chapter contribution').fill('Returns home and finds the letter.');
      await page.screenshot({path:path.join(screenshots,'character-edit-desktop.png')});
      await page.getByRole('dialog',{name:'Edit character',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await create('Themes','theme','זיכרון / Memory');
      await page.getByRole('dialog',{name:'Edit theme',exact:true}).getByRole('textbox',{name:'זיכרון / Memory description',exact:true}).fill('What we remember and what we forget.');
      await page.getByRole('dialog',{name:'Edit theme',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      assert.equal(await planning.locator('.cp-elements-themes .cp-element').count(),1);
      await planning.locator('.cp-element-open').click();
      const themeDetails=page.getByRole('dialog',{name:'זיכרון / Memory details',exact:true});
      assert.equal(await themeDetails.locator('input, textarea, [contenteditable=true]').count(),0);
      await themeDetails.getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByRole('button',{name:'Edit זיכרון / Memory',exact:true}).click();
      await page.getByRole('dialog',{name:'Edit theme',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByRole('button',{name:'Remove זיכרון / Memory from chapter',exact:true}).click();
      await page.getByRole('dialog',{name:'Remove theme from chapter?',exact:true}).getByRole('button',{name:'Remove from chapter',exact:true}).click();
      await planning.getByRole('button',{name:'Link existing theme',exact:true}).click();
      await page.getByRole('dialog',{name:'Link existing themes',exact:true}).getByRole('checkbox',{name:'זיכרון / Memory',exact:true}).check();
      await page.getByRole('dialog',{name:'Link existing themes',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByLabel('Search themes',{exact:true}).fill('forget');
      assert.equal(await planning.locator('.cp-element').count(),1);
      await page.screenshot({path:path.join(screenshots,'themes-desktop.png')});
      await create('Plotlines','plotline','The unopened letter');
      await page.getByRole('dialog',{name:'Edit plotline',exact:true}).getByLabel('The unopened letter chapter contribution').fill('Mara discovers the sender.');
      await page.getByRole('dialog',{name:'Edit plotline',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.locator('.cp-element-open').click();
      const plotlineDetails=page.getByRole('dialog',{name:'The unopened letter details',exact:true});
      assert.equal(await plotlineDetails.locator('input, textarea, [contenteditable=true]').count(),0);
      await plotlineDetails.getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByRole('button',{name:'Remove The unopened letter from chapter',exact:true}).click();
      await page.getByRole('dialog',{name:'Remove plotline from chapter?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
      await planning.getByRole('button',{name:'Link existing plotline',exact:true}).click();
      await page.getByRole('dialog',{name:'Link existing plotlines',exact:true}).getByRole('checkbox',{name:'The unopened letter',exact:true}).isChecked();
      await page.screenshot({path:path.join(screenshots,'link-entities-desktop.png')});
      await page.getByRole('dialog',{name:'Link existing plotlines',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByRole('button',{name:'Tasks',exact:true}).click();
      const board=planning.getByRole('region',{name:'Chapter task board'});
      assert.equal(await board.locator('.tb-card').count(),0);
      assert.equal(await board.locator('.tb-delete-list').count(),3);
      assert.equal(await board.locator('.tb-list').first().evaluate(el=>getComputedStyle(el).backgroundColor),await page.locator('.ws-writing .ws-page').evaluate(el=>getComputedStyle(el).backgroundColor));
      await board.getByRole('button',{name:'＋ Add List',exact:true}).click();
      await board.locator('.tb-list').last().getByLabel('List title',{exact:true}).fill('Review');
      await board.getByRole('button',{name:'Delete list Review',exact:true}).click();
      await page.getByRole('button',{name:'Delete',exact:true}).click();
      assert.equal(await board.locator('.tb-list').count(),3);
      await board.locator('.tb-list').first().getByRole('button',{name:'＋ Add Card',exact:true}).click();
      await board.getByLabel('New task in To Do',{exact:true}).fill('Research the harbour');
      await board.getByLabel('New task in To Do',{exact:true}).press('Enter');
      assert.equal(await board.locator('.tb-card').count(),1);
      await board.getByRole('button',{name:/Research the harbour/}).click();
      await page.getByRole('dialog',{name:'Task details'}).getByRole('checkbox',{name:'Completed',exact:true}).check();
      await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();
      const grip=await board.getByRole('button',{name:'Reorder task',exact:true}).boundingBox();
      const dest=await board.locator('.tb-list').nth(1).locator('header').boundingBox();
      await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
      await page.mouse.move(dest.x+dest.width/2,dest.y+dest.height/2,{steps:20});await page.waitForTimeout(200);await page.mouse.up();
      await board.locator('.tb-list').nth(1).locator('.tb-card').waitFor();
      await page.screenshot({path:path.join(screenshots,'tasks-desktop.png')});
      await board.getByRole('button',{name:/Research the harbour/}).click();
      await page.getByRole('button',{name:'Open in book board',exact:true}).click();
      await page.getByRole('dialog',{name:'Task details'}).waitFor();
      assert.equal(await page.getByLabel('Task chapter').inputValue(),initial.chapters[0].id);
      await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();
      assert.equal(await page.locator('.tb-card').count(),2);
      await chooseWorkspace(page,'Chapters');
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await page.getByRole('button',{name:/All changes saved|Unsaved changes|Saving…/}).first().click();
      await page.getByRole('button',{name:'✓ All changes saved',exact:true}).waitFor();
      const mara=saved.characters.find(c=>c.name==='Mara');
      assert.ok(saved.characters.find(c=>c.name==='Jonah'));
      assert.equal(saved.chapters[0].planning.characters.length,1);
      assert.equal(saved.chapters[0].planning.characters[0].note,'Returns home and finds the letter.');
      assert.equal(saved.taskBoard.lists[0].cards[0].id,'other-task');
      assert.equal(saved.taskBoard.lists[1].cards[0].chapterId,initial.chapters[0].id);
      await page.reload();
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await planning.locator('.cp-element-open').filter({hasText:'Mara'}).click();
      await page.getByRole('dialog',{name:'Mara details',exact:true}).getByText('Returns home and finds the letter.',{exact:true}).waitFor();
      assert.match(await page.getByRole('dialog',{name:'Mara details',exact:true}).innerText(),/returning daughter/);
      await page.getByRole('dialog',{name:'Mara details',exact:true}).getByRole('button',{name:'Open profile',exact:true}).click();
      assert.match(await page.getByRole('combobox',{name:'Manuscript category',includeHidden:true}).innerText(),/Characters/);
      await chooseWorkspace(page,'Chapters');
      await page.locator('.ws-chapters').getByRole('button',{name:/An unopened letter/}).click();
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await planning.getByRole('button',{name:'Link existing character',exact:true}).click();
      await page.getByRole('dialog',{name:'Link existing characters',exact:true}).getByRole('checkbox',{name:'Mara',exact:true}).check();
      await page.getByRole('dialog',{name:'Link existing characters',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await page.locator('.ws-chapters').getByRole('button',{name:/The house by the sea/}).click();
      await chooseWorkspace(page,'Chapter Overview');
      await page.getByRole('button',{name:'Preview The house by the sea',exact:true}).click();
      const preview=page.getByRole('dialog',{name:'Chapter reading preview'});
      const inspector=preview.locator('.cp-inspector');await inspector.locator(':scope > summary').click();
      await inspector.locator('details > summary').filter({hasText:/^Tasks/}).click();
      await inspector.getByLabel('Complete Research the harbour').uncheck();
      await preview.getByRole('button',{name:'Done',exact:true}).click();
      await page.getByRole('button',{name:/All changes saved|Unsaved changes|Saving…/}).first().click();
      await page.getByRole('button',{name:'✓ All changes saved',exact:true}).waitFor();
      await page.getByLabel('Filter chapter planning').selectOption('characters:'+mara.id);
      assert.equal(await page.locator('.ws-board-card').count(),2);
      await page.setViewportSize({width:768,height:1024});await page.screenshot({path:path.join(screenshots,'planning-tablet.png')});
      await page.setViewportSize({width:390,height:844});await chooseWorkspace(page,'Chapters');
      await page.getByRole('button',{name:'Chapter Bible',exact:true}).click();
      await page.screenshot({path:path.join(screenshots,'planning-mobile.png')});
      await planning.locator('.cp-element-open').filter({hasText:'Mara'}).click();
      await page.screenshot({path:path.join(screenshots,'character-details-mobile.png')});
      await page.getByRole('dialog',{name:'Mara details',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
      await planning.getByRole('button',{name:'Link existing character',exact:true}).click();
      await page.screenshot({path:path.join(screenshots,'link-entities-mobile.png')});
      await page.keyboard.press('Escape');
      await page.getByRole('dialog',{name:'Link existing characters',exact:true}).waitFor({state:'detached'});
      await planning.getByRole('button',{name:'Tasks',exact:true}).click();
      assert.equal(await board.locator('.tb-card').count(),1);
      await page.screenshot({path:path.join(screenshots,'tasks-mobile.png')});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
    } finally {await browser?.close();await server.close();}
  },
);
