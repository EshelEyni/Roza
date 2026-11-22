const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "../frontend");
const priorReaderId = "507f1f77bcf86cd799439011";
const otherAdminId = "507f1f77bcf86cd799439012";
const book = "507f191e810c19729de860ea";
const navPaths = ["/reader", "/books", "/staging-room", "/dev-board"];

test("restricted navigation and direct routes follow the current account role", { timeout: 90_000 }, async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, "node_modules/vite/dist/node/index.js")));
  const cwd = process.cwd();
  let browser, server;
  try {
    process.chdir(root);
    server = await createServer({
      root,
      mode: "desktop",
      cacheDir: process.env.ROZA_TEST_VITE_CACHE,
      server: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    await server.listen();
    const origin = "http://127.0.0.1:" + server.httpServer.address().port;
    browser = await chromium.launch({ executablePath: process.env.ROZA_TEST_BROWSER });
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.rozaDesktop = { stagingRoom: {
        onLog: () => () => {},
        listBooks: async () => [],
        getListPrefs: async () => ({ order: [], hidden: [], showHidden: false }),
        connectionInfo: async () => ({ configured: false }),
      } };
    });

    let user = { id: priorReaderId, username: "Ticket77", language: "en", lastVisitedPage: "/home", roles: ["user"] };
    const requested = [];
    await page.route("**/api/**", async route => {
      const req = route.request();
      const url = new URL(req.url());
      requested.push(url.pathname);
      let data = [];
      if (url.pathname === "/api/auth/login/with-token" || url.pathname === "/api/auth/update") data = user;
      if (url.pathname === "/api/reader") data = { books: [], nextCursor: null };
      if (url.pathname === "/api/book/" + book) {
        data = {
          id: book, userId: user.id, name: "Role fixture", filterBy: "chapters",
          chapters: [], characters: [], themes: [], plotlines: [], notes: [],
        };
      }
      if (url.pathname === "/api/reader/" + book) {
        await route.fulfill({ status: 404, json: { message: "Fixture has no EPUB data" } });
        return;
      }
      const json = url.pathname === "/api/dev-board" ? [] : { status: "success", data };
      await route.fulfill({ json });
    });

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    async function signInAtHome() {
      await page.goto(origin + "/home");
      await page.getByRole("heading", { name: user.username }).waitFor();
    }
    async function expectNoAccess() {
      for (const href of navPaths) assert.equal(await nav.locator('a[href="' + href + '"]').count(), 0);
      for (const href of [...navPaths, "/publishing?from=test", "/reader/" + book, "/book-edit/" + book]) {
        await page.goto(origin + href);
        await page.waitForURL(origin + "/home");
      }
    }

    await signInAtHome();
    await expectNoAccess();
    assert.equal(requested.some(url => /^\/api\/(?:reader|book(?:\/|$)|dev-board)/.test(url)), false);

    user = { ...user, id: otherAdminId, roles: ["user", "admin"] };
    await signInAtHome();
    for (const href of navPaths) await nav.locator('a[href="' + href + '"]').waitFor();
    await nav.locator('a[href="/reader"]').click();
    await page.locator(".reader-library").waitFor();
    await page.goto(origin + "/reader/" + book);
    await page.locator(".reader-details").waitFor();
    await page.goto(origin + "/books");
    await page.getByRole("button", { name: /New manuscript/ }).waitFor();
    await page.goto(origin + "/book-edit/" + book);
    await page.locator("summary.ws-more").click();
    await page.getByRole("button", { name: "Publish EPUB" }).waitFor();
    await page.goto(origin + "/publishing?from=test");
    await page.waitForURL(origin + "/staging-room?from=test");
    await page.locator(".roza-staging-room").waitFor();
    await page.goto(origin + "/dev-board");
    await page.waitForFunction(() => document.title === "Roza / Dev Board");

    user = { ...user, roles: undefined };
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await page.waitForURL(origin + "/home", { timeout: 10_000 });
    await expectNoAccess();
  } finally {
    await browser?.close();
    await server?.close();
    process.chdir(cwd);
  }
});
