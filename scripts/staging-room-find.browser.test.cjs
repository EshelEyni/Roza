const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "../frontend");
const slug = "find-fixture";
const changeId = "chapter-1";

const readView = {
  id: changeId,
  title: "פרק ראשון",
  subtitle: "New draft",
  words: 40,
  editable: true,
  paragraphs: [
    { segments: [{ text: "The cat sat. ", isNew: false }, { text: "A new Cat arrived.", isNew: true }] },
    { segments: [{ text: "Concatenate the catalog.", isNew: false }] },
    { segments: [{ text: "שלום עולם. ", isNew: false }, { text: "שלום שוב, שלוםם.", isNew: true }] },
  ],
};
const textView = {
  id: changeId, slug, bookName: "Find fixture", title: readView.title, subtitle: "New draft", format: "prose",
  updatedAt: "2026-11-23T10:00:00.000Z",
  text: readView.paragraphs.map(p => ({ type: "paragraph", children: [{ text: p.segments.map(s => s.text).join("") }] })),
};

async function withStagingRoom(viewport, run) {
  const { createServer } = await import(pathToFileURL(path.join(root, "node_modules/vite/dist/node/index.js")));
  const cwd = process.cwd();
  let browser, server;
  try {
    process.chdir(root);
    server = await createServer({
      root,
      cacheDir: process.env.ROZA_TEST_VITE_CACHE,
      server: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    await server.listen();
    const origin = "http://127.0.0.1:" + server.httpServer.address().port;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    const page = await browser.newPage({ viewport });
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      const p = url.pathname;
      if (p === "/api/auth/login/with-token" || p === "/api/auth/update") {
        return route.fulfill({ json: { status: "success", data: {
          id: "507f1f77bcf86cd799439012", username: "FindFixture", language: "en", lastVisitedPage: "/staging-room", roles: ["user", "admin"],
        } } });
      }
      const base = "/api/staging-room";
      if (p === base + "/projects") {
        return route.fulfill({ json: [{ slug, bookName: "Find fixture", language: "he", linked: true, chapters: 1, words: 40, pending: 1, pinned: true }] });
      }
      if (p === base + "/preferences") return route.fulfill({ json: { order: [], pinned: [slug], filter: "all" } });
      if (p === `${base}/projects/${slug}`) {
        return route.fulfill({ json: { slug, bookName: "Find fixture", linked: true, revision: 1, changes: [{
          id: changeId, kind: "chapterDraft", group: { type: "chapter", chapterId: "c1", name: readView.title, order: 0 },
          tag: "NEW DRAFT", tone: "new", title: readView.title, meta: "", readable: true, editable: true, updatedAt: textView.updatedAt,
        }] } });
      }
      if (p === `${base}/projects/${slug}/changes/${changeId}`) return route.fulfill({ json: readView });
      if (p === `${base}/projects/${slug}/changes/${changeId}/text`) return route.fulfill({ json: textView });
      return route.fulfill({ json: { status: "success", data: [] } });
    });
    await page.goto(origin + "/staging-room");
    await run(page);
  } finally {
    await browser?.close();
    await server?.close();
    process.chdir(cwd);
  }
}

async function findState(page) {
  return page.evaluate(() => ({
    count: document.querySelector(".ws-manuscript-find-count")?.textContent ?? null,
    marks: [...document.querySelectorAll(".sr-page mark.ws-manuscript-match")].map(m => m.textContent),
    current: document.querySelector('.sr-page mark.ws-manuscript-match[data-current="true"]')?.textContent ?? null,
    currentInsideNew: !!document.querySelector('.sr-page mark:not(.ws-manuscript-match) > mark.ws-manuscript-match[data-current="true"]'),
    newMarks: document.querySelectorAll(".sr-page mark:not(.ws-manuscript-match)").length,
  }));
}

