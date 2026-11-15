const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, webkit } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
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
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">rsvp</dc:identifier><dc:title>RSVP</dc:title><dc:language>en</dc:language></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="note" href="note.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="note" linear="no"/><itemref idref="b"/></spine></package>',
  );
  zip.file(
    "a.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head><body><p>The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons. A short pause. Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road Another patient traveler studied the small details of the landscape and remembered every quiet conversation along the road.</p></body></html>',
  );
  zip.file(
    "note.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Note</title></head><body><p>Footnote</p></body></html>',
  );
  zip.file(
    "b.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons The quiet reader followed the winding road through gardens where curious travelers shared stories about distant mountains and changing seasons. The end.</p></body></html>',
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "Sentence Mode visual-line geometry, alignment, layout invalidation and sentence boundaries",
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
    const file = await epub();
    const saves = [];
    const lookups = [];
    const annotations = [];
    const flags = [];
    let flagWrites = 0;
    const aliases = [
      "react",
      "react-dom",
      "react-router-dom",
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
      cacheDir: path.join(root, "frontend/node_modules/.vite-rsvp-test"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: { entries: ["scripts/fixtures/reader-rsvp.tsx"] },
      server: {
        host: "127.0.0.1",
        port: await new Promise((resolve) => {
          const probe = require("node:net").createServer();
          probe.listen(0, "127.0.0.1", () => {
            const port = probe.address().port;
            probe.close(() => resolve(port));
          });
        }),
        fs: { allow: [root] },
      },
    });
    server.middlewares.use("/rsvp-state", (_, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(saves.length ? saves[saves.length - 1] : "null");
    });
    server.middlewares.use("/api/reader/rsvp/file", (_, res) => {
      res.setHeader("Content-Type", "application/epub+zip");
      res.end(file);
    });
    server.middlewares.use("/api/", (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        if (body && req.url.includes("/state")) saves.push(body);
        if (req.url.includes("dictionary")) lookups.push(JSON.parse(body));
        res.setHeader("Content-Type", "application/json");
        if (req.url.includes("/flags")) {
          let saved;
          if (req.method === "PUT") {
            flagWrites++;
            const input = JSON.parse(body);
            saved = flags.find(
              (f) => f.cfi === input.cfi && f.endCfi === input.endCfi,
            );
            if (!saved) {
              saved = {
                ...input,
                id: String(flags.length + 1),
                bookId: "rsvp",
                reviewed: false,
                createdAt: new Date().toISOString(),
              };
              flags.push(saved);
            }
          }
          res.end(JSON.stringify({ status: "success", data: saved || flags }));
          return;
        }
        if (req.url.includes("/annotations")) {
          if (req.method === "DELETE") {
            const id = req.url.split("/").at(-1);
            const index = annotations.findIndex(item => item.id === id);
            if (index >= 0) annotations.splice(index, 1);
            res.end(JSON.stringify({ status: "success", data: null })); return;
          }
          const input = body ? JSON.parse(body) : null;
          const previous = input && annotations.find(item => item.cfi === input.cfi && item.endCfi === input.endCfi);
          const item = input ? {...input, id: previous?.id || String(annotations.length + 1)} : null;
          if (item) { const index = annotations.findIndex(saved => saved.id === item.id); if (index < 0) annotations.push(item); else annotations[index] = item; }
          res.end(JSON.stringify({ status: "success", data: item || annotations }));
          return;
        }
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              entry: {
                word: "reading",
                headword: "reading",
                source: "Fixture",
                senses: [
                  {
                    id: "1",
                    partOfSpeech: "verb",
                    meanings: ["שלום"],
                    explanations: [],
                    definition: "",
                    examples: [],
                    labels: [],
                  },
                ],
              },
              lookupCount: 1,
            },
          }),
        );
      });
    });
    server.middlewares.use("/rsvp-test", async (_, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        await server.transformIndexHtml(
          "/rsvp-test",
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}.reader-shell{height:100dvh}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/reader-rsvp.tsx"></script></body></html>',
        ),
      );
    });
    await server.listen();
    const browser = process.env.RSVP_WEBKIT
      ? await webkit.launch()
      : await chromium.launch({
          channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
        });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 844 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls.local[0] + "rsvp-test");
      await page.waitForFunction(() => window.rsvpTest?.reader.locationsReady);
      await page
        .getByRole("button", { name: "Sentence Mode", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.sentence &&
          !window.rsvpTest.reader.sentenceMode.busy,
      );
      const settle = async () =>
        page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
      await settle();
      const selectPartialPhrase = async () => {
        await page.evaluate(() => {
          const words = document.querySelectorAll('[data-sentence-word]');
          const range = document.createRange();
          range.setStart(words[1].firstChild, 1);
          range.setEnd(words[2].firstChild, 3);
          const native = window.getSelection(); native.removeAllRanges(); native.addRange(range);
          document.dispatchEvent(new Event('selectionchange'));
        });
        await page.waitForFunction(() => !document.querySelector('[data-shortcut="t"]').disabled);
      };
      await selectPartialPhrase();
      await page.getByRole('button', {name:'Annotate', exact:true}).click();
      assert.equal(await page.evaluate(() => window.rsvpTest.reader.annotations.draft.text), 'uiet rea');
      assert.equal(await page.evaluate(async () => {
        const r = window.rsvpTest.reader; return (await r.searchBook.getRange(r.annotations.draft.cfi)).toString();
      }), 'uiet rea');
      await page.getByRole('button', {name:'Green', exact:true}).click();
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="green"]').allTextContents().then(parts => parts.join('')), 'uiet rea', 'Draft highlights only the partial phrase');
      assert.equal(await page.evaluate(() => window.getSelection().toString()), '', 'Choosing a color clears the native selection marker');
      await page.getByRole('button', {name:'Cancel', exact:true}).click();
      await page.evaluate(() => window.rsvpTest.reader.closePanel());
      await page.locator('[data-sentence-word]').nth(1).click();
      assert.equal(await page.locator('.reader-sentence-word-active').count(), 1);
      await page.getByRole('button', {name:'Annotate', exact:true}).click();
      await page.getByRole('button', {name:'Pink', exact:true}).click();
      assert.equal(await page.locator('.reader-sentence-word-active').count(), 0, 'Choosing a color clears keyboard word focus');
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="pink"]').allTextContents().then(parts => parts.join('')), 'quiet');
      assert.notEqual(await page.locator('.reader-sentence-annotation[data-color="pink"]').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      await page.getByRole('button', {name:'Cancel', exact:true}).click();
      await page.evaluate(() => window.rsvpTest.reader.closePanel());
      await selectPartialPhrase();
      await page.keyboard.press('t');
      await page.getByRole('button', {name:'Pronounce English word', exact:true}).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', {name:'Annotate', exact:true}).click();
      assert.equal(await page.evaluate(() => window.rsvpTest.reader.annotations.draft.text), 'uiet rea', 'Translation dismissal preserves the annotation target');
      await page.getByRole('button', {name:'Green', exact:true}).click();
      await page.getByRole('button', {name:'Save', exact:true}).click();
      await page.waitForFunction(() => !window.rsvpTest.reader.annotations.draft);
      await page.evaluate(() => window.rsvpTest.reader.closePanel());
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="green"]').allTextContents().then(parts => parts.join('')), 'uiet rea', 'Saved highlight stays within the selected partial phrase');
      assert.equal(await page.evaluate(async () => {
        const r = window.rsvpTest.reader;
        return (await r.searchBook.getRange(r.annotations.items.find(item => item.text === 'uiet rea').cfi)).toString();
      }), 'uiet rea', 'Saved source CFI excludes the rest of the sentence');
      await page.evaluate(() => {
        const r = window.rsvpTest.reader;
        return r.annotations.remove(r.annotations.items.find(item => item.text === 'uiet rea').id);
      });
      await settle();
      const annotationInputs = await page.evaluate(async () => {
        const r = window.rsvpTest.reader;
        const section = r.searchBook.spine.get(r.sentenceMode.sentence.cfi);
        const source = await r.searchBook.getRange(r.sentenceMode.sentence.cfi);
        const {readerSentenceSelectionRange: clip} = await import('/frontend/src/services/readerSentenceSelectionRange.ts');
        const sentences = window.rsvpTest.sentenceService.extractReaderSentences(section);
        const base = {chapter:'A', note:'', endCfi:''};
        return [
          {...base, cfi:section.cfiFromRange(clip(source,0,3)), text:'The', color:'yellow'},
          {...base, cfi:section.cfiFromRange(clip(source,4,16)), text:'quiet reader', color:'pink', note:'Phrase note'},
          {...base, cfi:section.cfiFromRange(clip(source,r.sentenceMode.sentence.text.length-8,r.sentenceMode.sentence.text.length)), endCfi:sentences[1].cfi, text:'seasons. A short pause.', color:'blue'},
        ];
      });
      for (const input of annotationInputs) {
        await page.evaluate(input => window.rsvpTest.reader.annotations.save(input), input);
        await settle();
      }
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="yellow"]').allTextContents().then(items=>items.join('')), 'The');
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="pink"]').allTextContents().then(items=>items.join('')), 'quiet reader');
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="blue"]').allTextContents().then(items=>items.join('')), 'seasons.');
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="pink"]').first().evaluate(el=>getComputedStyle(el).getPropertyValue('--annotation-fill').trim()), '#f5a4cc');
      assert.equal(await page.locator('.reader-sentence-annotation[data-note="true"]').first().evaluate(el=>getComputedStyle(el).textDecorationLine), 'underline');
      const savedAnnotations = JSON.stringify(annotations);
      await page.evaluate(() => window.rsvpTest.reader.sentenceMode.move(1)); await settle();
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="blue"]').allTextContents().then(items=>items.join('')), 'A short pause.');
      await page.evaluate(() => window.rsvpTest.reader.sentenceMode.move(-1)); await settle();
      await page.evaluate(() => window.rsvpTest.reader.sentenceMode.toggle());
      await page.waitForSelector('.reader-saved-annotation[data-color="pink"] rect');
      await page.evaluate(() => window.rsvpTest.reader.sentenceMode.toggle()); await settle();
      assert.equal(await page.locator('.reader-sentence-annotation[data-color="pink"]').allTextContents().then(items=>items.join('')), 'quiet reader');
      assert.equal(JSON.stringify(annotations), savedAnnotations, 'Switching modes never rewrites saved annotation data');
      const lines = async () =>
        page.evaluate(() => {
          const root = document.querySelector(".reader-sentence-text"),
            origin = root.getBoundingClientRect();
          const lines = [];
          root
            .querySelectorAll("[data-sentence-word]")
            .forEach((word, index) => {
              const rect = word.getBoundingClientRect();
              let line = lines.find(
                (line) => Math.abs(line.top - (rect.top - origin.top)) < 4,
              );
              if (!line) {
                line = { top: rect.top - origin.top, words: [] };
                lines.push(line);
              }
              line.words.push({
                index,
                left: rect.left - origin.left,
                right: rect.right - origin.left,
              });
            });
          return lines.sort((a, b) => a.top - b.top);
        });
      const closest = (line, x) =>
        line.words.reduce((best, word) =>
          Math.max(word.left - x, 0, x - word.right) <
          Math.max(best.left - x, 0, x - best.right)
            ? word
            : best,
        ).index;
      const active = async () =>
        page.evaluate(() =>
          [...document.querySelectorAll("[data-sentence-word]")].indexOf(
            document.querySelector(".reader-sentence-word-active"),
          ),
        );
      const click = async (index) =>
        page.locator("[data-sentence-word]").nth(index).click();
      let geometry = await lines();
      assert.ok(
        geometry.length >= 3,
        "Real text must wrap across multiple visual lines",
      );
      const initial =
        geometry[0].words[Math.floor(geometry[0].words.length * 0.7)];
      const targetX = (initial.left + initial.right) / 2;
      const selectedText = async () =>
        page.evaluate(() => {
          const native = window.getSelection();
          if (!native?.rangeCount || native.isCollapsed) return "";
          const fragment = native.getRangeAt(0).cloneContents();
          fragment
            .querySelectorAll(".reader-sentence-note")
            .forEach((node) => node.remove());
          return fragment.textContent.trim();
        });
      const phrase = async (first, last) =>
        page.evaluate(
          ({ first, last }) => {
            const text = window.rsvpTest.reader.sentenceMode.sentence.text;
            const words = [
              ...text.matchAll(/[\p{L}\p{N}]+(?:['’‘-][\p{L}\p{N}]+)*/gu),
            ];
            return text
              .slice(
                words[first].index,
                words[last].index + words[last][0].length,
              )
              .trim();
          },
          { first, last },
        );
      await click(initial.index);
      await page.keyboard.press("Shift+ArrowDown");
      const lower = closest(geometry[1], targetX);
      assert.equal(
        await selectedText(),
        await phrase(initial.index, lower),
        "Shift+Down selects to the closest word on the next visual line",
      );
      await page.keyboard.press("Shift+ArrowDown");
      const lowerAgain = closest(geometry[2], targetX);
      assert.equal(
        await selectedText(),
        await phrase(initial.index, lowerAgain),
        "Held Shift preserves horizontal alignment across multiple lines",
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(
        await active(),
        lower,
        "Unmodified vertical navigation resumes at the Shift selection endpoint without a horizontal reset",
      );
      const upperOrigin =
        geometry[2].words[Math.floor(geometry[2].words.length / 2)];
      const upperX = (upperOrigin.left + upperOrigin.right) / 2;
      await click(upperOrigin.index);
      await page.keyboard.press("Shift+ArrowUp");
      const upper = closest(geometry[1], upperX);
      assert.equal(
        await selectedText(),
        await phrase(upper, upperOrigin.index),
        "Shift+Up selects backward by visual line",
      );
      await page.keyboard.press("Shift+ArrowUp");
      assert.equal(
        await selectedText(),
        await phrase(closest(geometry[0], upperX), upperOrigin.index),
      );
      await page.keyboard.press("Shift+ArrowDown");
      assert.equal(
        await selectedText(),
        await phrase(upper, upperOrigin.index),
        "Reversing direction shrinks the selection while retaining its anchor",
      );
      assert.equal(
        await page.locator(".reader-dictionary").count(),
        0,
        "Shift vertical selection never opens lookup",
      );
      await click(initial.index);
      for (let line = 1; line < geometry.length; line++) {
        const handled = await page.evaluate(() => {
          const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
          });
          document.body.dispatchEvent(event);
          return event.defaultPrevented;
        });
        assert.equal(
          handled,
          true,
          "Visual navigation prevents browser scrolling",
        );
        assert.equal(
          await active(),
          closest(geometry[line], targetX),
          "Down preserves the horizontal goal",
        );
      }
      for (let line = geometry.length - 2; line >= 0; line--) {
        await page.keyboard.press("ArrowUp");
        assert.equal(
          await active(),
          closest(geometry[line], targetX),
          "Up preserves the same horizontal goal",
        );
      }
      // Crossing sentences preserves alignment even through a short line.
      const edge = geometry[geometry.length - 1].words[0];

      const crossingX = (edge.left + edge.right) / 2;
      await click(edge.index);
      await page.keyboard.press("Shift+ArrowDown");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 2 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      let next = await lines();
      assert.equal(
        await active(),
        closest(next[0], crossingX),
        "Down preserves alignment in the next sentence",
      );
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 3 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      next = await lines();
      assert.equal(
        await active(),
        closest(next[0], crossingX),
        "Down preserves alignment after a short sentence",
      );
      const newX = crossingX;
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(next[1], newX),
        "Alignment survives sentence boundaries",
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(await active(), closest(next[0], crossingX));

      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 2 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      next = await lines();
      assert.equal(
        await active(),
        closest(next.at(-1), crossingX),
        "Up preserves alignment in the previous sentence",
      );
      await page.keyboard.press("Control+ArrowLeft");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 1 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      assert.equal(
        await active(),
        0,
        "Ctrl+Left selects the previous sentence start",
      );
      await page.keyboard.press("Control+ArrowRight");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 2 &&
          !!document.querySelector(".reader-sentence-word-active"),
      );
      assert.equal(await active(), 0);
      await page.keyboard.press("Control+ArrowRight");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.number === 3 &&
          !!document.querySelector(".reader-sentence-word-active"),
      );
      await page.keyboard.press("Control+ArrowRight");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.chapterTitle === "B" &&
          document.querySelector(".reader-sentence-word-active"),
      );
      assert.equal(
        await active(),
        0,
        "Ctrl sentence navigation crosses spine boundaries",
      );
      geometry = await lines();
      const chapterOrigin =
        geometry[0].words[Math.floor(geometry[0].words.length / 2)];
      const chapterX = (chapterOrigin.left + chapterOrigin.right) / 2;
      await click(chapterOrigin.index);
      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.chapterTitle === "A" &&
          window.rsvpTest.reader.sentenceMode.number === 3 &&
          document.querySelector(".reader-sentence-word-active"),
      );
      geometry = await lines();
      assert.equal(
        await active(),
        closest(geometry.at(-1), chapterX),
        "Up preserves alignment across chapters",
      );
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () =>
          window.rsvpTest.reader.sentenceMode.chapterTitle === "B" &&
          document.querySelector(".reader-sentence-word-active"),
      );
      geometry = await lines();
      assert.equal(
        await active(),
        closest(geometry[0], chapterX),
        "Down preserves alignment across chapters",
      );
      // Horizontal movement resets the goal to the newly marked word.
      await click(geometry[1].words[1].index);
      await page.keyboard.press("ArrowRight");
      const horizontal = await active();
      const horizontalWord = geometry
        .flatMap((line) => line.words)
        .find((word) => word.index === horizontal);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(geometry[2], (horizontalWord.left + horizontalWord.right) / 2),
      );
      // No repeated glyph measurements while the same layout remains valid.
      await page.evaluate(() => {
        window.geometryReads = 0;
        const original = Range.prototype.getClientRects;
        Range.prototype.getClientRects = function () {
          window.geometryReads++;
          return original.call(this);
        };
      });
      await click(geometry[0].words[0].index);
      await settle();
      await page.keyboard.press("ArrowDown");
      const reads = await page.evaluate(() => window.geometryReads);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.evaluate(() => window.geometryReads),
        reads,
        "Consecutive keys reuse measured lines",
      );
      await page.setViewportSize({ width: 760, height: 680 });
      await settle();
      geometry = await lines();
      assert.ok(geometry.length >= 3);
      let chosen = geometry[0].words[Math.floor(geometry[0].words.length / 2)];
      await click(chosen.index);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(geometry[1], (chosen.left + chosen.right) / 2),
        "Resize invalidates geometry",
      );
      await page.evaluate(() => {
        document.querySelector(".reader-sentence-text").style.fontSize = "22px";
      });
      await settle();
      geometry = await lines();
      chosen = geometry[0].words[Math.floor(geometry[0].words.length / 2)];
      await click(chosen.index);
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await active(),
        closest(geometry[1], (chosen.left + chosen.right) / 2),
        "Font-size changes invalidate geometry",
      );
      await page.evaluate(() => {
        window.spoken = [];
        window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
        Object.defineProperty(window, 'speechSynthesis', { configurable:true, value: {
          getVoices: () => [{lang:'en-US'}], cancel: () => {},
          speak: utterance => { window.spoken.push(utterance.text); utterance.onend?.(); }
        }});
      });
      await click(chosen.index);
      await page.keyboard.press('t');
      const audio = page.getByRole('button', {name:'Pronounce English word', exact:true});
      await audio.waitFor();
      await page.keyboard.press('t');
      const spokenWord = await page.evaluate(() => window.spoken[0]);
      assert.ok(spokenWord);
      await audio.click();
      await page.keyboard.press('t');
      assert.deepEqual(await page.evaluate(() => window.spoken), [spokenWord, spokenWord, spokenWord]);
      await page.getByRole('button', {name:'Google', exact:true}).click();
      await page.keyboard.press('t');
      assert.equal(await page.evaluate(() => window.spoken.length), 4);
      await page.evaluate(() => {
        const input = document.createElement('input'); input.id='typing-test';
        document.querySelector('.reader-dictionary').append(input); input.focus();
      });
      await page.keyboard.press('t');
      assert.equal(await page.locator('#typing-test').inputValue(), 't');
      assert.equal(await page.evaluate(() => window.spoken.length), 4);
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.querySelector('#typing-test')?.remove());
      await page.keyboard.press('t');
      assert.equal(await page.evaluate(() => window.spoken.length), 4);
      await page.keyboard.press('Escape');
      const cfi = await page.evaluate(
        () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
      );
      await page.getByRole("button", { name: "Ask AI", exact: true }).click();
      const input = page.locator('textarea[id^="reader-chat-question"]');
      await input.first().focus();
      await input.first().fill("Typing is protected");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Shift+ArrowDown");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Control+ArrowRight");
      assert.equal(
        await page.evaluate(
          () => window.rsvpTest.reader.sentenceMode.sentence.cfi,
        ),
        cfi,
        "Typing controls never navigate the book",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(() => window.rsvpTest.reader.sentenceMode.active),
        true,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
