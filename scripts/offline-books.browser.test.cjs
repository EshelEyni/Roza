const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium, _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const JSZip = require("../frontend/node_modules/jszip");

const root = path.resolve(__dirname, "..");
const user = { id: "owner", username: "Writer", language: "en", roles: ["admin"], lastVisitedPage: "/reader" };
const updatedAt = "2026-11-23T00:00:00.000Z";
const readers = Array.from({ length: 9 }, (_, index) => ({
  id: "reader-" + index, title: "Cached EPUB " + index, author: "Fixture Author",
  cover: "", createdAt: updatedAt, updatedAt, fileRevision: "v1",
  state: { location: "", progress: 0, savedAt: 100 - index, preferences: {
    fontSize: 20, fontFamily: "serif", lineHeight: 1.7, width: "comfortable", theme: "sepia", flow: "paginated",
  } },
}));
const manuscripts = Array.from({ length: 7 }, (_, index) => ({
  id: "studio-" + index, name: "Cached Manuscript " + index, updatedAt, chapterCount: 1, wordCount: 3,
}));

async function fixtureServer() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file("book.opf", '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">offline-fixture</dc:identifier><dc:title>Cached EPUB</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>');
  zip.file("chapter.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><p>Saved EPUB text</p></body></html>');
  const epub = await zip.generateAsync({ type: "nodebuffer" });
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
  const server = createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, "http://localhost");
    if (pathname.startsWith("/api/")) {
      let data = [];
      if (pathname.startsWith("/api/auth/")) data = user;
      if (pathname === "/api/reader") {
        const offline = searchParams.get("ignorePins") === "true";
        data = { books: offline ? readers.slice(0, 8) : readers, nextCursor: null };
      }
      if (pathname.startsWith("/api/reader/reader-")) {
        if (pathname.endsWith("/file")) {
          res.writeHead(200, { "Content-Type": "application/epub+zip" });
          return res.end(epub);
        }
        data = readers.find(book => pathname === "/api/reader/" + book.id);
      }
      if (pathname === "/api/book/manuscripts") {
        data = { manuscripts, total: manuscripts.length, nextOffset: null };
      } else if (pathname.startsWith("/api/book/studio-")) {
        const summary = manuscripts.find(book => pathname === "/api/book/" + book.id);
        data = { ...summary, userId: user.id, filterBy: "chapters", characters: [], themes: [], plotlines: [], notes: [],
          chapters: [{ id: "chapter", name: "First chapter", text: [{ type: "paragraph", children: [{ text: "Saved manuscript text" }] }] }] };
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "success", data }));
    }
    const file = path.extname(pathname) ? pathname : "/index.html";
    try {
      const body = await readFile(path.join(root, "frontend/dist", file));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function waitForSnapshots(page) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(async () => {
      if (!(await indexedDB.databases()).some(db => db.name === "roza-offline-books")) return false;
      return new Promise(resolve => {
        const open = indexedDB.open("roza-offline-books");
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction("snapshots");
          const store = transaction.objectStore("snapshots");
          const reader = store.get("owner:reader");
          const studio = store.get("owner:studio");
          transaction.oncomplete = () => {
            db.close();
            resolve(reader.result?.length === 8 && studio.result?.length === 6);
          };
        };
        open.onerror = () => resolve(false);
      });
    });
    if (ready) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail("The offline book snapshots were not saved");
}

async function checkOffline(page, origin) {
  if (page.url() !== origin + "/reader") await page.goto(origin + "/reader");
  await page.getByText("Cached EPUB 7", { exact: true }).first().waitFor();
  assert.equal(await page.getByText("Cached EPUB 8", { exact: true }).count(), 0);
  await page.goto(origin + "/reader/reader-0");
  await page.frameLocator("iframe").getByText("Saved EPUB text").waitFor();

  await page.goto(origin + "/books");
  await page.getByRole("link", { name: "Write Cached Manuscript 5" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Write Cached Manuscript 6" }).count(), 0);
  await page.goto(origin + "/book-edit/studio-0");
  await page.getByText("Saved manuscript text", { exact: true }).first().waitFor();
}

test("the installed PWA cold-loads only the eight EPUBs and six manuscripts saved offline", { timeout: 90_000 }, async () => {
  const server = await fixtureServer();
  const origin = "http://127.0.0.1:" + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    const context = await browser.newContext();
    const online = await context.newPage();
    await online.goto(origin + "/reader");
    await waitForSnapshots(online);
    await online.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    const offline = await context.newPage();
    await online.close();
    await checkOffline(offline, origin);
  } finally {
    await browser?.close();
    server.close();
  }
});

test("Electron cold-loads the same saved books with its API disconnected", {
  skip: !process.env.ROZA_TEST_ELECTRON, timeout: 90_000,
}, async () => {
  const server = await fixtureServer();
  const apiOrigin = "http://127.0.0.1:" + server.address().port;
  const profile = await require("node:fs/promises").mkdtemp(path.join(root, "desktop", "offline-test-profile-"));
  const launch = () => _electron.launch({
    executablePath: process.env.ROZA_TEST_ELECTRON,
    args: [path.join(root, "desktop"), "--api-origin=" + apiOrigin, "--data-dir=" + profile],
  });
  let app;
  try {
    app = await launch();
    await waitForSnapshots(await app.firstWindow());
    await app.close();
    await new Promise(resolve => server.close(resolve));
    app = await launch();
    const page = await app.firstWindow();
    const origin = "https://roza.esheleyni.com";
    await page.waitForURL(origin + "/reader");
    await checkOffline(page, origin);
  } finally {
    await app?.close();
    server.close();
    await require("node:fs/promises").rm(profile, { recursive: true, force: true });
  }
});