test("reading view find bar: shortcut, count, options, wrap, close", { timeout: 120_000 }, async () => {
  await withStagingRoom({ width: 1280, height: 800 }, async page => {
    await page.getByRole("button", { name: "Read" }).first().click();
    await page.locator(".sr-page").getByText("Concatenate the catalog.").waitFor();
    const newMarks = (await findState(page)).newMarks;

    await page.keyboard.press("Control+Alt+KeyF");
    const input = page.getByRole("textbox", { name: "Find text" });
    await input.waitFor();
    await input.fill("cat");
    let state = await findState(page);
    assert.equal(state.count, "1 of 4");
    assert.deepEqual(state.marks, ["cat", "Cat", "cat", "cat"]);
    assert.equal(state.newMarks, newMarks);

    await input.press("Enter");
    state = await findState(page);
    assert.equal(state.count, "2 of 4");
    assert.equal(state.current, "Cat");
    assert.equal(state.currentInsideNew, true);

    await input.press("Shift+Enter");
    await input.press("Shift+Enter");
    assert.equal((await findState(page)).count, "4 of 4");

    await page.getByRole("button", { name: "Match Case" }).click();
    assert.equal((await findState(page)).count, "1 of 3");
    await page.getByRole("button", { name: "Match Whole Word" }).click();
    assert.equal((await findState(page)).count, "1 of 1");

    await page.getByRole("button", { name: "Match Case" }).click();
    await input.fill("שלום");
    state = await findState(page);
    assert.equal(state.count, "1 of 2");
    assert.deepEqual(state.marks, ["שלום", "שלום"]);

    await input.press("Escape");
    state = await findState(page);
    assert.equal(state.count, null);
    assert.equal(state.marks.length, 0);
    assert.equal(state.newMarks, newMarks);
  });
});

test("reading view find bar opens from the header button on a phone", { timeout: 120_000 }, async () => {
  await withStagingRoom({ width: 375, height: 812 }, async page => {
    await page.getByText("Find fixture").first().click();
    await page.getByRole("button", { name: readView.title }).first().click();
    await page.getByRole("button", { name: "Find in text" }).click();
    const input = page.getByRole("textbox", { name: "Find text" });
    await input.fill("שלום");
    // Without whole word, "שלוםם" matches too.
    assert.equal((await findState(page)).count, "1 of 3");
    await input.press("Enter");
    if (process.env.STAGING_FIND_SCREENSHOT_DIR) {
      await page.waitForTimeout(400); // let the 150 ms color transitions finish
      await page.screenshot({ path: path.join(process.env.STAGING_FIND_SCREENSHOT_DIR, "staging-find-phone.png") });
    }
    const box = await page.locator(".ws-manuscript-find").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375, "find bar fits the phone width");
    const head = await page.locator(".sr-read-head").boundingBox();
    assert.ok(box.y >= head.y + head.height, "find bar opens below the reading header");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scrollWidth <= 375, "no sideways page scroll");
  });
});

test("staging editor find bar opens with Ctrl+Alt+F and highlights matches", { timeout: 120_000 }, async () => {
  await withStagingRoom({ width: 1280, height: 800 }, async page => {
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.locator("[data-slate-editor]").getByText("Concatenate the catalog.").waitFor();
    // Focus outside the text: the shortcut should still open the bar.
    await page.locator(".sr-editor-head").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+Alt+KeyF");
    const input = page.getByRole("textbox", { name: "Find text" });
    await input.fill("cat");
    assert.equal(await page.locator(".ws-manuscript-find-count").textContent(), "1 of 4");
    assert.equal(await page.locator("[data-slate-editor] mark.ws-manuscript-match").count(), 4);
    const color = await page.locator('[data-slate-editor] mark.ws-manuscript-match[data-current="true"]').evaluate(m => getComputedStyle(m).backgroundColor);
    const green = await page.evaluate(() => {
      const probe = document.createElement("mark");
      document.querySelector(".roza-staging-room").appendChild(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    assert.notEqual(color, green, "find highlights are not the green 'new' color");
    await input.press("Escape");
    assert.equal(await page.locator("[data-slate-editor] mark.ws-manuscript-match").count(), 0);
  });
});
