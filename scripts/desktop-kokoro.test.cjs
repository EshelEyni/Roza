// Desktop Kokoro pieces without Electron or Python: a fake service stands in for service.py.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createEngine } = require("../desktop/kokoro/engine.cjs");
const { createStore } = require("../desktop/kokoro/store.cjs");
const { serveKokoroAudio } = require("../desktop/kokoro/audioRoute.cjs");

const FAKE_SERVICE = `
const fs = require("node:fs");
const rl = require("node:readline").createInterface({ input: process.stdin });
process.stdout.write(JSON.stringify({ event: "ready" }) + "\\n");
rl.on("line", line => {
  const request = JSON.parse(line);
  fs.appendFileSync(require("node:path").join(require("node:path").dirname(request.out), "order.txt"), request.text + "\\n");
  if (request.text === "fail") return process.stdout.write(JSON.stringify({ id: request.id, ok: false, error: "bad sentence" }) + "\\n");
  fs.writeFileSync(request.out, Buffer.alloc(1000, 7));
  const words = request.words.map((_, i) => [i * 0.5, i * 0.5 + 0.4]);
  setTimeout(() => process.stdout.write(JSON.stringify({ id: request.id, ok: true, duration: words.length * 0.5 + (request.pause || 0), words }) + "\\n"), 5);
});`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roza-kokoro-בדיקה-"));
  const script = path.join(dir, "fake-service.cjs");
  fs.writeFileSync(script, FAKE_SERVICE);
  const engine = createEngine({ python: () => process.execPath, script, cwd: os.tmpdir(), env: () => process.env, isInstalled: () => true });
  const store = createStore({ audioDir: path.join(dir, "audio"), booksDir: path.join(dir, "books"), engine });
  return { dir, engine, store };
}

const bookId = "a".repeat(24);
const sentence = (text, pause = 0.35) => ({ text, words: text.split(" "), pause, speed: 1 });

test("a sentence is made once, cached by content, and served with byte ranges", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

  const first = await store.sentence({ bookId, voice: "af_heart", section: 2, index: 5, sentence: sentence("Hello there world.") });
  assert.match(first.url, /^\/__kokoro\/audio\/a{24}\/af_heart\/2-5-[a-f0-9]{16}\.wav$/);
  assert.deepEqual(first.words, [{ start: 0, end: 0.4 }, { start: 0.5, end: 0.9 }, { start: 1, end: 1.4 }]);
  const again = await store.sentence({ bookId, voice: "af_heart", section: 2, index: 5, sentence: sentence("Hello there world.") });
  assert.equal(again.url, first.url);
  const changed = await store.sentence({ bookId, voice: "af_heart", section: 2, index: 5, sentence: sentence("Hello there world.", 0.75) });
  assert.notEqual(changed.url, first.url, "new pacing makes a new clip");

  const url = new URL(`https://roza.esheleyni.com${first.url}`);
  const full = await serveKokoroAudio(new Request(url), url, path.join(dir, "audio"));
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "audio/wav");
  assert.equal((await full.arrayBuffer()).byteLength, 1000);
  const part = await serveKokoroAudio(new Request(url, { headers: { range: "bytes=100-199" } }), url, path.join(dir, "audio"));
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), "bytes 100-199/1000");
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  const outOfRange = await serveKokoroAudio(new Request(url, { headers: { range: "bytes=5000-" } }), url, path.join(dir, "audio"));
  assert.equal(outOfRange.status, 416);
  const sneaky = new URL("https://roza.esheleyni.com/__kokoro/audio/aaaa/af_heart/..secret.wav");
  assert.equal((await serveKokoroAudio(new Request(sneaky), sneaky, path.join(dir, "audio"))).status, 404);
  const other = new URL("https://roza.esheleyni.com/assets/app.js");
  assert.equal(await serveKokoroAudio(new Request(other), other, path.join(dir, "audio")), null);
});

test("invalid input is refused before reaching the engine", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  await assert.rejects(store.sentence({ bookId: "../x", voice: "af_heart", section: 0, index: 0, sentence: sentence("Hi.") }), /Invalid book/);
  await assert.rejects(store.sentence({ bookId, voice: "marin", section: 0, index: 0, sentence: sentence("Hi.") }), /Unknown Kokoro voice/);
  await assert.rejects(store.sentence({ bookId, voice: "af_heart", section: -1, index: 0, sentence: sentence("Hi.") }), /Invalid position/);
  await assert.rejects(store.sentence({ bookId, voice: "af_heart", section: 0, index: 0, sentence: { ...sentence("Hi."), pause: 99 } }), /Invalid sentence/);
});

test("high-priority sentences jump ahead of queued offline work", async (t) => {
  const { dir, engine } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const out = (name) => path.join(dir, `${name}.wav`);
  const low = ["low 1", "low 2", "low 3"].map((text) => engine.synthesize({ text, words: [text], voice: "af_heart", out: out(text) }, "low"));
  const high = engine.synthesize({ text: "urgent", words: ["urgent"], voice: "af_heart", out: out("urgent") }, "high");
  await Promise.all([...low, high]);
  const order = fs.readFileSync(path.join(dir, "order.txt"), "utf8").trim().split(/\r?\n/);
  assert.ok(order.indexOf("urgent") < order.indexOf("low 3"), `urgent was made before the last read-ahead: ${order}`);
});

test("a whole-book offline save reports progress, and a chapter can be deleted", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  assert.equal((await store.offline({ bookId, voice: "bf_emma", action: "get" })).needsScript, true);
  await store.saveScript({
    bookId, title: "Test", author: "Me",
    sections: [
      { section: 1, title: "One", sentences: [sentence("A b."), sentence("C d.")] },
      { section: 3, title: "Two", sentences: [sentence("E f.")] },
    ],
  });
  let status = await store.offline({ bookId, voice: "bf_emma", action: "start" });
  assert.equal(status.total, 3);
  for (let i = 0; i < 100 && status.state !== "ready"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    status = await store.offline({ bookId, voice: "bf_emma", action: "get" });
  }
  assert.equal(status.state, "ready");
  assert.equal(status.chaptersReady, 2);
  const chapter = await store.offline({ bookId, voice: "bf_emma", section: 3, action: "delete" });
  assert.equal(chapter.state, "missing");
  assert.equal((await store.offline({ bookId, voice: "bf_emma", action: "get" })).state, "partial");
});

test("the desktop, frontend and backend voice lists match", () => {
  const desktop = require("../desktop/kokoro/voices.cjs").kokoroVoices;
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const backend = [...read("backend/src/services/reader/readerKokoroVoices.ts").matchAll(/"([ab][fm]_[a-z]+)"/g)].map((m) => m[1]);
  const frontend = [...read("frontend/src/services/audiobook/kokoroVoices.ts").matchAll(/voice\("([ab][fm]_[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(backend, desktop);
  assert.deepEqual(frontend, desktop);
});
