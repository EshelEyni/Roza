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
  "contextual annotations: editing, persistence, collision, dragging, long chapters and responsive layouts",
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
      if (req.url.split("?")[0].endsWith(".json")) { res.statusCode = 404; res.setHeader("Content-Type", "application/json"); res.end("{}"); return; }
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          req.url,
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/writing-studio.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    let browser;
    const screenshots = path.join(
      root,
      "docs/writing-studio/annotation-screenshots",
    );
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
      page.on("dialog", (dialog) => { errors.push("Unexpected native browser dialog"); void dialog.dismiss(); });
      saved.chapters[0].text = [
        "The opening line.",
        "A thought worth annotating.",
        "The final paragraph.",
      ].map((text) => ({ type: "paragraph", children: [{ text }] }));
      const base = server.resolvedUrls.local[0];
      await page.goto(base + "books");
      await page
        .getByRole("link", { name: "Write The Shape of Quiet", exact: true })
        .waitFor();
      await page.screenshot({
        path: path.join(screenshots, "library-desktop.png"),
      });
      await page.getByRole("link", { name: "Continue writing" }).click();
      const editor = page.locator('[aria-label="Manuscript"]');
      await editor.waitFor();
      const categoryMenu = page.getByRole('combobox', {name:'Manuscript category'});
      await categoryMenu.click();
      const categoryOptions = page.getByRole('listbox', {name:'Manuscript categories'});
      assert.equal(await categoryOptions.evaluate(node => getComputedStyle(node).backgroundColor), await categoryMenu.evaluate(node => getComputedStyle(node).backgroundColor));
      // Chapter Overview and Tasks now precede Characters.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      assert.ok((await categoryMenu.innerText()).includes('Characters'));
      await categoryMenu.click();
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      assert.ok((await categoryMenu.innerText()).includes('Chapters'));
      await editor.waitFor();
      // Empty Slate placeholders must not collapse the writing area or move its footer.
      await page.getByRole("button", { name: /An unopened letter/ }).click();
      await editor.fill("");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      await page.waitForTimeout(100);
      const emptyHeight = (await editor.boundingBox()).height;
      const footer = page.locator(".ws-page-footer");
      const footerY = (await footer.boundingBox()).y;
      assert.ok(emptyHeight >= 900 * 0.42 - 1);
      for (let i = 0; i < 4; i++) {
        await editor.hover();
        await page.waitForTimeout(40);
        assert.ok(Math.abs((await footer.boundingBox()).y - footerY) < 1);
        await page.locator(".ws-chapter-title").hover();
        await page.waitForTimeout(40);
        assert.ok(Math.abs((await footer.boundingBox()).y - footerY) < 1);
      }
      await editor.fill("a");
      assert.ok(Math.abs((await footer.boundingBox()).y - footerY) < 1);
      await editor.fill("");
      await page.waitForTimeout(100);
      assert.ok(Math.abs((await footer.boundingBox()).y - footerY) < 1);
      await editor.fill(
        "The letter had waited twenty years. One more morning would not hurt.",
      );
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      await page.getByRole("button", { name: /The house by the sea/ }).click();

      const noteText = page.getByRole("textbox", {
        name: "Annotation text",
        exact: true,
      });
      const add = (n) =>
        page.getByRole("button", {
          name: "Add note to paragraph " + n,
          exact: true,
        });
      await editor.locator("p").nth(1).hover();
      assert.equal(
        await add(2).evaluate((node) => getComputedStyle(node).opacity),
        "1",
      );
      await add(2).click();
      const textareaStyle = await noteText.evaluate(node => {
        const style = getComputedStyle(node);
        return { border: style.borderTopWidth, outline: style.outlineStyle, padding: style.paddingTop };
      });
      assert.deepEqual(textareaStyle, { border: '0px', outline: 'none', padding: '2px' });
      assert.equal(await page.locator('.ws-annotation-card.is-active header').getByRole('button', {name:'Delete',exact:true}).count(), 1);
      assert.equal(await page.getByRole('button', {name:'Save',exact:true}).count(), 0);
      await noteText.fill("Keep the voice intimate.");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(
        saved.chapters[0].annotations[0].content,
        "Keep the voice intimate.",
      );
      assert.deepEqual(
        saved.chapters[0].annotations[0].anchor.anchor.path,
        [1, 0],
      );
      assert.ok(await editor.locator("mark").count());
      await add(2).click({ force: true });
      await noteText.fill("Check the pacing here.");
      assert.equal(
        await page.locator(".ws-annotation-card.is-active").count(),
        1,
      );
      await page.locator(".ws-annotation-card.is-active .ws-note-select").click();
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      const cards = page.locator(".ws-annotation-card");
      const first = await cards.nth(0).boundingBox(),
        second = await cards.nth(1).boundingBox();
      assert.ok(second.y >= first.y + first.height);
      await cards.nth(0).locator(".ws-note-select").click();
      assert.equal(await noteText.inputValue(), "Keep the voice intimate.");
      const drag = cards.nth(0).getByRole("button", { name: "Drag note" });
      const start = await drag.boundingBox();
      await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(600, 220, { steps: 12 });
      await page.mouse.up();
      assert.equal(await page.locator(".is-floating").count(), 1);
      await page.screenshot({
        path: path.join(screenshots, "floating-note.png"),
      });
      await page.getByRole("button", { name: /An unopened letter/ }).click();
      await page.getByRole("button", { name: /The house by the sea/ }).click();
      assert.equal(await page.locator(".is-floating").count(), 0);
      await page.reload();
      await editor.waitFor();
      await cards.first().waitFor();
      assert.equal(await page.locator(".is-floating").count(), 0);
      await cards.nth(0).locator(".ws-note-select").click();
      assert.equal(await noteText.inputValue(), "Keep the voice intimate.");
      await cards.nth(0).locator(".ws-note-select").click();
      await editor.locator("p").nth(1).click();
      assert.equal(await noteText.count(), 0);
      assert.equal(
        await editor.evaluate((node) => node.contains(document.activeElement)),
        true,
      );
      await editor.click();
      await page.keyboard.press("Control+Home");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.deepEqual(
        saved.chapters[0].annotations[0].anchor.anchor.path,
        [2, 0],
      );
      const summaryButton = page.locator('button[aria-controls="ws-chapter-summary"]');
      assert.equal(await summaryButton.innerText(), 'Summary');
      await summaryButton.click();
      assert.equal(await summaryButton.innerText(), 'Text');
      await summaryButton.click();
      assert.equal(await summaryButton.innerText(), 'Summary');
      await summaryButton.click();
      const summaryEditor = page.getByRole('textbox',{name:'Chapter summary',exact:true});
      assert.ok((await summaryEditor.innerText()).includes('A homecoming.'));
      assert.equal(await editor.count(),0);
      assert.equal(await page.locator('.ws-annotation-rail').count(),0);
      const originalText = JSON.stringify(saved.chapters[0].text);
      await summaryEditor.fill('A revised chapter summary.');
      await page.keyboard.press('Control+a');
      await page.waitForTimeout(100);
      await page.locator('#ws-chapter-summary').getByRole('button',{name:'bold',exact:true}).click();
      await summaryEditor.locator('strong').waitFor();
      await page.getByRole('button',{name:'✓ All changes saved'}).waitFor();
      assert.equal(saved.chapters[0].description[0].children[0].text,'A revised chapter summary.');
      assert.equal(saved.chapters[0].description[0].children[0].bold,true);
      assert.equal(JSON.stringify(saved.chapters[0].text),originalText);
      await page.screenshot({path:path.join(screenshots,'chapter-summary.png')});
      await page.getByRole('button',{name:'Close chapter summary'}).click();
      await summaryEditor.waitFor({state:'detached'});
      await editor.waitFor();
      await summaryButton.click();
      assert.equal(await summaryEditor.innerText(),'A revised chapter summary.');
      await page.reload();
      await summaryButton.click();
      assert.equal(await summaryEditor.innerText(),'A revised chapter summary.');
      await page.getByRole('button',{name:/An unopened letter/}).click();
      await summaryEditor.waitFor({state:'detached'});
      await summaryButton.click();
      assert.equal(await summaryEditor.locator("[data-slate-string]").count(), 0);
      await page.getByRole('button',{name:/The house by the sea/}).click();
      await summaryEditor.waitFor({state:'detached'});
      await page.screenshot({
        path: path.join(screenshots, "desktop-annotations.png"),
      });
      // Long manuscript with many adjacent anchors, including an unattached note.
      saved.chapters[0].text = Array.from({ length: 180 }, (_, i) => ({
        type: "paragraph",
        children: [
          {
            text:
              "Paragraph " +
              (i + 1) +
              ". " +
              "A quiet moment in the story. ".repeat((i % 4) + 1),
          },
        ],
      }));
      saved.chapters[0].annotations = Array.from({ length: 80 }, (_, i) => ({
        id: "many-" + i,
        content: "Revision thought " + i,
        quote: "Paragraph " + (i + 1),
        anchor: {
          anchor: { path: [i, 0], offset: 0 },
          focus: { path: [i, 0], offset: 10 },
        },
      }));
      saved.chapters[0].annotations.push({
        id: "orphan",
        content: "Preserved deleted passage",
        quote: "Removed passage",
        anchor: null,
      });
      await page.reload();
      await page
        .getByRole("button", { name: "Add note to paragraph 180", exact: true })
        .waitFor({ state: "attached" });
      assert.equal(await cards.count(), 81);
      const bounds = await cards.evaluateAll((nodes) =>
        nodes
          .filter((n) => !n.classList.contains("is-floating"))
          .map((n) => {
            const r = n.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
          }),
      );
      for (let i = 1; i < bounds.length; i++)
        assert.ok(bounds[i].top >= bounds[i - 1].bottom);
      await cards.nth(1).locator(".ws-note-select").click();
      const p2 = await editor.locator("p").nth(1).boundingBox();
      const g2 = await page.locator(".ws-line-marker").nth(1).boundingBox();
      assert.ok(Math.abs(p2.y - g2.y) < 3);
      await page.screenshot({
        path: path.join(screenshots, "many-annotations.png"),
      });
      await page.setViewportSize({ width: 1000, height: 800 });
      await page.waitForTimeout(150);
      const p2n = await editor.locator("p").nth(1).boundingBox();
      const g2n = await page.locator(".ws-line-marker").nth(1).boundingBox();
      assert.ok(Math.abs(p2n.y - g2n.y) < 3);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      await page.screenshot({
        path: path.join(screenshots, "mobile-annotations.png"),
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page
        .getByRole("button", { name: "Paragraph 3, focus note", exact: true })
        .click();
      assert.equal(await noteText.inputValue(), "Revision thought 2");
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      const confirmation = page.getByRole('dialog', {name:'Delete this note?'});
      await confirmation.waitFor();
      assert.equal(await cards.count(), 81);
      await confirmation.getByRole('button', {name:'Cancel',exact:true}).click();
      assert.equal(await cards.count(), 81);
      await page.getByRole('button', {name:'Delete',exact:true}).click();
      await page.keyboard.press('Escape');
      assert.equal(await cards.count(), 81);
      await page.getByRole('button', {name:'Delete',exact:true}).click();
      await confirmation.getByRole('button', {name:'Delete note',exact:true}).click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(screenshots, "mobile-after-delete.png"),
      });
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(saved.chapters[0].annotations.length, 80);
      await page.setViewportSize({ width: 1365, height: 900 });
      await cards
        .filter({ hasText: "Preserved deleted passage" })
        .locator(".ws-note-select")
        .click();
      await editor.click();
      await page.keyboard.press("Control+Home");
      await page.keyboard.press("Control+Shift+ArrowRight");
      await page
        .getByRole("button", { name: "Attach to selected text", exact: true })
        .click();
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.ok(
        saved.chapters[0].annotations.find((n) => n.id === "orphan").anchor,
      );
      await page.locator(".ws-annotation-card.is-active .ws-note-select").click();
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      await editor.click();
      await page.keyboard.press("Control+Home");
      await page.keyboard.press("Control+Shift+ArrowRight");
      await page.getByRole("button", { name: "+ Note", exact: true }).click();
      await noteText.fill("A precise passage note.");
      await page.getByRole("button", { name: "✓ All changes saved" }).waitFor();
      assert.equal(saved.chapters[0].annotations.length, 81);
      assert.ok(saved.chapters[0].annotations.at(-1).quote.length < 30);
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await page.getByLabel("Appearance").selectOption("dark");
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await page.screenshot({
        path: path.join(screenshots, "dark-annotations.png"),
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
