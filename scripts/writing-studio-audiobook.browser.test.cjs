const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const frontend = path.join(root, "frontend");
const paragraph = text => ({ type: "paragraph", children: [{ text }] });
const date = "2026-11-01T12:00:00.000Z";
const book = {
  id: "222222222222222222222222",
  userId: "111111111111111111111111",
  name: "Audiobook manuscript",
  createdAt: date,
  updatedAt: date,
  filterBy: "chapters",
  characters: [], themes: [], plotlines: [], notes: [],
  chapters: [{
    id: "333333333333333333333333",
    bookId: "222222222222222222222222",
    name: "Chapter one",
    type: "chapters",
    text: [paragraph("Main opens. The next sentence."), paragraph("A final sentence.")],
    description: [paragraph("")],
    drafts: [{
      id: "444444444444444444444444",
      name: "Alternate",
      text: [paragraph("Only the alternate draft says this.")],
      createdAt: date,
      updatedAt: date,
      annotations: [],
    }],
  }],
};

test("Writing Studio narrates drafts and restores the book narrator without saving manuscript text", { timeout: 60000 }, async () => {
  const modules = path.join(frontend, "node_modules");
  const { createServer } = await import(pathToFileURL(path.join(modules, "vite/dist/node/index.js")));
  const { default: react } = await import(pathToFileURL(path.join(modules, "@vitejs/plugin-react/dist/index.mjs")));
  const server = await createServer({
    configFile: false,
    appType: "custom",
    root,
    publicDir: path.join(frontend, "public"),
    cacheDir: path.join(root, ".studio-test-cache"),
    plugins: [react()],
    css: { postcss: { plugins: [
      require("../frontend/node_modules/tailwindcss")({
        ...require("../frontend/tailwind.config.cjs"),
        content: [path.join(frontend, "src/**/*.{ts,tsx}")],
      }),
      require("../frontend/node_modules/autoprefixer"),
    ] } },
    resolve: { alias: ["react", "react-dom", "react-router-dom", "@tanstack/react-query",
      "slate", "slate-react", "slate-history", "@dnd-kit/core", "@dnd-kit/sortable",
      "react-icons", "i18next", "react-i18next", "axios"].map(name => ({
        find: name, replacement: path.join(modules, name).replaceAll("\\", "/"),
      })),
    },
    optimizeDeps: { entries: ["scripts/fixtures/writing-studio.tsx"] },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [root, fs.realpathSync(modules)] } },
  });
  const writes = [];
  const narratorWrites = [];
  let narrator = null;
  server.middlewares.use("/api/", async (req, res) => {
    if (req.url === "/book/" + book.id + "/audiobook/narrator") {
      if (req.method === "PATCH") {
        let body = "";
        for await (const chunk of req) body += chunk;
        narrator = JSON.parse(body);
        narratorWrites.push(narrator);
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "success", data: narrator }));
      return;
    }
    if (req.url.startsWith("/book") && !["GET", "HEAD"].includes(req.method)) writes.push(req.url);
    const data = req.url.startsWith("/reader") ? { enabled: false }
      : req.url.startsWith("/auth") ? { id: book.userId, language: "en" }
      : req.url.startsWith("/book/") ? book : [book];
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "success", data }));
  });
  server.middlewares.use(async (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(await server.transformIndexHtml(req.url,
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/writing-studio.tsx"></script></body></html>',
    ));
  });

  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const nativeSpeech = process.env.STUDIO_NATIVE_SPEECH === "1";
    if (!nativeSpeech) await page.addInitScript(() => {
      const speech = {
        current: null,
        paused: false,
        spoken: [],
        getVoices: () => [],
        addEventListener() {},
        removeEventListener() {},
        speak(utterance) {
          this.current = utterance;
          this.spoken.push(utterance.text);
          utterance.onstart?.();
        },
        pause() { this.paused = true; },
        resume() { this.paused = false; },
        cancel() { this.current = null; this.paused = false; },
        finishSentence() {
          const utterance = this.current;
          this.current = null;
          utterance.onend?.();
        },
      };
      Object.defineProperty(window, "speechSynthesis", { value: speech, configurable: true });
    });
    await page.goto(server.resolvedUrls.local[0] + "books");
    await page.getByRole("link", { name: "Write Audiobook manuscript" }).click();
    const main = page.locator('[data-slate-editor][aria-label="Manuscript"]');
    const draft = page.locator('[data-slate-editor][aria-label="Draft manuscript"]');
    const read = page.getByRole("button", { name: "Read", exact: true });
    const play = page.getByRole("button", { name: "Audiobook", exact: true });
    const player = page.getByRole("region", { name: "Audiobook mini player" });
    const pause = page.getByRole("button", { name: "Pause narration", exact: true });
    const resume = page.getByRole("button", { name: "Play narration", exact: true });
    const stop = page.getByRole("button", { name: "Stop narration", exact: true });
    const speechText = () => page.evaluate(() => window.speechSynthesis?.current?.text);
    if (nativeSpeech) {
      await read.click();
      await play.click();
      await resume.click();
      await pause.waitFor();
      await player.getByRole("button", { name: "Minimize to header" }).click();
      const compact = page.getByRole("group", { name: "Minimized audiobook player" });
      await compact.getByRole("button", { name: "Play narration" }).waitFor({ timeout: 15000 });
      await compact.getByRole("button", { name: "Restore mini player" }).click();
      await page.getByText("Chapter narration complete.", { exact: true }).waitFor({ timeout: 15000 });
      assert.deepEqual(writes, []);
      return;
    }
    const original = await main.innerText();
    assert.equal(await play.count(), 0);

    await read.click();
    const headerLauncher = page.locator(".ws-header-end .ws-header-audiobook + .ws-save");
    await headerLauncher.waitFor();
    assert.equal(await play.innerText(), "");
    assert.equal(await play.getAttribute("title"), "Audiobook");
    await play.click();
    await player.waitFor();
    assert.equal(await player.evaluate(element => getComputedStyle(element).backgroundColor), "rgb(241, 231, 216)");
    assert.equal(await resume.evaluate(element => getComputedStyle(element).backgroundColor), "rgb(118, 89, 64)");
    assert.equal(await player.getByRole("slider", { name: "Chapter progress" }).evaluate(element =>
      getComputedStyle(element).accentColor), "rgb(118, 89, 64)");
    await player.getByRole("button", { name: "Save for offline" }).click();
    const offline = page.getByRole("dialog", { name: "Save for offline" });
    await offline.getByText(/run in the Roza desktop app/).waitFor();
    await offline.getByRole("button", { name: "Close" }).click();
    assert.equal(await speechText(), undefined);
    await player.getByRole("button", { name: "Choose narrator voice" }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const grip = player.getByRole("button", { name: "Move mini player with arrow keys" });
    const before = await player.boundingBox();
    assert.ok(before.width <= 420);
    const voiceBox = await player.getByRole("button", { name: "Choose narrator voice" }).boundingBox();
    assert.ok((await resume.boundingBox()).y < voiceBox.y);
    const handle = await grip.boundingBox();
    await page.mouse.move(handle.x + 16, handle.y + 16);
    await page.mouse.down();
    await page.mouse.move(70, 200, { steps: 8 });
    await page.mouse.up();
    const after = await player.boundingBox();
    assert.ok(after.x < before.x && after.y < before.y);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.waitForFunction(() => {
      const box = document.querySelector(".ws-floating-audio").getBoundingClientRect();
      return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight &&
        document.querySelector(".ws-floating-audio").scrollWidth <= box.width;
    });
    await page.setViewportSize({ width: 1365, height: 900 });
    await player.getByRole("button", { name: "Reading speed", exact: true }).click();
    await player.getByRole("slider", { name: "Reading speed", exact: true }).press("ArrowRight");
    assert.equal(await player.getByRole("button", { name: "Reading speed", exact: true }).innerText(), "1.1×");
    const volume = player.getByRole("slider", { name: "Volume" });
    await volume.press("ArrowLeft");
    assert.equal(await volume.inputValue(), "0.95");
    assert.equal(await volume.getAttribute("aria-valuetext"), "95%");
    await player.locator(".ws-floating-audio-volume-tooltip").filter({ hasText: "95%" }).waitFor();
    const totalTime = player.getByTitle("Estimated total chapter time");
    const duration = await totalTime.innerText();
    assert.match(duration, /^\d+:\d{2}$/);
    await main.focus();
    for (const label of [pause, resume, pause]) {
      const handled = await main.evaluate(element => !element.dispatchEvent(new KeyboardEvent("keydown", {
        key: " ", code: "Space", bubbles: true, cancelable: true, repeat: false,
      })));
      assert.equal(handled, true, "Space must cancel the default scroll action");
      await label.waitFor();
    }
    assert.equal(await speechText(), "Main opens.");
    const spokenBeforeMinimize = await page.evaluate(() => window.speechSynthesis.spoken.length);
    const floatingPosition = await player.boundingBox();
    await player.getByRole("button", { name: "Minimize to header" }).click();
    const compact = page.locator(".ws-header-end").getByRole("group", { name: "Minimized audiobook player" });
    await compact.waitFor();
    await player.waitFor({ state: "hidden" });
    assert.equal(await speechText(), "Main opens.");
    await page.keyboard.press("Space");
    await compact.getByRole("button", { name: "Play narration" }).waitFor();
    assert.equal(await page.evaluate(() => window.speechSynthesis.paused), true);
    await page.keyboard.press("Space");
    await compact.getByRole("button", { name: "Pause narration" }).waitFor();
    await compact.getByRole("button", { name: "Restore mini player" }).click();
    await player.waitFor();
    const restored = await player.boundingBox();
    assert.equal(restored.x, floatingPosition.x);
    assert.equal(restored.y, floatingPosition.y);
    assert.equal(await page.evaluate(() => window.speechSynthesis.spoken.length), spokenBeforeMinimize);
    await stop.click();
    assert.equal(await speechText(), undefined);
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => [...CSS.highlights.values()].some(highlight =>
      highlight.priority === 1 && [...highlight].some(range => range.toString() === "Main"),
    ));

    await main.evaluate(element => {
      // Force the next paragraph below the viewport to exercise follow-along scrolling.
      element.lastElementChild.style.marginTop = "1000px";
      const text = element.querySelector("[data-slate-string]").firstChild;
      const start = text.textContent.indexOf("next");
      window.getSelection().setBaseAndExtent(text, start, text, start + 4);
    });
    await resume.click();
    await pause.click();
    assert.equal(await speechText(), "The next sentence.");
    assert.equal(await page.evaluate(() => window.speechSynthesis.paused), true);
    const spoken = await page.evaluate(() => window.speechSynthesis.spoken.length);
    await resume.click();
    assert.equal(await page.evaluate(() => window.speechSynthesis.spoken.length), spoken);
    assert.equal(await page.evaluate(() => window.speechSynthesis.paused), false);
    const speakWord = charIndex => page.evaluate(index => {
      window.speechSynthesis.current.onboundary({ charIndex: index, name: "word" });
    }, charIndex);
    const spokenWords = () => page.evaluate(() => [...CSS.highlights.values()].flatMap(highlight =>
      highlight.priority === 3 ? [...highlight].map(range => range.toString()) : [],
    ));
    const waitForSpokenWord = word => page.waitForFunction(expected => [...CSS.highlights.values()].some(highlight =>
      highlight.priority === 3 && [...highlight].some(range => range.toString() === expected),
    ), word);
    await speakWord(4);
    await waitForSpokenWord("next");
    assert.deepEqual(await spokenWords(), ["next"]);
    await speakWord(9);
    await waitForSpokenWord("sentence.");
    assert.deepEqual(await spokenWords(), ["sentence."]);
    await page.evaluate(() => window.speechSynthesis.finishSentence());
    await page.waitForFunction(() => [...CSS.highlights.values()].some(highlight =>
      highlight.priority === 2 && [...highlight].some(range => range.toString() === "A final sentence."),
    ));
    assert.equal(await speechText(), "A final sentence.");
    assert.equal(await totalTime.innerText(), duration);
    assert.deepEqual(await spokenWords(), []);
    assert.ok(await main.evaluate(element => {
      const paragraph = element.lastElementChild.getBoundingClientRect();
      const view = element.closest(".ws-writing").getBoundingClientRect();
      return paragraph.top >= view.top && paragraph.bottom <= view.bottom;
    }));

    const versions = page.locator('summary[title="Chapter versions"]');
    await versions.click();
    await page.getByRole("button", { name: "Alternate", exact: true }).click();
    assert.equal(await speechText(), undefined);
    assert.equal(await draft.getAttribute("contenteditable"), "false");
    await player.waitFor({ state: "hidden" });
    await play.click();
    await resume.click();
    await pause.waitFor();
    assert.equal(await speechText(), "Only the alternate draft says this.");
    await page.evaluate(() => window.speechSynthesis.current.onerror({ error: "synthesis-failed" }));
    await page.getByText("System speech: synthesis-failed.", { exact: false }).waitFor();
    await resume.click();
    await pause.waitFor();
    await page.getByRole("button", { name: "Write", exact: true }).click();
    await play.waitFor({ state: "hidden" });
    assert.equal(await speechText(), undefined);

    await read.click();
    await page.evaluate(() => Object.defineProperty(window, "speechSynthesis", { value: undefined }));
    await play.click();
    await page.getByText("Narration is unavailable. Choose a narrator voice.", { exact: true }).waitFor();
    assert.equal(await main.innerText(), original);
    assert.equal(await draft.innerText(), "Only the alternate draft says this.");

    await play.click();
    const installKokoroFixture = () => {
      const requests = [];
      let saved = false;
      window.offlineRequests = requests;
      window.rozaDesktop = { kokoro: {
        passages: true,
        status: async () => ({ installed: true, formats: ["mp3"], engine: { state: "ready" } }),
        onInstallStatus: () => () => {},
        saveScript: async script => { window.offlineScript = script; },
        offline: async request => {
          requests.push(request);
          if (request.action === "start") saved = true;
          return { state: saved ? "ready" : "missing", completed: saved ? 1 : 0, total: 1, chapters: 1 };
        },
      } };
    };
    await page.evaluate(installKokoroFixture);
    await page.addInitScript(installKokoroFixture);
    await play.click();
    await player.getByRole("button", { name: "Save for offline" }).click();
    await offline.getByRole("button", { name: "Choose a narrator" }).click();
    await page.getByRole("button", { name: /Local voices/ }).click();
    await page.getByRole("radio", { name: /Bella/ }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await player.getByRole("button", { name: "Save for offline" }).click();
    await offline.getByRole("button", { name: "Save chapter" }).click();
    await offline.getByText("Ready offline", { exact: true }).waitFor();
    assert.equal(await offline.getByRole("region", { name: "Whole book" }).count(), 0);
    const offlineData = await page.evaluate(() => ({
      requests: window.offlineRequests,
      sections: window.offlineScript.sections,
    }));
    assert.ok(offlineData.requests.some(request => request.action === "start"));
    assert.ok(offlineData.requests.every(request => request.section === 0));
    assert.deepEqual(offlineData.sections.flatMap(section => section.sentences.map(item => item.text)),
      ["Only the alternate draft says this."]);
    assert.deepEqual(narratorWrites, [{ engine: "kokoro", voice: "af_bella", name: "Bella", lang: "en-US" }]);
    await page.reload();
    await play.waitFor();
    await player.waitFor();
    await player.getByRole("button", { name: "Choose narrator voice" }).getByText("Bella", { exact: true }).waitFor();
    await player.getByRole("button", { name: "Choose narrator voice" }).click();
    assert.equal(await page.getByRole("radio", { name: /Bella/ }).isChecked(), true);
    assert.equal(narratorWrites.length, 1);
    assert.deepEqual(writes, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
