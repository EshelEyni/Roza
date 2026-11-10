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
  "task board: details, persistence, keyboard sorting, mobile and manuscript return",
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
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
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
    const screenshots = path.join(root, "docs/task-board/screenshots");
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
      page.on("dialog", (dialog) => dialog.accept());
      const base = server.resolvedUrls.local[0];

      await page.goto(base + "book-edit/" + initial.id);
      await chooseWorkspace(page, "Tasks");
      assert.deepEqual(
        await page
          .getByRole("textbox", { name: "List title", exact: true })
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        ["To Do", "In Progress", "Done"],
      );
      assert.equal(await page.getByPlaceholder("What needs doing?").count(), 0);
      const addCard = page
        .locator(".tb-list")
        .first()
        .getByRole("button", { name: "＋ Add Card", exact: true });
      await addCard.click();
      await page.getByPlaceholder("What needs doing?").blur();
      assert.equal(await page.getByPlaceholder("What needs doing?").count(), 0);
      await addCard.click();
      assert.equal(
        await page
          .getByRole("button", { name: "Close new card", exact: true })
          .count(),
        0,
      );
      await page.getByPlaceholder("What needs doing?").press("Escape");
      assert.equal(await page.getByPlaceholder("What needs doing?").count(), 0);
      await addCard.click();
      await page
        .getByRole("textbox", { name: "New task in To Do", exact: true })
        .fill("Research the setting");
      await page
        .locator(".tb-list")
        .first()
        .getByRole("button", { name: "Add card", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Research the setting", exact: true })
        .click();
      await page
        .getByLabel("Description", { exact: true })
        .fill("Read the historical archives");
      assert.equal(
        await page
          .locator(
            '.tb-dialog input[type="date"], .tb-dialog progress',
          )
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator(".tb-dialog textarea")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        await page
          .getByRole("textbox", { name: "Title", exact: true })
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      await page.screenshot({
        path: path.join(screenshots, "task-details.png"),
      });
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Done", exact: true })
        .click();
      await page
        .getByRole("button", { name: "✓ All changes saved", exact: true })
        .waitFor();
      assert.equal(
        saved.taskBoard.lists[0].cards[0].description,
        "Read the historical archives",
      );

      assert.equal(saved.chapters[0].name, initial.chapters[0].name);
      await page.reload();
      assert.equal(await page.locator(".ws-task-entry").count(), 0);
      await chooseWorkspace(page, "Tasks");
      await page
        .getByRole("button", { name: /Research the setting/ })
        .waitFor();
      const handles = page.getByRole("button", {
        name: "Reorder list",
        exact: true,
      });
      await handles.first().focus();
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);
      await page
        .getByRole("button", { name: "✓ All changes saved", exact: true })
        .waitFor();
      assert.equal(saved.taskBoard.lists[1].title, "To Do");
      for (const target of [2, 0]) {
        const grip = await page
          .getByRole("button", { name: "Reorder task", exact: true })
          .boundingBox();
        const dest = await page
          .locator(".tb-list")
          .nth(target)
          .locator("header")
          .boundingBox();
        await page.mouse.move(
          grip.x + grip.width / 2,
          grip.y + grip.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          dest.x + dest.width / 2,
          dest.y + dest.height / 2,
          { steps: 20 },
        );
        await page.mouse.up();
        await page.waitForFunction(
          (i) =>
            !!document
              .querySelectorAll(".tb-list")
              [i].querySelector(".tb-card"),
          target,
        );
        await page
          .getByRole("button", { name: "✓ All changes saved", exact: true })
          .waitFor();
        assert.equal(
          saved.taskBoard.lists[target].cards[0].title,
          "Research the setting",
        );
      }

      await page
        .getByRole("button", { name: "＋ Add List", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "List title", exact: true })
        .last()
        .fill("Revision");
      await page
        .getByRole("button", { name: "✓ All changes saved", exact: true })
        .waitFor();
      await page.screenshot({
        path: path.join(screenshots, "tasks-desktop.png"),
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page
          .locator(".tb-columns")
          .evaluate((el) => el.scrollWidth > el.clientWidth),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: path.join(screenshots, "tasks-mobile.png"),
      });
      await page.getByRole("button", { name: /Research the setting/ }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete task", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Delete permanently?" })
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.equal(saved.taskBoard.lists.flatMap((l) => l.cards).length, 1);
      await page
        .getByRole("button", { name: "Delete task", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Delete permanently?" })
        .getByRole("button", { name: "Delete", exact: true })
        .click();

      await page
        .getByRole("button", { name: "✓ All changes saved", exact: true })
        .waitFor();
      assert.equal(saved.taskBoard.lists.flatMap((l) => l.cards).length, 0);
      await chooseWorkspace(page, "Chapters");
      await page
        .getByRole("textbox", { name: "Chapter or page title", exact: true })
        .waitFor();
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
