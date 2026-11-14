const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const root = path.resolve(__dirname, "..");
test(
  "book management on desktop Chromium and mobile WebKit",
  { timeout: 120000 },
  async (t) => {
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
    const aliases = [
      "react",
      "react-dom",
      "react-icons",
      "react-router-dom",
      "@tanstack/react-query",
      "i18next",
      "react-i18next",
      "axios",
    ].map((name) => ({
      find: name,
      replacement: path
        .join(root, "frontend/node_modules", name)
        .replaceAll("\\", "/"),
    }));
    const server = await createServer({
      configFile: false,
      appType: "custom",
      root,
      cacheDir: path.join(root, ".book-management-test-cache"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: {
        entries: ["scripts/fixtures/reader-book-management.tsx"],
      },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
    });
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== "/fixture") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/fixture",
          '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-book-management.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    try {
      for (const mobile of [false, true])
        await t.test(
          mobile ? "iPhone WebKit" : "desktop Chromium",
          async () => {
            const browser = await (mobile ? webkit : chromium).launch(
              mobile ? {} : { channel: "msedge" },
            );
            try {
              const context = await browser.newContext({
                viewport: mobile
                  ? { width: 390, height: 844 }
                  : { width: 1280, height: 900 },
                ...(mobile
                  ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
                  : {}),
              });
              const page = await context.newPage();
              page.setDefaultTimeout(10000);
              const errors = [];
              page.on("pageerror", (e) => errors.push(e.message));
              let book = {
                id: "book35",
                title: "Original title",
                author: "Fixture",
                cover: "",
                filename: "fixture.epub",
                size: 100,
                archived: false,
                state: { progress: 0.5, preferences: {} },
                createdAt: "2026-11-14",
                updatedAt: "2026-11-14",
              };
              let deletes = 0,
                fail = false;
              await page.route("**/api/reader**", async (route) => {
                const req = route.request(),
                  url = new URL(req.url());
                if (fail && req.method() !== "GET")
                  return route.fulfill({
                    status: 500,
                    json: { message: "Please retry this operation." },
                  });
                if (req.method() === "DELETE") {
                  deletes++;
                  book = null;
                  return route.fulfill({
                    json: { status: "success", data: null },
                  });
                }
                if (req.method() === "PATCH")
                  Object.assign(book, req.postDataJSON());
                const data =
                  req.method() === "GET"
                    ? book &&
                      book.archived ===
                        (url.searchParams.get("archived") === "true")
                      ? [book]
                      : []
                    : book;
                await route.fulfill({ json: { status: "success", data } });
              });
              const open = async () => {
                await page
                  .getByRole("button", { name: /Book actions/ })
                  .click();
              };
              const visible = async (locator) =>
                assert.equal(await locator.isVisible(), true);
              await page.goto(
                "http://127.0.0.1:" +
                  server.httpServer.address().port +
                  "/fixture",
              );
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              await open();
              assert.equal(
                await page
                  .getByRole("menuitem", { name: "Delete Permanently" })
                  .count(),
                0,
              );
              await page
                .getByRole("menuitem", { name: "Rename", exact: true })
                .click();
              const input = page.getByRole("textbox", { name: "Book title" });
              assert.equal(await input.inputValue(), "Original title");
              await input.fill("   ");
              assert.equal(
                await page
                  .getByRole("button", { name: "Save title" })
                  .isDisabled(),
                true,
              );
              await input.fill("Renamed title");
              fail = true;
              await page.getByRole("button", { name: "Save title" }).click();
              await page.getByRole("alert").waitFor();
              await visible(page.getByText("Please retry this operation."));
              fail = false;
              await page.getByRole("button", { name: "Save title" }).click();
              await page.getByRole("dialog").waitFor({ state: "detached" });
              await visible(page.getByText("Renamed title", { exact: true }));
              assert.equal(book.state.progress, 0.5);
              await page.reload();
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              await visible(page.getByText("Renamed title", { exact: true }));
              await open();
              await page
                .getByRole("menuitem", { name: "Archive", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
              assert.equal(book.archived, false);
              await open();
              await page
                .getByRole("menuitem", { name: "Archive", exact: true })
                .click();
              await page
                .getByRole("dialog")
                .getByRole("button", { name: "Archive", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Archived Books", exact: true })
                .click();
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              await open();
              await page
                .getByRole("menuitem", { name: "Restore", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Active Books", exact: true })
                .click();
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              assert.equal(book.archived, false);
              await open();
              await page
                .getByRole("menuitem", { name: "Archive", exact: true })
                .click();
              await page
                .getByRole("dialog")
                .getByRole("button", { name: "Archive", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Archived Books", exact: true })
                .click();
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              await open();
              await page
                .getByRole("menuitem", {
                  name: "Delete Permanently",
                  exact: true,
                })
                .click();
              await visible(
                page.getByText(/Permanently delete.*Renamed title/),
              );
              await visible(page.getByText(/This is irreversible/));
              const rect = await page.getByRole("dialog").boundingBox();
              assert.ok(
                rect.x >= 0 && rect.x + rect.width <= (mobile ? 390 : 1280),
              );
              await page
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
              assert.equal(deletes, 0);
              await open();
              await page
                .getByRole("menuitem", {
                  name: "Delete Permanently",
                  exact: true,
                })
                .click();
              fail = true;
              await page
                .getByRole("dialog")
                .getByRole("button", {
                  name: "Delete Permanently",
                  exact: true,
                })
                .click();
              await page.getByRole("alert").waitFor();
              assert.equal(deletes, 0);
              fail = false;
              await page
                .getByRole("dialog")
                .getByRole("button", {
                  name: "Delete Permanently",
                  exact: true,
                })
                .click();
              await page.getByRole("dialog").waitFor({ state: "detached" });
              assert.equal(deletes, 1);
              assert.equal(
                await page
                  .getByRole("button", { name: /Book actions/ })
                  .count(),
                0,
              );
              assert.deepEqual(errors, []);
            } finally {
              await browser.close();
            }
          },
        );
    } finally {
      await server.close();
    }
  },
);
