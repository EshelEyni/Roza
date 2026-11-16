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
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">rsvp</dc:identifier><dc:title>RSVP</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="note" href="note.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="note" linear="no"/><itemref idref="b"/></spine></package>',
  );
  zip.file(
    "a.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head><body><p>Hello, <em>read</em>ing world. Next sentence!</p><p>Last paragraph.</p><p>Line<br/>break.</p><p hidden="hidden">Hidden text</p><script>bad()</script></body></html>',
  );
  zip.file(
    "note.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Note</title></head><body><p>Footnote</p></body></html>',
  );
  zip.file(
    "b.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>Second chapter starts here. boardinghouse. pneumonoultramicroscopicsilicovolcanoconiosis WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW</p></body></html>',
  );
  zip.file("nav.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="a.xhtml">A</a></li><li><a href="b.xhtml">B</a></li></ol></nav></body></html>');
  return zip.generateAsync({ type: "nodebuffer" });
}
test(
  "TTS real EPUB: passage, controls, cancellation and mobile",
  { timeout: 600000 },
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
      server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
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
    try {
      for (const mobile of [false, true]) await t.test(mobile ? "mobile" : "desktop", async () => {
        const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
        try {
          const page = await browser.newPage({ viewport: { width: mobile ? 375 : 1280, height: 844 }, hasTouch: mobile, isMobile: mobile });
          await page.addInitScript(() => {
            const synth = new EventTarget();
            window.spoken = []; window.cancelled = 0;
            synth.getVoices = () => window.testVoices || [];
            synth.speak = u => { window.spoken.push(u); };
            synth.cancel = () => { window.cancelled++; };
            synth.pause = () => {}; synth.resume = () => {};
            Object.defineProperty(window, "speechSynthesis", { value: synth });
            window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
          });
          if (!process.env.TTS_REAL_KOKORO) await page.addInitScript(() => {
            window.workers = [];
            window.Worker = class {
              constructor() { window.workers.push(this); }
              postMessage(data) { this.input = data; }
              terminate() { this.terminated = true; }
            };
            window.Audio = class {
              currentTime = 0; playbackRate = 1;
              play() { this.onplaying?.(); return Promise.resolve(); }
              pause() { this.onpause?.(); }
            };
          });
          if (process.env.TTS_REAL_KOKORO) {
            await page.exposeFunction('ttsLog', message => console.log(message));
            await page.addInitScript(() => {
              const NativeAudio = window.Audio;
              window.Audio = function(...args) { const player = new NativeAudio(...args); window.ttsPlayer = player; return player; };
              const create = URL.createObjectURL.bind(URL);
              URL.createObjectURL = blob => { window.generatedBlob = blob; return create(blob); };
              setInterval(() => { const status = document.querySelector('.reader-tts [role="status"]')?.textContent; if (status && status !== window.lastTtsStatus) { window.lastTtsStatus = status; window.ttsLog(status); } }, 2000);
            });
          }
          page.setDefaultTimeout(30000);
          await page.goto(server.resolvedUrls.local[0] + "rsvp-test");
          await page.waitForFunction(() => window.rsvpTest?.reader.loading === false);
          await page.getByRole("button", { name: "Read aloud", exact: true }).click();
          const panel = page.locator('.reader-tts');
          await panel.getByRole('button', { name: 'Play', exact: true }).waitFor({ state: 'visible' });
          await page.waitForFunction(() => document.querySelector('.reader-tts-passage')?.textContent === 'Hello, reading world. Next sentence!');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          if (mobile && process.env.TTS_SCREENSHOT) await page.screenshot({ path: process.env.TTS_SCREENSHOT });
          await panel.getByRole('button', { name: 'Play', exact: true }).click();
          assert.equal(await page.evaluate(() => window.spoken.at(-1).text), 'Hello, reading world. Next sentence!');
          await panel.getByRole('button', { name: 'Pause', exact: true }).click();
          await panel.getByRole('button', { name: 'Resume', exact: true }).click();
          await panel.getByRole('button', { name: 'Stop', exact: true }).click();
          await page.evaluate(() => { window.testVoices = [{voiceURI:'test',name:'Test Voice',lang:'en-US'}]; speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
          await panel.locator('#tts-voice').click();
          await page.getByRole('option', { name: 'Test Voice · en-US' }).click();
          await panel.getByRole('button', { name: 'Play', exact: true }).click();
          assert.equal(await page.evaluate(() => window.spoken.at(-1).voice.voiceURI), 'test');
          await page.evaluate(() => window.spoken.at(-1).onerror({error:'interrupted'}));
          assert.match(await panel.getByRole('alert').innerText(), /interrupted/);
          await panel.locator('#tts-engine').click();
          await page.getByRole('option', { name: 'Kokoro · Local AI' }).click();
          await panel.getByRole('button', { name: 'Generate', exact: true }).click();
          if (process.env.TTS_REAL_KOKORO) {
            await page.waitForFunction(() => document.querySelector('.reader-tts [role="status"]')?.textContent.includes('Audio ready') || !!document.querySelector('.reader-tts [role="alert"]'), null, { timeout: 480000 });
            assert.equal(await panel.getByRole('alert').count(), 0, await panel.innerText());
            const waveform = await page.evaluate(async () => {
              const ctx = new AudioContext();
              try {
                const decoded = await ctx.decodeAudioData(await window.generatedBlob.arrayBuffer());
                return { duration: decoded.duration, peak: decoded.getChannelData(0).reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0) };
              } finally { await ctx.close(); }
            });
            console.log('Generated Kokoro WAV', waveform);
            assert.ok(waveform.duration > 1 && waveform.peak > 0.01);
            await panel.getByRole('button', { name: 'Play', exact: true }).click();
            await page.waitForFunction(() => window.ttsPlayer.currentTime > 0);
            await panel.getByRole('button', { name: 'Pause', exact: true }).click();
            assert.equal(await page.evaluate(() => window.ttsPlayer.paused), true);
            await panel.locator('#tts-speed').click();
            await page.getByRole('option', { name: '1.5×', exact: true }).click();
            assert.equal(await page.evaluate(() => window.ttsPlayer.playbackRate), 1.5);
            await panel.getByRole('button', { name: 'Resume', exact: true }).click();
            await panel.getByRole('button', { name: 'Stop', exact: true }).click();
          } else {
            assert.equal(await page.evaluate(() => window.workers.at(-1).input.text), 'Hello, reading world. Next sentence!');
            await panel.getByRole('button', { name: 'Stop', exact: true }).click();
            assert.equal(await page.evaluate(() => window.workers.at(-1).terminated), true);
            await panel.getByRole('button', { name: 'Generate', exact: true }).click();
            await page.evaluate(() => window.workers.at(-1).onmessage({data:{blob:new Blob(['mock'])}}));
            await panel.getByRole('button', { name: 'Play', exact: true }).click();
            await panel.getByRole('button', { name: 'Pause', exact: true }).click();
            await panel.getByRole('button', { name: 'Resume', exact: true }).click();
            await panel.getByRole('button', { name: 'Stop', exact: true }).click();
            await panel.getByRole('button', { name: 'Generate again', exact: true }).click();
            await page.evaluate(() => window.workers.at(-1).onmessage({data:{error:'memory limit'}}));
            assert.match(await panel.getByRole('alert').innerText(), /memory limit/);
            await panel.getByRole('button', { name: 'Generate', exact: true }).click();
            await page.locator('.reader-panel-close').click();
            assert.equal(await page.evaluate(() => window.workers.at(-1).terminated), true);
          }
          if (!process.env.TTS_REAL_KOKORO) {
            const selected = await page.evaluate(async () => {
              const doc = document.querySelector('.reader-host iframe, .reader-viewport iframe, iframe').contentDocument;
              const range = doc.createRange();
              range.selectNodeContents(doc.querySelector('em'));
              const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(range);
              return window.rsvpTest.reader.getTtsPassage();
            });
            assert.equal(selected, 'reading world. Next sentence!');
          }

        } finally { await browser.close(); }
      });
    } finally { await server.close(); }
  },
);
