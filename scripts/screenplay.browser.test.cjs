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
test(
  "screenplay writing: keyboard blocks, persistence, history and mobile",
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
        if (dialog.type() === "beforeunload") {
          void dialog.accept();
          return;
        }
        errors.push("Unexpected native confirmation");
        void dialog.dismiss();
      });
      const base = server.resolvedUrls.local[0];

      await page.goto(base + "book-edit/" + initial.id);
      const openFormat = async () => {
        await page.locator(".ws-item-menu > summary").click();
        await page
          .getByRole("button", { name: "Chapter Format", exact: true })
          .click();
        return page.getByRole("dialog", {
          name: "Chapter Format",
          exact: true,
        });
      };
      assert.equal(
        await page
          .getByRole("combobox", { name: "Chapter format", exact: true })
          .count(),
        0,
      );
      let formatDialog = await openFormat();
      await formatDialog.getByRole("radio", { name: /Screenplay/ }).check();
      await formatDialog
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.equal(await page.locator(".sp-tools").count(), 0);
      formatDialog = await openFormat();
      await formatDialog.getByRole("radio", { name: /Screenplay/ }).check();
      await page.screenshot({
        path: path.join(screenshots, "chapter-format-dialog.png"),
      });
      await formatDialog
        .getByRole("button", { name: "Apply format", exact: true })
        .click();
      const editor = page.getByRole("textbox", {
        name: "Manuscript",
        exact: true,
      });
      await editor.click();
      await page.keyboard.press("Control+Home");
      await page
        .getByLabel("Screenplay element", { exact: true })
        .selectOption("scene_heading");
      await editor.click();
      await page.keyboard.press("Control+Home");
      await page.keyboard.type("INT. ROOM - DAY");
      await page.keyboard.press("Enter");
      await page.keyboard.type("A door opens.");
      await page.keyboard.press("Enter");
      await page
        .getByLabel("Screenplay element", { exact: true })
        .selectOption("character");
      await page.keyboard.type("mara");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Hello there.");
      assert.ok(await editor.locator(".sp-character").count());
      assert.ok(await editor.locator(".sp-dialogue").count());
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+Shift+z");
      await page.waitForTimeout(2200);
      assert.equal(saved.chapters[0].format, "screenplay");
      assert.ok(saved.chapters[0].text.some((b) => b.type === "dialogue"));
      await page.reload();
      await editor.waitFor();
      formatDialog = await openFormat();
      assert.equal(
        await formatDialog
          .getByRole("radio", { name: /Screenplay/ })
          .isChecked(),
        true,
      );
      await page.keyboard.press("Escape");
      assert.ok(
        await editor.innerText().then((t) => t.includes("Hello there.")),
      );
      await editor.click();
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Enter");
      await page
        .getByLabel("Screenplay element", { exact: true })
        .selectOption("character");
      await page.keyboard.type("ELIJAH");
      await page
        .getByRole("button", {
          name: "Add ELIJAH to Character Library",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Character library", { exact: true })
        .selectOption("ELIJAH");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Good morning.");
      assert.equal(
        await page
          .getByLabel("Tab cycles elements (Escape to release)")
          .count(),
        0,
      );
      await editor.click();
      await page.keyboard.press("Control+End");
      const typeBeforeTab = await page
        .getByLabel("Screenplay element", { exact: true })
        .inputValue();
      await page.keyboard.press("Tab");
      assert.equal(
        await editor.evaluate((el) => el.contains(document.activeElement)),
        false,
      );
      assert.equal(
        await page
          .getByLabel("Screenplay element", { exact: true })
          .inputValue(),
        typeBeforeTab,
      );
      await editor.click();
      await page.keyboard.press("Control+End");
      await editor.evaluate((el) => {
        const data = new DataTransfer();
        data.setData(
          "text/plain",
          "\nINT. HALL - NIGHT\n\nMARA\n(softly)\nWelcome.",
        );
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await editor.locator(".sp-scene_heading").nth(1).waitFor();
      assert.ok((await editor.locator(".sp-scene_heading").count()) >= 2);
      const sceneDropdown = page.getByLabel("Scene navigation", {
        exact: true,
      });
      await sceneDropdown.selectOption({ label: "1. INT. ROOM - DAY" });
      await page.waitForFunction(
        () =>
          window
            .getSelection()
            ?.anchorNode?.parentElement?.closest(
              '[data-screenplay="scene_heading"]',
            )?.textContent === "INT. ROOM - DAY",
      );
      await sceneDropdown.selectOption({ label: "2. INT. HALL - NIGHT" });
      await page.waitForFunction(
        () =>
          window
            .getSelection()
            ?.anchorNode?.parentElement?.closest(
              '[data-screenplay="scene_heading"]',
            )?.textContent === "INT. HALL - NIGHT",
      );
      await page.waitForTimeout(2200);
      assert.ok(saved.characters.some((c) => c.name === "ELIJAH"));
      await page.screenshot({
        path: path.join(screenshots, "screenplay-desktop.png"),
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: path.join(screenshots, "screenplay-mobile.png"),
      });
      await page.setViewportSize({ width: 1365, height: 900 });
      const textBeforeProse = await editor.innerText();
      formatDialog = await openFormat();
      await formatDialog.getByRole("radio", { name: /Prose/ }).check();
      await formatDialog
        .getByRole("button", { name: "Apply format", exact: true })
        .click();
      assert.equal(await editor.locator(".sp-block").count(), 0);
      assert.equal(await editor.innerText(), textBeforeProse);
      await page.waitForTimeout(2200);
      assert.equal(saved.chapters[0].format, "prose");
      assert.ok(
        saved.chapters[0].text.every((block) => block.type === "paragraph"),
      );
      await page.reload();
      await editor.waitFor();
      assert.equal(await editor.locator("[data-screenplay]").count(), 0);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
