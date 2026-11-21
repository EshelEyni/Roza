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
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
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
      await t.test("eight-book pages, search, drag, keyboard moves and pins", async () => {
        const browser = await chromium.launch({ channel: "msedge" });
        try {
          const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
          page.setDefaultTimeout(10000);
          const rows = Array.from({ length: 17 }, (_, i) => ({
            id: String(i), title: "Book " + String(i).padStart(2, "0"),
            author: i === 16 ? "Matching Author" : "Writer",
            state: { progress: i === 1 ? 1 : i === 16 ? 0.5 : 0 }, pinned: false,
          }));
          const order = rows.map(book => book.id);
          let orderWrites = 0;
          let failNextPage = true;
          await page.route("**/api/reader**", async route => {
            const req = route.request();
            const url = new URL(req.url());
            const respond = data => route.fulfill({ json: { status: "success", data } });
            if (url.pathname.endsWith("/access")) return respond({ enabled: true });
            if (req.method() === "PATCH") {
              const [, id, action] = url.pathname.match(/([^/]+)\/(pin|order)$/);
              const data = req.postDataJSON();
              if (action === "pin") return respond(Object.assign(rows[Number(id)], data));
              orderWrites++;
              order.splice(order.indexOf(id), 1);
              order.splice(order.indexOf(data.anchorId) + Number(data.placement === "after"), 0, id);
              return respond(null);
            }
            const [sort, term, offset, status] = ["sort", "q", "cursor", "status"].map(key => url.searchParams.get(key));
            if (offset && failNextPage) {
              failNextPage = false;
              return route.fulfill({ status: 500 });
            }
            const matches = (sort === "custom" ? order.map(id => rows[Number(id)]) : [...rows])
              .filter(book => !status || status === (book.state.progress === 1 ? "finished" : book.state.progress > 0 ? "reading" : "unread"))
              .filter(book => !term || (book.title + " " + book.author).toLowerCase().includes(term.toLowerCase()))
              .sort((a, b) => Number(b.pinned) - Number(a.pinned));
            const start = Number(offset);
            return respond({
              books: matches.slice(start, start + 8),
              nextCursor: start + 8 < matches.length ? String(start + 8) : null,
              counts: { all: 17, reading: 1, unread: 15, finished: 1 },
            });
          });
          await page.goto("http://127.0.0.1:" + server.httpServer.address().port + "/fixture");
          const cards = page.locator("[data-book-id]");
          const firstTitle = title => cards.first().getByRole("heading", { name: title, exact: true }).waitFor();
          const chooseSort = async label => {
            await page.getByRole("combobox", { name: "Sort by" }).click();
            await page.getByRole("option", { name: label, exact: true }).click();
          };
          const drag = async (title, target) => {
            const source = page.getByRole("link", { name: new RegExp(title) });
            const destination = page.getByRole("link", { name: new RegExp(target) });
            await source.scrollIntoViewIfNeeded();
            await destination.scrollIntoViewIfNeeded();
            const from = await source.boundingBox();
            const to = await destination.boundingBox();
            await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
            await page.mouse.down();
            await page.locator(".is-dragging").waitFor();
            await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
            await page.mouse.up();
          };

          await firstTitle("Book 00");
          assert.equal(await cards.count(), 8);
          await page.getByRole("button", { name: "Load More", exact: true }).click();
          await page.getByRole("alert").waitFor();
          assert.equal(await cards.count(), 8);
          await page.getByRole("button", { name: "Retry", exact: true }).click();
          await cards.nth(15).waitFor();
          assert.equal(await cards.count(), 16);

          await page.getByRole("button", { name: "Reading", exact: true }).click();
          await firstTitle("Book 16");
          assert.equal(await cards.count(), 1);
          await page.getByRole("button", { name: "List view", exact: true }).click();
          await page.locator(".reader-book-list").waitFor();
          await page.getByRole("button", { name: "Grid view", exact: true }).click();
          await page.locator(".reader-book-list").waitFor({ state: "detached" });
          await page.getByRole("button", { name: "All", exact: true }).click();
          await firstTitle("Book 00");

          const search = page.getByRole("searchbox", { name: "Search by title or author" });
          await search.fill("Matching Author");
          await page.getByRole("status").waitFor();
          await firstTitle("Book 16");
          assert.equal(await cards.count(), 1);
          await search.fill("nobody");
          await page.getByRole("heading", { name: "No matching books" }).waitFor();
          await search.fill("");
          await chooseSort("Title");
          await firstTitle("Book 00");
          await drag("Book 01", "Book 00");
          await firstTitle("Book 01");
          assert.equal(orderWrites, 0);
          await page.getByRole("link", { name: /Book 01/ }).click();
          assert.equal(new URL(page.url()).pathname, "/reader/1");
          await page.goBack();
          await page.reload();
          await firstTitle("Book 00");
          assert.match(await page.getByRole("combobox").innerText(), /Title/);
          await chooseSort("Custom order");
          await firstTitle("Book 00");
          await drag("Book 01", "Book 00");
          await firstTitle("Book 01");
          assert.equal(orderWrites, 1);
          await page.getByRole("button", { name: "Move Book 01 down", exact: true }).press("Enter");
          await firstTitle("Book 00");
          await page.getByRole("button", { name: "Move Book 01 up", exact: true }).press("Enter");
          await firstTitle("Book 01");
          await page.reload();
          await firstTitle("Book 01");
          await search.fill("Matching Author");
          await firstTitle("Book 16");
          await page.getByRole("button", { name: "Book actions for Book 16" }).click();
          await page.getByRole("menuitem", { name: "Pin book", exact: true }).click();
          await page.getByText("Pinned", { exact: true }).waitFor();
          await search.fill("");
          await firstTitle("Book 16");
          await page.reload();
          await firstTitle("Book 16");
          await page.getByRole("button", { name: "Book actions for Book 16" }).click();
          await page.getByRole("menuitem", { name: "Unpin book", exact: true }).click();
          await firstTitle("Book 01");
        } finally {
          await browser.close();
        }
      });

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
                if (url.pathname.endsWith("/access"))
                  return route.fulfill({ json: { status: "success", data: { enabled: true } } });
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
                await route.fulfill({ json: { status: "success", data: req.method() === "GET" ? { books: data, nextCursor: null } : data } });
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
                  .getByRole("menuitem", { name: "Delete" })
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
              await page.getByText("Renamed title", { exact: true }).waitFor();
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
                .getByRole("button", { name: "Archived", exact: true })
                .click();
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              await open();
              await page
                .getByRole("menuitem", { name: "Restore", exact: true })
                .click();
              await page
                .getByRole("button", { name: "All", exact: true })
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
                .getByRole("button", { name: "Archived", exact: true })
                .click();
              await page
                .getByRole("button", { name: /Book actions/ })
                .waitFor();
              await open();
              await page
                .getByRole("menuitem", {
                  name: "Delete",
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
                  name: "Delete",
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
              await page.getByRole("button", { name: /Book actions/ }).waitFor({ state: "detached" });
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
