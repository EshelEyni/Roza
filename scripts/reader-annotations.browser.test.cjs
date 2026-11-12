const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const JSZip = require("../frontend/node_modules/jszip");
const root = path.resolve(__dirname, "..");

test(
  "saved annotations with real EPUB rendering on desktop and iPhone WebKit",
  { timeout: 180000 },
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
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file(
      "META-INF/container.xml",
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    );
    zip.file(
      "book.opf",
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">annotations</dc:identifier><dc:title>Annotations</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c0" href="c0.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c0"/><itemref idref="c1"/></spine></package>',
    );
    for (let i = 0; i < 2; i++)
      zip.file(
        `c${i}.xhtml`,
        `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${i}</title></head><body><p>${Array.from({ length: 500 }, (_, n) => `chapter${i}word${n}`).join(" ")}</p></body></html>`,
      );
    const file = await zip.generateAsync({ type: "nodebuffer" });
    const aliases = [
      "react",
      "react-dom",
      "epubjs",
      "react-icons",
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
      cacheDir: path.join(root, ".annotations-test-cache"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: { entries: ["scripts/fixtures/reader-annotations.tsx"] },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
    });
    const saved = new Map();
    let sequence = 0;
    server.middlewares.use("/api/reader", (req, res) => {
      const parts = req.url.split("?")[0].split("/").filter(Boolean);
      res.setHeader("Cache-Control", "no-store");
      if (parts[1] === "file") {
        res.setHeader("Content-Type", "application/epub+zip");
        res.end(file);
        return;
      }
      res.setHeader("Content-Type", "application/json");
      const owner =
        /owner=([^;]+)/.exec(req.headers.cookie || "")?.[1] || "fixture";
      const key = owner + ":" + parts[0];
      const items = saved.get(key) || [];
      const respond = (data) =>
        res.end(JSON.stringify({ status: "success", data }));
      if (parts[1] !== "annotations") {
        respond(parts[1] === "conversations" ? { items: [] } : {});
        return;
      }
      if (req.method === "GET") {
        respond(items);
        return;
      }
      if (req.method === "DELETE") {
        saved.set(
          key,
          items.filter((item) => item.id !== parts[2]),
        );
        respond(null);
        return;
      }
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const input = JSON.parse(body);
        const previous = items.find(
          (item) =>
            item.cfi === input.cfi &&
            (item.endCfi || "") === (input.endCfi || ""),
        );
        const value = { ...input, id: previous?.id || String(++sequence) };
        saved.set(key, [
          ...items.filter((item) => item.id !== value.id),
          value,
        ]);
        respond(value);
      });
    });
    server.middlewares.use("/annotations-test", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/annotations-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-annotations.tsx"></script></body></html>',
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
              !mobile && process.env.PLAYWRIGHT_CHANNEL
                ? { channel: process.env.PLAYWRIGHT_CHANNEL }
                : {},
            );
            try {
              const context = await browser.newContext({
                viewport: { width: mobile ? 390 : 1280, height: 844 },
                isMobile: mobile,
                hasTouch: mobile,
              });
              const owner = mobile ? "iphone" : "desktop";
              const origin = server.resolvedUrls.local[0];
              await context.addCookies([
                { name: "owner", value: owner, url: origin },
              ]);
              const page = await context.newPage();
              page.setDefaultTimeout(8000);
              const errors = [];
              page.on("pageerror", (err) => errors.push(err.message));
              const ready = () =>
                page.waitForFunction(
                  () =>
                    window.annotationTest?.reader.searchBook &&
                    !window.annotationTest.reader.loading &&
                    !window.annotationTest.reader.annotations.loading,
                );
              await page.goto(origin + "annotations-test?user=" + owner);
              await ready();
              // Use a real iframe DOM range and its section CFI, then activate the production selection action.
              const passage = await page.evaluate(() => {
                const r = window.annotationTest.reader;
                const doc =
                  r.host.current.querySelector("iframe").contentDocument;
                const range = doc.createRange();
                const node = doc.querySelector("p").firstChild;
                range.setStart(node, 0);
                range.setEnd(node, 41);
                return {
                  cfi: r.searchBook.spine.get(0).cfiFromRange(range),
                  text: range.toString(),
                  x: 30,
                  y: 70,
                };
              });
              await page.waitForFunction(() => {
                const doc =
                  window.annotationTest.reader.host.current.querySelector(
                    "iframe",
                  ).contentDocument;
                const width = doc.documentElement.scrollWidth;
                const previous = window.layoutSample;
                if (!previous || previous.width !== width) {
                  window.layoutSample = { width, time: Date.now() };
                  return false;
                }
                return Date.now() - previous.time > 500;
              });
              const before = await page.evaluate(() => {
                const host = window.annotationTest.reader.host.current;
                const doc = host.querySelector("iframe").contentDocument;
                return {
                  text: doc.body.textContent.length,
                  width: doc.documentElement.scrollWidth,
                  height: doc.body.scrollHeight,
                };
              });
              await page.evaluate(() => {
                const r = window.annotationTest.reader;
                const doc =
                  r.host.current.querySelector("iframe").contentDocument;
                const range = doc.createRange();
                range.setStart(doc.querySelector("p").firstChild, 0);
                range.setEnd(doc.querySelector("p").firstChild, 41);
                doc.getSelection().removeAllRanges();
                doc.getSelection().addRange(range);
                doc.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
              });
              await page.waitForFunction(
                () => !!window.annotationTest.reader.textSelection,
              );
              await page
                .getByRole("button", { name: "Highlight", exact: true })
                .click();
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items.length === 1,
              );
              await page.waitForSelector(".reader-saved-annotation rect");
              assert.equal(
                await page
                  .locator(".reader-saved-annotation rect")
                  .first()
                  .evaluate((el) => getComputedStyle(el).fill),
                "rgb(245, 217, 78)",
              );
              assert.deepEqual(
                await page.evaluate(() => {
                  const doc =
                    window.annotationTest.reader.host.current.querySelector(
                      "iframe",
                    ).contentDocument;
                  return {
                    text: doc.body.textContent.length,
                    width: doc.documentElement.scrollWidth,
                    height: doc.body.scrollHeight,
                  };
                }),
                before,
              );
              await page.evaluate(() =>
                window.annotationTest.reader.onNavigate("c1.xhtml"),
              );
              await page.waitForFunction(
                () => window.annotationTest.reader.href === "c1.xhtml",
              );
              await page.evaluate(
                (p) => window.annotationTest.reader.onNavigate(p.cfi),
                passage,
              );
              await page.waitForFunction(
                () => window.annotationTest.reader.href === "c0.xhtml",
              );
              await page.waitForSelector(".reader-saved-annotation rect");
              await page.reload();
              await ready();
              await page.waitForSelector(".reader-saved-annotation rect");
              // View and edit from a click on the actual saved SVG range.
              await page
                .locator(".reader-saved-annotation")
                .evaluate((el) => el.dispatchEvent(new MouseEvent("click")));
              await page.getByLabel("Personal note").fill("A personal note");
              await page
                .getByRole("button", { name: "Pink", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Save", exact: true })
                .click();
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items[0]?.note ===
                  "A personal note",
              );
              await page
                .getByRole("button", { name: "Edit / Add note", exact: true })
                .click();
              await page.getByLabel("Personal note").fill("Edited note");
              await page
                .getByRole("button", { name: "Save", exact: true })
                .click();
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items[0]?.note ===
                  "Edited note",
              );
              await page.evaluate(() =>
                window.annotationTest.reader.closePanel(),
              );
              await page.evaluate(() => {
                const r = window.annotationTest.reader;
                r.updateState({
                  preferences: { ...r.state.preferences, fontSize: 28 },
                });
              });
              await page.setViewportSize({
                width: mobile ? 430 : 1400,
                height: 900,
              });
              await page.waitForSelector(
                '.reader-saved-annotation[data-note="true"][data-color="pink"] rect',
              );
              if (!mobile) {
                await page
                  .getByRole("button", { name: "Test fullscreen", exact: true })
                  .click();
                await page.waitForFunction(
                  () => window.annotationTest.reader.fullscreen,
                );
                await page.waitForSelector(
                  '.reader-saved-annotation[data-color="pink"] rect',
                );
                await page
                  .getByRole("button", { name: "Test fullscreen", exact: true })
                  .click();
                await page.waitForFunction(
                  () => !window.annotationTest.reader.fullscreen,
                );
              }
              await page.evaluate(() =>
                window.annotationTest.reader.onNavigate("c1.xhtml"),
              );
              await page.waitForFunction(
                () => window.annotationTest.reader.href === "c1.xhtml",
              );
              await page
                .getByRole("button", { name: "Annotations", exact: true })
                .click();
              await page.locator(".reader-annotation-passage").click();
              await page.waitForFunction(
                () => window.annotationTest.reader.href === "c0.xhtml",
              );
              await page.waitForSelector(
                '.reader-saved-annotation[data-note="true"][data-color="pink"] rect',
              );
              await page
                .getByRole("button", { name: "Annotations", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Edit / Add note", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Remove note", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Save", exact: true })
                .click();
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items[0]?.note ===
                  "",
              );
              await page.evaluate(() =>
                window.annotationTest.reader.closePanel(),
              );
              // An overlapping selection must coexist, and removing it must preserve the first.
              const overlap = await page.evaluate(() => {
                const r = window.annotationTest.reader;
                const doc =
                  r.host.current.querySelector("iframe").contentDocument;
                const range = doc.createRange();
                range.setStart(doc.querySelector("p").firstChild, 15);
                range.setEnd(doc.querySelector("p").firstChild, 80);
                return {
                  cfi: r.searchBook.spine.get(0).cfiFromRange(range),
                  text: range.toString(),
                  x: 30,
                  y: 70,
                };
              });
              await page.evaluate(
                (p) =>
                  window.annotationTest.reader.annotations.select(p, false),
                overlap,
              );
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items.length === 2,
              );
              assert.equal(
                await page.locator(".reader-saved-annotation").count(),
                2,
              );
              assert.equal(
                await page.evaluate(
                  () => window.annotationTest.reader.annotations.items[0].color,
                ),
                "pink",
              );
              await page.evaluate((cfi) => {
                const a = window.annotationTest.reader.annotations;
                return a.remove(a.items.find((item) => item.cfi === cfi).id);
              }, overlap.cfi);
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items.length === 1,
              );
              await page.waitForSelector(
                '.reader-saved-annotation[data-color="pink"] rect',
              );
              // Extended selections spanning chapters restore one native overlay per section.
              const extended = await page.evaluate(async (p) => {
                const book = window.annotationTest.reader.searchBook;
                const section = book.spine.get(1);
                await section.load(book.load.bind(book));
                const range = section.document.createRange();
                range.setStart(
                  section.document.querySelector("p").firstChild,
                  45,
                );
                range.collapse(true);
                return { ...p, endCfi: section.cfiFromRange(range) };
              }, passage);
              await page.evaluate(
                (p) =>
                  window.annotationTest.reader.annotations.select(p, false),
                extended,
              );
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items.length === 2,
              );
              await page.evaluate(() =>
                window.annotationTest.reader.onNavigate("c1.xhtml"),
              );
              await page.waitForFunction(
                () => window.annotationTest.reader.href === "c1.xhtml",
              );
              await page.waitForSelector(".reader-saved-annotation rect");
              await page.reload();
              await ready();
              await page.waitForSelector(".reader-saved-annotation rect");
              await page.evaluate(() => {
                const a = window.annotationTest.reader.annotations;
                return a.remove(a.items.find((item) => item.endCfi).id);
              });
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items.length === 1,
              );
              await page.goto(
                origin + "annotations-test?book=another&user=" + owner,
              );
              await ready();
              assert.equal(
                await page.evaluate(
                  () => window.annotationTest.reader.annotations.items.length,
                ),
                0,
              );
              await context.addCookies([
                { name: "owner", value: "another-user", url: origin },
              ]);
              await page.goto(origin + "annotations-test?user=another-user");
              await ready();
              assert.equal(
                await page.evaluate(
                  () => window.annotationTest.reader.annotations.items.length,
                ),
                0,
              );
              await context.addCookies([
                { name: "owner", value: owner, url: origin },
              ]);
              await page.goto(origin + "annotations-test?user=" + owner);
              await ready();
              await page
                .getByRole("button", { name: "Annotations", exact: true })
                .click();
              await page
                .getByRole("button", { name: "Delete annotation", exact: true })
                .click();
              await page.waitForFunction(
                () =>
                  window.annotationTest.reader.annotations.items.length === 0,
              );
              assert.equal(
                await page.locator(".reader-saved-annotation").count(),
                0,
              );
              assert.deepEqual(errors, []);
              await context.close();
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
