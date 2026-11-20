const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const JSZip = require("../frontend/node_modules/jszip");
const root = path.resolve(__dirname, "..");
async function epub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "book.opf",
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">navigation</dc:identifier><dc:title>Navigation</dc:title><dc:language>en</dc:language></metadata><manifest>' +
      Array.from(
        { length: 8 },
        (_, i) =>
          '<item id="c' +
          i +
          '" href="c' +
          i +
          '.xhtml" media-type="application/xhtml+xml"/>',
      ).join("") +
      "</manifest><spine>" +
      Array.from({ length: 8 }, (_, i) => '<itemref idref="c' + i + '"/>').join(
        "",
      ) +
      "</spine></package>",
  );
  for (let i = 0; i < 8; i++)
    zip.file(
      "c" + i + ".xhtml",
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter ' +
        i +
        '</title></head><body><p id="note">' +
        (i === 0
          ? '<a epub:type="noteref" href="c7.xhtml#note">Note 1</a> '
          : "") +
        Array.from({ length: 600 }, (_, j) => "chapter" + i + "word" + j + (j % 30 === 29 ? "!" : "")).join(
          " ",
        ) +
        "</p></body></html>",
    );
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "desktop word navigation, pagination, lookup, selection, focus and reflow",
  { timeout: 120000 },
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
    const file = await epub();
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
      cacheDir: path.join(root, "frontend/node_modules/.vite-word-test"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: {
        entries: ["scripts/fixtures/reader-word-navigation.tsx"],
      },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
    });
    const lookups = [];
    server.middlewares.use("/api/reader/navigation/file", (_, res) => {
      res.setHeader("Content-Type", "application/epub+zip");
      res.end(file);
    });
    let keyboardSettings = { unit: "words", count: 5 };
    server.middlewares.use(
      "/api/reader/keyboard-settings",
      async (req, res) => {
        if (req.method === "PATCH") {
          let body = "";
          for await (const chunk of req) body += chunk;
          keyboardSettings = JSON.parse(body);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "success", data: keyboardSettings }));
      },
    );
    server.middlewares.use("/api/", (req, res) => {
      if (req.url.includes("dictionary")) lookups.push(req.url);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          data: req.url.includes("annotations") ? [] : { entry: null, lookupCount: 1 },
        }),
      );
    });
    server.middlewares.use("/word-test", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/word-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-word-navigation.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    let browser;
    try {
      browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
      });
      const page = await browser.newPage({
        viewport: { width: 1280, height: 850 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        window.measurementFrames = { count: 0, navigated: 0 };
        new MutationObserver(records => {
          for (const { addedNodes } of records) {
            for (const node of addedNodes) {
              if (!(node instanceof HTMLIFrameElement) || !node.closest(".reader-page-measurement"))
                continue;
              window.measurementFrames.count++;
              if (node.hasAttribute("srcdoc") || node.hasAttribute("src"))
                window.measurementFrames.navigated++;
            }
          }
        }).observe(document, { childList: true, subtree: true });
      });
      await page.goto(server.resolvedUrls.local[0] + "word-test");
      await page.waitForFunction(
        () => window.navigationTest?.reader.locationsReady,
        null,
        { timeout: 45000 },
      );
      await page.waitForFunction(() => window.navigationTest.reader.totalPages > 0);
      const frames = await page.evaluate(() => window.measurementFrames);
      assert.ok(frames.count >= 8, "The measuring renderer lays out all eight chapters");
      assert.equal(frames.navigated, 0, "Measurement frames do not navigate to chapter documents");
      const total = await page.evaluate(() => window.navigationTest.reader.totalPages);
      await page.reload();
      await page.waitForFunction(expected => {
        const reader = window.navigationTest?.reader;
        return reader?.locationsReady && reader.totalPages === expected;
      }, total);
      assert.equal(await page.evaluate(() => window.measurementFrames.count), 0,
        "A same-layout refresh restores the exact page map without measuring chapters");
      await page.evaluate(() => window.navigationTest.reader.pageNavigation.go("2", "screen"));
      await page.waitForFunction(() => /^Page 2\b/.test(window.navigationTest.reader.pageLabel));
      assert.equal(await page.evaluate(() => window.measurementFrames.count), 0,
        "A cached screen-page jump uses the stored destination");
      await page.evaluate(() => window.navigationTest.reader.pageNavigation.go("1", "screen"));
      await page.waitForFunction(() => /^Page 1\b/.test(window.navigationTest.reader.pageLabel));
      const nextPage = page.locator(".reader-page-turn-next");
      assert.equal(await nextPage.evaluate(button => getComputedStyle(button).cursor), "pointer");
      const focus = () =>
        page.evaluate(() =>
          document
            .querySelector(".reader-viewport iframe")
            .contentWindow.focus(),
        );
      const mark = () =>
        page.evaluate(() => {
          const doc = document.querySelector(
            ".reader-viewport iframe",
          ).contentDocument;
          const name = document.querySelector(".reader-keyboard-word")?.dataset
            .readerNativeHighlight;
          return name
            ? [...doc.defaultView.CSS.highlights.get(name)][0].toString()
            : null;
        });
      const key = async (k) => {
        await page.keyboard.press(k);
        await page.waitForTimeout(45);
      };
      await focus();
      assert.equal(
        await page.evaluate(() => {
          const d = document.querySelector(
            ".reader-viewport iframe",
          ).contentDocument;
          const e = new KeyboardEvent("keydown", {
            key: " ",
            code: "Space",
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          d.body.dispatchEvent(e);
          return e.defaultPrevented;
        }),
        false,
      );
      await key("Control+Space");
      assert.equal(await mark(), null);
      assert.equal(lookups.length, 0);
      await key("ArrowRight");
      assert.equal(await mark(), "Note");
      const sentenceHighlight = () => page.evaluate(() => {
        const doc = document.querySelector(".reader-viewport iframe").contentDocument;
        const highlights = doc.defaultView.CSS.highlights;
        const sentence = Array.from(highlights).find(([, mark]) => mark.priority === -1);
        if (!sentence) return null;
        const color = name => doc.defaultView.getComputedStyle(doc.body, "::highlight(" + name + ")").backgroundColor;
        return {
          sentenceIncludesWord: [...sentence[1]][0].toString().includes("chapter0word30"),
          sentence: color(sentence[0]),
        };
      });
      assert.equal(await sentenceHighlight(), null);
      await key("ArrowRight");
      assert.equal(await mark(), "1");
      await key("ArrowLeft");
      assert.equal(await mark(), "Note");
      assert.equal(
        await page.evaluate(() => window.navigationTest.reader.textSelection),
        null,
      );
      assert.equal(lookups.length, 0);
      // At the first word, Up goes to the previous page; at book start it stays put.
      await key("ArrowLeft");
      assert.equal(await mark(), "Note");
      await key("Escape");
      await focus();
      await key("ArrowLeft");
      const last = await mark();
      assert.ok(last?.startsWith("chapter0word"));
      await page.evaluate(() => {
        const doc = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        const original = doc.createTreeWalker.bind(doc);
        window.chapterWordScans = 0;
        doc.createTreeWalker = (...args) => {
          if (args[1] === 4 && !args[2]) window.chapterWordScans++;
          return original(...args);
        };
      });
      const firstPage = await page.evaluate(
        () => window.navigationTest.reader.location.start.cfi,
      );
      await key("ArrowRight");
      await page.waitForFunction(
        (cfi) => window.navigationTest.reader.location.start.cfi !== cfi,
        firstPage,
      );
      const nextFirst = await mark();
      assert.ok(nextFirst?.startsWith("chapter0word"));
      await key("ArrowLeft");
      await page.waitForFunction(
        (cfi) => window.navigationTest.reader.location.start.cfi === cfi,
        firstPage,
      );
      assert.equal(await mark(), last);
      assert.equal(
        await page.evaluate(() => window.chapterWordScans),
        0,
        "Crossing pages in either direction must reuse the chapter word index",
      );
      assert.equal(lookups.length, 0);
      await key("Escape");
      await focus();
      await key("ArrowRight");
      await key("Control+Space");
      await page.waitForFunction(
        () => window.navigationTest.reader.textSelection?.lookupRequest,
      );
      await page.waitForTimeout(200);
      assert.equal(await mark(), "Note");
      assert.equal(lookups.length, 1);
      assert.equal(
        await page.evaluate(() =>
          document
            .querySelector(".reader-viewport iframe")
            .contentDocument.getSelection()
            .toString(),
        ),
        "",
      );
      await focus();
      await page.evaluate(() => {
        const selected = window.navigationTest.reader.textSelection;
        window.navigationTest.reader.markTranslation({
          cfi: selected.cfi,
          text: selected.text,
        });
      });
      await page.waitForFunction(() =>
        [
          ...document
            .querySelector(".reader-viewport iframe")
            .contentDocument.defaultView.CSS.highlights.keys(),
        ].some((name) => name.startsWith("reader-mark-")),
      );
      await key("Escape");
      assert.equal(await mark(), null);
      assert.equal(
        await page.evaluate(() =>
          [
            ...document
              .querySelector(".reader-viewport iframe")
              .contentDocument.defaultView.CSS.highlights.keys(),
          ].some((name) => name.startsWith("reader-mark-")),
        ),
        true,
        "Clearing keyboard focus must preserve the passage mark at the same CFI",
      );
      // A fresh mouse gesture cancels keyboard focus; manually selected text survives lookup.
      await page.evaluate(() => {
        const d = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        d.body.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        );
        const text = d.querySelector("a").firstChild;
        const range = d.createRange();
        range.selectNodeContents(text);
        d.getSelection().removeAllRanges();
        d.getSelection().addRange(range);
      });
      await key("Control+Space");
      await page.waitForTimeout(150);
      assert.equal(
        await page.evaluate(
          () => window.navigationTest.reader.textSelection.text,
        ),
        "Note 1",
      );
      assert.equal(
        await page.evaluate(() =>
          document
            .querySelector(".reader-viewport iframe")
            .contentDocument.getSelection()
            .toString(),
        ),
        "Note 1",
      );
      assert.equal(
        lookups.length,
        1,
        "A passage uses the existing selection actions, not a word lookup",
      );
      await key("ArrowRight");
      assert.equal(
        await mark(),
        "chapter0word0",
        "Down continues after the manually selected passage",
      );
      assert.equal(lookups.length, 1);
      const selectPassage = () =>
        page.evaluate(() => {
          const d = document.querySelector(
            ".reader-viewport iframe",
          ).contentDocument;
          d.body.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
          );
          const node = d.querySelector("p").lastChild;
          const start = node.textContent.indexOf("chapter0word2 ");
          const end =
            node.textContent.indexOf("chapter0word3 ") + "chapter0word3".length;
          const range = d.createRange();
          range.setStart(node, start);
          range.setEnd(node, end);
          d.getSelection().removeAllRanges();
          d.getSelection().addRange(range);
        });
      await selectPassage();
      await key("ArrowRight");
      assert.equal(await mark(), "chapter0word4");
      await selectPassage();
      await key("ArrowLeft");
      assert.equal(
        await mark(),
        "chapter0word1",
        "Up continues before the manually selected passage",
      );
      assert.equal(lookups.length, 1);
      // Suppressed mouse selections can explicitly open a real dictionary lookup.
      await page.evaluate(() => window.navigationTest.reader.closeLookup());
      await focus();
      await page.evaluate(() => {
        const d = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        d.body.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 2 }),
        );
        const r = d.createRange();
        r.setStart(d.querySelector("a").firstChild, 0);
        r.setEnd(d.querySelector("a").firstChild, 4);
        d.getSelection().addRange(r);
      });
      await key("Control+Space");
      await page.waitForTimeout(150);
      assert.equal(lookups.length, 2);
      assert.equal(
        await page.evaluate(() =>
          document
            .querySelector(".reader-viewport iframe")
            .contentDocument.getSelection()
            .toString(),
        ),
        "Note",
      );
      await page.evaluate(() => window.navigationTest.reader.closeLookup());
      await focus();
      await key("ArrowRight");
      await page.getByRole("textbox", { name: "Outside input" }).fill("typing");
      await key("ArrowRight");
      await key("Control+Space");
      assert.equal(await mark(), "Note");
      assert.equal(lookups.length, 2);
      await page.evaluate(() =>
        window.navigationTest.reader.updateState({
          preferences: {
            ...window.navigationTest.reader.state.preferences,
            fontSize: 26,
          },
        }),
      );
      await page.waitForTimeout(600);
      assert.equal(await mark(), "Note");
      await focus();
      await key("ArrowRight");
      assert.equal(await mark(), "1");
      assert.equal(
        await page.evaluate(() => window.chapterWordScans),
        0,
        "Reflow and manual selection must reuse existing chapter words",
      );
      await key("Escape");
      await focus();
      await key("PageDown");
      await page.waitForFunction(
        (cfi) => window.navigationTest.reader.location.start.cfi !== cfi,
        firstPage,
      );
      assert.equal(await mark(), null);
      await page.evaluate(() =>
        window.navigationTest.reader.returnTo("c0.xhtml"),
      );
      await key("Escape");
      await focus();
      await key("ArrowRight");
      assert.equal(
        await page.evaluate(() => {
          const d = document.querySelector(
            ".reader-viewport iframe",
          ).contentDocument;
          for (const kind of [
            "input",
            "textarea",
            "contenteditable",
            "dialog",
            "textbox",
          ]) {
            const target = d.createElement(
              kind === "input" || kind === "textarea" ? kind : "div",
            );
            if (kind === "contenteditable") target.contentEditable = "true";
            if (kind === "dialog" || kind === "textbox")
              target.setAttribute("role", kind);
            d.body.append(target);
            for (const key of ["ArrowRight", "ArrowLeft", " "]) {
              const e = new KeyboardEvent("keydown", {
                key,
                code: key === " " ? "Space" : key,
                ctrlKey: key === " ",
                bubbles: true,
                cancelable: true,
              });
              target.dispatchEvent(e);
              if (e.defaultPrevented) return false;
            }
            target.remove();
          }
          const save = new KeyboardEvent("keydown", {
            key: "s",
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          d.body.dispatchEvent(save);
          // Reserve the save prefix so a subsequent M can enter Sentence Mode.
          return save.defaultPrevented;
        }),
        true,
      );
      assert.equal(await mark(), "Note");
      await page.evaluate(() => {
        const d = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        for (let i = 0; i < 5; i++)
          d.body.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "ArrowRight",
              bubbles: true,
              cancelable: true,
            }),
          );
      });
      await page.waitForFunction(() => {
        const doc = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        const name = document.querySelector(".reader-keyboard-word")?.dataset
          .readerNativeHighlight;
        return (
          name &&
          [...doc.defaultView.CSS.highlights.get(name)][0].toString() ===
            "chapter0word3"
        );
      });
      assert.equal(await mark(), "chapter0word3");
      assert.equal(lookups.length, 2);
      // Crossing a spine section replaces the iframe and must retain keyboard focus.
      await page.evaluate(() =>
        window.navigationTest.reader.returnTo("c1.xhtml"),
      );
      await page.waitForFunction(
        () => window.navigationTest.reader.location.start.index === 1,
      );
      await focus();
      await key("ArrowRight");
      assert.equal(await mark(), "chapter1word0");
      await key("ArrowLeft");
      await page.waitForFunction(
        () => window.navigationTest.reader.location.start.index === 0,
      );
      assert.equal(await mark(), "chapter0word599");
      await key("ArrowRight");
      await page.waitForFunction(
        () => window.navigationTest.reader.location.start.index === 1,
      );
      assert.equal(await mark(), "chapter1word0");
      await key("ArrowRight");
      assert.equal(await mark(), "chapter1word1");
      await key("Escape");
      // An open side tab must not block a focused EPUB or repeated key paints.
      await page.getByRole("button", { name: "Open side settings" }).click();
      await page.locator(".reader-settings").waitFor();
      await page.waitForTimeout(600);
      await focus();
      await key("ArrowRight");
      assert.equal(await mark(), "chapter1word0");
      await page.evaluate(() => {
        const d = document.querySelector(
          ".reader-viewport iframe",
        ).contentDocument;
        const original = d.createTreeWalker.bind(d);
        window.wordScans = 0;
        d.createTreeWalker = (...args) => {
          window.wordScans++;
          return original(...args);
        };
        window.wordPaints = [];
        const sample = () => {
          const name = document.querySelector(".reader-keyboard-word")?.dataset
            .readerNativeHighlight;
          const text = name
            ? [...d.defaultView.CSS.highlights.get(name)][0].toString()
            : null;
          if (text && window.wordPaints.at(-1) !== text)
            window.wordPaints.push(text);
          if (window.wordPaints.length < 6) requestAnimationFrame(sample);
        };
        sample();
        // Repeated keydown events while the key remains held, with no keyup.
        for (let i = 0; i < 5; i++)
          d.body.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "ArrowRight",
              repeat: true,
              bubbles: true,
              cancelable: true,
            }),
          );
      });
      await page.waitForFunction(() => window.wordPaints.length === 6);
      assert.deepEqual(
        await page.evaluate(() => window.wordPaints),
        Array.from({ length: 6 }, (_, i) => "chapter1word" + i),
      );
      assert.equal(
        await page.evaluate(() => window.wordScans),
        0,
        "Repeated words reuse the visible page instead of scanning the chapter",
      );
      await page.evaluate(() => {
        const input = document.createElement("textarea");
        input.setAttribute("aria-label", "Side text");
        document.querySelector(".reader-settings").append(input);
      });
      await page
        .getByRole("textbox", { name: "Side text" })
        .fill("typing in side tab");
      await key("ArrowRight");
      await key("Control+Space");
      assert.equal(await mark(), "chapter1word5");
      assert.equal(lookups.length, 2);
      await focus();
      await key("ArrowLeft");
      assert.equal(await mark(), "chapter1word4");
      await key("Escape");
      await page.evaluate(() => window.navigationTest.reader.closePanel());
      await page.evaluate(() => window.navigationTest.reader.returnTo('c0.xhtml'));
      await key('Escape'); await focus();
      await key('ArrowRight');
      assert.equal(await mark(), 'Note', 'Sentence test starts at the first word');
      await key('Control+ArrowRight');
      assert.equal(await mark(), 'chapter0word30', 'Ctrl+Right goes to next sentence');
      assert.deepEqual(await sentenceHighlight(), { sentenceIncludesWord: true, sentence: "rgba(235, 183, 143, 0.3)" });
      await key('Control+ArrowLeft');
      assert.equal(await mark(), 'Note', 'Ctrl+Left goes to previous sentence start');
      assert.equal(await sentenceHighlight(), null);
      for (let i = 0; i < 4; i++) await key('ArrowRight');
      const lineGeometry = () => page.evaluate(() => {
        const host = window.navigationTest.reader.host.current.getBoundingClientRect();
        const frame = document.querySelector('.reader-viewport iframe');
        const doc = frame.contentDocument, offset = frame.getBoundingClientRect();
        const walker = doc.createTreeWalker(doc.body, 4); const lines = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (const match of node.textContent.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)) {
            const range = doc.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
            const r = range.getBoundingClientRect();
            if (!r.width || offset.left + r.left < host.left - 1 || offset.left + r.left >= host.right - 1 || offset.top + r.top >= host.bottom) continue;
            let line = lines.at(-1); const y = offset.top + r.top;
            if (!line || Math.abs(line.y - y) > r.height * .35) { line = {y, words:[]}; lines.push(line); }
            line.words.push({text:match[0], left:offset.left+r.left, right:offset.left+r.right});
          }
        }
        return lines;
      });
      let geometry = await lineGeometry();
      const originText = await mark();
      const lineIndex = geometry.findIndex(line => line.words.some(word => word.text === originText));
      const originWord = geometry[lineIndex].words.find(word => word.text === originText);
      const x = (originWord.left + originWord.right) / 2;
      const closest = (line, goal) => line.words.reduce((best, word) => {
        const distance = w => Math.max(w.left-goal, 0, goal-w.right);
        return distance(word) < distance(best) ? word : best;
      }).text;
      for (let i = 1; i <= 3; i++) {
        await key('ArrowDown');
        assert.equal(await mark(), closest(geometry[lineIndex+i], x), 'Down uses visual-line geometry');
      }
      for (let i = 2; i >= 0; i--) {
        await key('ArrowUp');
        assert.equal(await mark(), closest(geometry[lineIndex+i], x), 'Up retains the original horizontal target');
      }
      const beforeVerticalPage = await page.evaluate(() => window.navigationTest.reader.location.start.cfi);
      for (let i = lineIndex + 1; i < geometry.length; i++) await key('ArrowDown');
      await key('ArrowDown');
      await page.waitForFunction(cfi => window.navigationTest.reader.location.start.cfi !== cfi, beforeVerticalPage);
      const nextPageLines = await lineGeometry();
      assert.equal(await mark(), nextPageLines[0].words[0].text, 'Down enters the next page at its first word');
      await key('ArrowUp');
      await page.waitForFunction(cfi => window.navigationTest.reader.location.start.cfi === cfi, beforeVerticalPage);
      assert.equal(await mark(), geometry.at(-1).words.at(-1).text, 'Up enters the previous page at its last word');
      await key('Escape'); await focus(); await key('ArrowRight');
      for (let i = 0; i < 4; i++) await key('ArrowRight');
      await key('Shift+ArrowRight');
      assert.match(await mark(), /chapter0word2 chapter0word3/, 'Shift+Right extends selection');
      await key('Shift+ArrowLeft');
      assert.equal(await mark(), originText, 'Shift+Left contracts selection');
      await key('t');
      await page.waitForFunction(() => !!window.navigationTest.reader.textSelection?.lookupRequest);
      assert.equal(await page.evaluate(() => window.navigationTest.reader.textSelection.text), originText);
      await key('Escape'); await focus();
      await key('ArrowRight');
      await key('n');
      await page.waitForFunction(() => !!window.navigationTest.reader.annotations.draft, null, {timeout:5000});
      assert.ok(await page.getByLabel('Personal note').isVisible());
      await page.evaluate(() => { window.navigationTest.reader.annotations.setDraft(null); window.navigationTest.reader.closePanel(); });
      await page.evaluate(() => window.navigationTest.reader.updateKeyboardSettings({unit:'sentences', count:3}));
      await page.waitForFunction(() => window.navigationTest.reader.keyboardSettings.unit === 'sentences');
      await page.evaluate(() => window.navigationTest.reader.returnTo('c0.xhtml'));
      await key('Escape'); await focus();
      await key('ArrowRight');
      assert.equal(await mark(), 'Note', 'Right selects one word with saved sentence grouping');
      await key('ArrowRight');
      assert.equal(await mark(), '1', 'Right advances exactly one word with saved sentence grouping');
      await key('ArrowLeft');
      assert.equal(await mark(), 'Note', 'Left advances exactly one word with saved sentence grouping');
      await key('Escape');
      const framesBeforeResize = await page.evaluate(() => window.measurementFrames.count);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(before => window.measurementFrames.count >= before + 8 &&
        window.navigationTest.reader.totalPages > 0, framesBeforeResize);
      await page.waitForTimeout(500);
      await focus();
      await key("ArrowRight");
      assert.equal(await mark(), null);
      assert.equal(lookups.length, 2);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
