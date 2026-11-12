async function chooseWorkspace(page, name) {
  const selector = page.getByRole("combobox", {
    name: "Manuscript category",
    includeHidden: true,
  });
  await selector.waitFor({ state: "attached" });
  if (!(await selector.isVisible()))
    await page.locator(".ws-mobile-nav").click();
  await selector.click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function toggleOverview(page) {
  const current = await page
    .getByRole("combobox", { name: "Manuscript category", includeHidden: true })
    .innerText();
  await chooseWorkspace(
    page,
    current.includes("Chapter Overview") ? "Chapters" : "Chapter Overview",
  );
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
if (process.env.CARD_SCROLL_ONLY === "1")
  initial.chapters[0].description = paragraph(
    "A complete chapter summary with selectable text. ".repeat(100),
  );
initial.taskBoard = {
  lists: [
    {
      id: "todo",
      title: "To Do",
      cards: [
        {
          id: "other-task",
          title: "Other chapter research",
          chapterId: initial.chapters[1].id,
          description: "",
          dueDate: "",
          labels: [],
          checklist: [],
          createdAt: "2026-11-01",
          updatedAt: "2026-11-01",
        },
      ],
    },
    { id: "progress", title: "In Progress", cards: [] },
    { id: "done", title: "Done", cards: [] },
  ],
};
test(
  "AI editing, independent drafts, promotion recovery and mobile switcher",
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
    let aiCalls = 0,
      aiDelay = 0,
      lastAi;
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
        if (req.url.endsWith("/ai-edit")) {
          aiCalls++;
          lastAi = incoming;
          if (aiDelay) await new Promise((r) => setTimeout(r, aiDelay));
          return res.end(
            JSON.stringify({
              status: "success",
              data: {
                text: incoming.text
                  .replace("Mara", "Miriam")
                  .replace("A homecoming.", "A return home."),
              },
            }),
          );
        }
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
    const screenshots = path.join(root, "output/ai-writing-drafts");
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
        if (dialog.type() === "beforeunload") {
          void dialog.accept();
          return;
        }
        errors.push("Unexpected native confirmation");
        void dialog.dismiss();
      });
      const base = server.resolvedUrls.local[0];
      await page.goto(base + "books");
      await page
        .getByRole("link", { name: "Write The Shape of Quiet", exact: true })
        .click();

      const main = page.locator('[data-slate-editor][aria-label="Manuscript"]');
      const original = await main.innerText();
      // A short selection is reviewed before replacement, then undone in one step.
      await main.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const selectedBox = await main.evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let text;
        while ((text = walker.nextNode()))
          if (text.textContent.includes("Mara")) {
            const i = text.textContent.indexOf("Mara"),
              r = document.createRange();
            r.setStart(text, i);
            r.setEnd(text, i + 4);
            const b = r.getBoundingClientRect();
            return { x: b.x, y: b.y, width: b.width, height: b.height };
          }
      });
      await page.mouse.move(
        selectedBox.x + 1,
        selectedBox.y + selectedBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        selectedBox.x + selectedBox.width - 1,
        selectedBox.y + selectedBox.height / 2,
        { steps: 8 },
      );
      await page.mouse.up();
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => String(window.getSelection())),
        "Mara",
      );
      await page
        .getByRole("button", { name: "AI Edit selection", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Generate suggestion", exact: true })
        .click();
      await page.getByRole("button", { name: "Accept", exact: true }).waitFor();
      assert.equal(await main.innerText(), original);
      assert.equal(lastAi.text, "Mara");
      assert.ok(await page.locator(".ws-ai-review ins").count());
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      assert.equal(await main.innerText(), original.replace("Mara", "Miriam"));
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(await main.innerText(), original);
      // A changed source cannot accept an outstanding suggestion.
      await main.click();
      await page.getByRole("button", { name: /^AI Edit/ }).click();
      aiDelay = 400;
      await page
        .getByRole("button", { name: "Generate suggestion", exact: true })
        .click();
      await main.press("End");
      await main.press("!");
      await page.getByRole("button", { name: "Accept", exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Accept", exact: true })
          .isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Reject", exact: true }).click();
      aiDelay = 0;
      // Drafts edit independently and preserve pending changes on switches.
      await page.getByText("Drafts (0)", { exact: true }).click();
      await page
        .getByRole("button", { name: "Create draft from Main", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Draft manuscript", exact: true })
        .waitFor();
      assert.equal(await page.locator(".ws-sidebar").isVisible(), false);
      const bounds = await page.locator(".ws-main-pane").boundingBox(),
        draftBounds = await page.locator(".ws-draft-pane").boundingBox();
      assert.ok(bounds.x < draftBounds.x);
      assert.ok(bounds.width > 400);
      assert.ok(draftBounds.width > 400);
      assert.equal(await main.getAttribute("contenteditable"), "false");
      const mainText = await main.innerText();
      const draft = page.getByRole("textbox", {
        name: "Draft manuscript",
        exact: true,
      });
      await draft.fill("An alternative chapter. שלום עולם.");
      assert.equal(await main.innerText(), mainText);
      await page.getByLabel("Draft name", { exact: true }).fill("Alternative");
      await page.getByLabel("Draft name", { exact: true }).press("Tab");
      await page.getByText("Drafts (1)", { exact: true }).click();
      await page
        .getByRole("button", { name: "Create blank draft", exact: true })
        .click();
      assert.equal((await draft.innerText()).trim(), "");
      await draft.fill("Second draft pending");
      const options = await page
        .getByRole("combobox", { name: "Select draft", exact: true })
        .locator("option")
        .evaluateAll((els) =>
          els.map((e) => ({ value: e.value, text: e.textContent })),
        );
      await page
        .getByRole("combobox", { name: "Select draft", exact: true })
        .selectOption(options.find((o) => o.text === "Alternative").value);
      assert.equal(
        await draft.innerText(),
        "An alternative chapter. שלום עולם.",
      );
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(await draft.innerText(), mainText);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      assert.equal(
        await draft.innerText(),
        "An alternative chapter. שלום עולם.",
      );
      await draft.fill("A long alternative paragraph. ".repeat(400));
      const mainScroll = await main.evaluate(
        (el) => el.closest("article").scrollTop,
      );
      await draft.evaluate((el) => {
        el.closest("article").scrollTop = 300;
      });
      assert.ok(
        await draft.evaluate((el) => el.closest("article").scrollTop > 0),
      );
      assert.equal(
        await main.evaluate((el) => el.closest("article").scrollTop),
        mainScroll,
      );
      await draft.fill("An alternative chapter. שלום עולם.");
      await page.screenshot({
        path: path.join(screenshots, "desktop.png"),
        fullPage: true,
      });
      // Confirm promotion and recover from the dated draft; original alternative survives.
      await page
        .getByRole("button", { name: "Promote to Main", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Promote to Main", exact: true })
        .click();
      assert.equal(
        await main.innerText(),
        "An alternative chapter. שלום עולם.",
      );
      const backup = await page
        .getByRole("combobox", { name: "Select draft", exact: true })
        .locator("option")
        .evaluateAll((els) =>
          els
            .map((e) => ({ value: e.value, text: e.textContent }))
            .find((e) => e.text.startsWith("Previous Main")),
        );
      await page
        .getByRole("combobox", { name: "Select draft", exact: true })
        .selectOption(backup.value);
      assert.equal(await draft.innerText(), mainText);
      await page
        .getByRole("button", { name: "Promote to Main", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Promote to Main", exact: true })
        .click();
      assert.equal(await main.innerText(), mainText);
      // Mobile switches hide a panel without unmounting its editor.
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await main.isVisible(), false);
      assert.equal(await draft.isVisible(), true);
      await page
        .getByRole("navigation", { name: "Writing panel" })
        .getByRole("button", { name: "Main", exact: true })
        .click();
      assert.equal(await main.isVisible(), true);
      assert.equal(await draft.isVisible(), false);
      await page
        .getByRole("navigation", { name: "Writing panel" })
        .getByRole("button", { name: "Draft", exact: true })
        .click();
      assert.equal(await draft.innerText(), mainText);
      await page.screenshot({
        path: path.join(screenshots, "mobile.png"),
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page
        .getByRole("button", { name: "Close draft", exact: true })
        .click();
      await page.setViewportSize({ width: 1365, height: 900 });
      assert.equal(await page.locator(".ws-sidebar").isVisible(), true);
      // Entire chapter AI creates a draft directly; summary uses lightweight review.
      await main.click();
      await page.getByRole("button", { name: /^AI Edit/ }).click();
      await page
        .getByText("Text to edit", { exact: false })
        .locator("select")
        .selectOption("chapter");
      await page
        .getByRole("button", { name: "Generate suggestion", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Draft manuscript", exact: true })
        .waitFor();
      assert.ok((await draft.innerText()).includes("Miriam"));
      assert.equal(await main.innerText(), mainText);
      await page
        .getByRole("button", { name: "Close draft", exact: true })
        .click();
      await page.getByRole("button", { name: "Summary", exact: true }).click();
      await page.getByRole("button", { name: /^AI Edit/ }).click();
      await page
        .getByRole("button", { name: "Generate suggestion", exact: true })
        .click();
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      assert.ok(
        (
          await page
            .getByRole("textbox", { name: "Chapter summary", exact: true })
            .innerText()
        ).startsWith("A return home."),
      );
      assert.equal(await page.locator(".ws-draft-pane:visible").count(), 0);
      await page
        .getByRole("button", { name: "Close chapter summary", exact: true })
        .click();
      // Confirm delete, autosave, reload, and chapter switch.
      await page.getByText(/Drafts \(/).click();
      await page
        .getByRole("button", { name: "Alternative", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Delete draft", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete draft", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: /All changes saved|Unsaved changes|Saving/,
        })
        .click();
      await page
        .getByRole("button", { name: "✓ All changes saved", exact: true })
        .waitFor();
      const persisted = structuredClone(saved);
      assert.ok(
        persisted.chapters[0].drafts.some((d) => d.name.startsWith("AI ·")),
      );
      assert.ok(
        !persisted.chapters[0].drafts.some((d) => d.name === "Alternative"),
      );
      await page.reload();
      await main.waitFor();
      await page.getByText(/Drafts \(/).click();
      await page.getByRole("button", { name: "Draft 2", exact: true }).click();
      assert.equal(await draft.innerText(), "Second draft pending");
      await page
        .getByRole("button", { name: "Close draft", exact: true })
        .click();
      await page.locator(".ws-chapters button").nth(1).click();
      assert.equal(await page.locator(".ws-draft-pane:visible").count(), 0);
      assert.ok((await main.innerText()).includes("twenty years"));
      assert.equal(aiCalls, 4);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
