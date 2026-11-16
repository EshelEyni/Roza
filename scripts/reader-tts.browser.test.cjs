const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(
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
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body><p>Second chapter starts here.</p></body></html>',
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
      "kokoro-js",
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
      cacheDir: path.join(root, "frontend/node_modules/.vite-tts-test"),
      plugins: [react()],
      resolve: { alias: aliases },
      optimizeDeps: { entries: ["scripts/fixtures/reader-rsvp.tsx"], include: ["kokoro-js"] },
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
          page.setDefaultTimeout(30000);
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
            window.workers = []; window.sources = []; window.audioContexts = [];
            window.Worker = class {
              constructor() {
                window.workers.push(this); this.inputs = [];
                queueMicrotask(() => this.onmessage?.({data:{ voices: [
                  {value:'af_heart',label:'Heart · en-us · Female'},
                  {value:'am_echo',label:'Echo · en-us · Male'},
                  {value:'bm_lewis',label:'Lewis · en-gb · Male'},
                ]}}));
              }
              postMessage(data) { this.input = data; this.inputs.push(data); }
              terminate() { this.terminated = true; }
            };
            window.AudioContext = class {
              constructor() { this.state = 'suspended'; window.audioContexts.push(this); }
              resume() { this.state = 'running'; return Promise.resolve(); }
              suspend() { this.state = 'suspended'; return Promise.resolve(); }
              close() { this.state = 'closed'; return Promise.resolve(); }
              decodeAudioData() { return Promise.resolve({duration:2}); }
              createBufferSource() {
                return {playbackRate:{value:1}, connect(){}, disconnect(){},
                  start(){ window.sources.push(this); }, stop(){ this.stopped = true; }};
              }
            };
            window.reply = data => {
              const w = window.workers.at(-1);
              w.onmessage({data:{id:w.input.id,...(data || {blob:new Blob(['mock'])})}});
            };
          });
          if (process.env.TTS_REAL_KOKORO) {
            await page.exposeFunction('ttsLog', message => console.log(message));
            await page.addInitScript(() => {
              window.sources = []; window.audioContexts = []; window.waveforms = [];
              const NativeContext = window.AudioContext;
              window.AudioContext = class extends NativeContext {
                constructor(...args) { super(...args); window.audioContexts.push(this); }
                async decodeAudioData(...args) {
                  const buffer = await super.decodeAudioData(...args);
                  window.waveforms.push({ duration: buffer.duration, peak: buffer.getChannelData(0).reduce((p,s) => Math.max(p,Math.abs(s)),0) });
                  return buffer;
                }
                createBufferSource() {
                  const source = super.createBufferSource(); const start = source.start.bind(source);
                  source.start = (...args) => { window.sources.push(source); return start(...args); };
                  return source;
                }
              };
              setInterval(() => {
                const status = document.querySelector('.reader-tts [role="status"]')?.textContent;
                if (status && status !== window.lastTtsStatus) { window.lastTtsStatus = status; window.ttsLog(status); }
              }, 2000);
            });
          }
          await page.goto(server.resolvedUrls.local[0] + "rsvp-test");
          await page.waitForFunction(() => window.rsvpTest?.reader.loading === false);
          // Walk the real EPUB independently: paragraph and section boundaries,
          // non-linear footnotes, hidden text and end-of-book termination.
          const chunks = await page.evaluate(async () => {
            const passages = []; let cursor;
            for (let i=0; i<30; i++) {
              const passage = await window.rsvpTest.reader.getTtsPassage(cursor);
              if (!passage) return passages;
              passages.push(passage.text); cursor = passage.next;
              if (!cursor) return passages;
            }
            throw new Error('TTS source did not terminate');
          });
          assert.deepEqual(chunks, ['Hello, reading world. Next sentence!', 'Last paragraph.', 'Line', 'break.', 'Second chapter starts here.']);
          await page.getByRole('button', { name: 'Reader menu', exact: true }).click();
          const menuLabels = await page.locator('[data-reader-menu] button span').allTextContents();
          assert.equal(menuLabels[0], 'Go to page');
          assert.match(menuLabels[1], /review/i);
          assert.equal(menuLabels[2], 'Sentence Mode');
          assert.match(menuLabels[3], /RSVP/);
          assert.equal(menuLabels[4], 'Read aloud');
          assert.match(menuLabels[5], /settings/i);
          await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
          const panel = page.locator('.reader-tts');
          await page.waitForFunction(() => document.querySelector('.reader-tts-passage')?.textContent === 'Hello, reading world. Next sentence!');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          if (mobile && process.env.TTS_SCREENSHOT) await page.screenshot({ path: process.env.TTS_SCREENSHOT });
          assert.equal(await panel.getByRole('button', { name: /Generate/ }).count(), 0);
          await panel.getByRole('button', { name: 'Play', exact: true }).click();
          assert.equal(await page.evaluate(() => window.spoken.at(-1).text), chunks[0]);
          await panel.getByRole('button', { name: 'Pause', exact: true }).click();
          await panel.getByRole('button', { name: 'Resume', exact: true }).click();
          await page.evaluate(() => window.spoken.at(-1).onend());
          await page.waitForFunction(() => window.spoken.at(-1).text === 'Last paragraph.');
          // A delayed next passage must stay paused until Resume.
          await panel.getByRole('button', { name: 'Pause', exact: true }).click();
          await page.evaluate(() => { window.spoken.at(-1).onend(); });
          await page.waitForFunction(() => document.querySelector('.reader-tts-passage').textContent === 'Line');
          assert.equal(await page.evaluate(() => window.spoken.length), 2);
          await panel.getByRole('button', { name: 'Resume', exact: true }).click();
          await page.waitForFunction(() => window.spoken.at(-1).text === 'Line');
          await page.evaluate(() => { window.staleEnd = window.spoken.at(-1).onend; });
          await panel.getByRole('button', { name: 'Stop', exact: true }).click();
          await page.evaluate(() => window.staleEnd());
          assert.equal(await page.evaluate(() => window.spoken.length), 3);
          await panel.getByRole('button', { name: 'Use current position' }).click();
          await page.evaluate(() => { window.testVoices = [{voiceURI:'test',name:'Test Voice',lang:'en-US'}]; speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
          await panel.locator('#tts-voice').click();
          await page.getByRole('option', { name: 'Test Voice · en-US' }).click();
          await panel.getByRole('button', { name: 'Play', exact: true }).click();
          assert.equal(await page.evaluate(() => window.spoken.at(-1).voice.voiceURI), 'test');
          await page.evaluate(() => window.spoken.at(-1).onerror({error:'interrupted'}));
          assert.match(await panel.getByRole('alert').innerText(), /interrupted/);
          await panel.locator('#tts-engine').click();
          await page.getByRole('option', { name: 'Kokoro · Local AI' }).click();
          // Voice catalog arrives without downloading/generating the model.
          await panel.locator('#tts-voice').click();
          await page.getByRole('option', { name: /Lewis/ }).waitFor();
          assert.equal(await page.getByRole('option').count(), process.env.TTS_REAL_KOKORO ? 28 : 3);
          await panel.locator('#tts-voice').press('Escape');
          await panel.getByRole('button', { name: 'Play', exact: true }).click();
          if (process.env.TTS_REAL_KOKORO) {
            await page.waitForFunction(() => window.sources.length >= 1 || !!document.querySelector('.reader-tts [role="alert"]'), null, { timeout: 480000 });
            assert.equal(await panel.getByRole('alert').count(), 0, await panel.innerText());
            const waveform = await page.evaluate(() => window.waveforms[0]);
            console.log('Generated automatically on Play', waveform);
            assert.ok(waveform.duration > 1 && waveform.peak > 0.01);
            await panel.getByRole('button', { name: 'Pause', exact: true }).click();
            await page.waitForFunction(() => window.audioContexts.at(-1).state === 'suspended');
            await panel.locator('#tts-speed').click();
            await page.getByRole('option', { name: '1.5×', exact: true }).click();
            assert.equal(await page.evaluate(() => window.sources.at(-1).playbackRate.value), 1.5);
            await panel.getByRole('button', { name: 'Resume', exact: true }).click();
            await page.waitForFunction(() => window.sources.length >= 2 || !!document.querySelector('.reader-tts [role="alert"]'), null, { timeout: 120000 });
            assert.equal(await panel.getByRole('alert').count(), 0, await panel.innerText());
            await page.waitForFunction(() => document.querySelector('.reader-tts [role="status"]')?.textContent === 'End of book.' || !!document.querySelector('.reader-tts [role="alert"]'), null, { timeout: 240000 });
            assert.equal(await panel.getByRole('alert').count(), 0, await panel.innerText());
            assert.equal(await page.evaluate(() => window.sources.length), chunks.length);
            console.log('Continuous Kokoro reached end of EPUB across sections:', chunks.length, 'chunks');
          } else {
            await page.waitForFunction(() => window.workers.at(-1).inputs.length === 1);
            assert.equal(await page.evaluate(() => window.workers.at(-1).input.text), chunks[0]);
            await panel.getByRole('button', { name: 'Pause', exact: true }).click();
            await page.evaluate(() => window.reply());
            await page.waitForFunction(() => window.sources.length === 1 && window.workers.at(-1).inputs.length === 2);
            assert.equal(await page.evaluate(() => window.audioContexts.at(-1).state), 'suspended');
            assert.equal(await page.evaluate(() => window.workers.at(-1).input.text), chunks[1]);
            await page.evaluate(() => window.reply());
            assert.equal(await page.evaluate(() => window.sources.length), 1);
            await panel.getByRole('button', { name: 'Resume', exact: true }).click();
            await page.evaluate(() => { const ctx=window.audioContexts.at(-1); ctx.state='suspended'; ctx.onstatechange(); });
            await panel.getByRole('button', { name: 'Resume', exact: true }).click();
            assert.equal(await page.evaluate(() => window.audioContexts.at(-1).state), 'running');
            await page.evaluate(() => window.sources.at(-1).onended());
            await page.waitForFunction(() => window.sources.length === 2 && document.querySelector('.reader-tts-passage').textContent === 'Last paragraph.');
            assert.equal(await panel.locator('.reader-tts-passage').innerText(), chunks[1]);
            // Stop cancels the lookahead and ignores late worker/audio callbacks.
            await page.evaluate(() => { window.staleWorker = window.workers.at(-1); window.staleMessage = window.staleWorker.onmessage; });
            await panel.getByRole('button', { name: 'Stop', exact: true }).click();
            assert.equal(await page.evaluate(() => window.workers.at(-1).terminated), true);
            assert.equal(await page.evaluate(() => window.audioContexts.at(-1).state), 'closed');
            await page.evaluate(() => window.staleMessage({data:{id:window.staleWorker.input.id,blob:new Blob(['late'])}}));
            assert.equal(await page.evaluate(() => window.sources.length), 2);
            await panel.getByRole('button', { name: 'Play', exact: true }).click();
            await page.waitForFunction(() => window.workers.at(-1).inputs.length === 1);
            await page.evaluate(() => window.reply({error:'memory limit'}));
            assert.match(await panel.getByRole('alert').innerText(), /memory limit/);
            await panel.getByRole('button', { name: 'Play', exact: true }).click();
            await page.waitForFunction(() => window.workers.at(-1).inputs.length === 1);
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            assert.equal(await page.evaluate(() => window.workers.at(-1).terminated), true);
            await panel.getByRole('button', { name: 'Play', exact: true }).click();
            await page.locator('.reader-panel-close').click();
            assert.equal(await page.evaluate(() => window.workers.at(-1).terminated), true);
          }
          if (!process.env.TTS_REAL_KOKORO) {
            const selected = await page.evaluate(async () => {
              const doc = document.querySelector('iframe').contentDocument;
              const range = doc.createRange(); range.selectNodeContents(doc.querySelector('em'));
              const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(range);
              return window.rsvpTest.reader.getTtsPassage();
            });
            assert.equal(selected.text, 'reading world. Next sentence!');
          }
        } finally { await browser.close(); }
      });
    } finally { await server.close(); }
  },
);
