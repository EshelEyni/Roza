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
  if (request.sentences) {
    const folder = require("node:path").dirname(request.sentences[0].out);
    fs.appendFileSync(require("node:path").join(folder, "order.txt"), "passage: " + request.sentences.map(item => item.text).join(" | ") + "\\n");
    const clips = request.sentences.map(item => {
      fs.writeFileSync(item.out, Buffer.alloc(500, 3));
      return { duration: item.words.length * 0.5, words: item.words.map((_, i) => [i * 0.5, i * 0.5 + 0.4]) };
    });
    return setTimeout(() => process.stdout.write(JSON.stringify({ id: request.id, ok: true, clips }) + "\\n"), 5);
  }
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

test("voice previews warm once, survive a new store, and change with the sample", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const audioDir = path.join(dir, "audio");
  const text = "It was the best of times.";
  const signal = new AbortController().signal;
  const [, first] = await Promise.all([store.warmPreviews(text, signal), store.preview("af_heart", text)]);
  assert.match(first.url, /^\/__kokoro\/preview\/af_heart-[a-f0-9]{16}\.wav$/);
  const folder = path.join(audioDir, "_preview");
  const files = fs.readdirSync(folder);
  const { kokoroVoices } = require("../desktop/kokoro/voices.cjs");
  assert.equal(files.filter(name => name.endsWith(".wav")).length, kokoroVoices.length);
  const renders = fs.readFileSync(path.join(folder, "order.txt"), "utf8").trim().split(/\r?\n/);
  assert.equal(renders.length, kokoroVoices.length, "a click shares any in-flight preview");
  const reopened = createStore({ audioDir, booksDir: path.join(dir, "books"), engine: {
    synthesize: () => assert.fail("cached previews should not need the engine"),
  } });
  await reopened.warmPreviews(text, signal);
  assert.deepEqual(await reopened.preview("af_heart", text), first);
  const changed = await store.preview("af_heart", "It was the worst of times.");
  assert.notEqual(changed.url, first.url);
  const url = new URL("https://roza.esheleyni.com" + changed.url);
  const response = await serveKokoroAudio(new Request(url, { headers: { range: "bytes=0-9" } }), url, audioDir);
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 10);
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

const orderIn = (dir, voice) => fs.readFileSync(path.join(dir, "audio", bookId, voice, "order.txt"), "utf8").trim().split(/\r?\n/);

test("a paragraph is spoken once and saved as one clip per sentence, with its pause left to the player", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const sentences = [
    { ...sentence("First one here.", 0), passage: 0 },
    { ...sentence("Second.", 0), passage: 0 },
    { ...sentence("Third and last.", 1.15), passage: 0 },
  ];
  const passage = { first: 4, sentences };
  const ask = (index, priority = "high") => store.sentence({ bookId, voice: "af_heart", section: 2, index, sentence: sentences[index - 4], passage, priority });
  const [second, first, third] = await Promise.all([ask(5), ask(4), ask(6, "low")]);
  assert.deepEqual(orderIn(dir, "af_heart"), ["passage: First one here. | Second. | Third and last."], "one Kokoro call for the whole paragraph");
  assert.match(first.url, /\/2-4-[a-f0-9]{16}\.wav$/);
  assert.match(third.url, /\/2-6-[a-f0-9]{16}\.wav$/);
  assert.deepEqual(second.words, [{ start: 0, end: 0.4 }]);
  assert.equal(first.pause, 0);
  assert.ok(Math.abs(third.pause - 0.99) < 1e-9, "the player adds the paragraph pause minus the clip's own tail");

  const longerPause = [sentences[0], sentences[1], { ...sentences[2], pause: 2.6 }];
  const longer = await store.sentence({ bookId, voice: "af_heart", section: 2, index: 6, sentence: longerPause[2], passage: { first: 4, sentences: longerPause } });
  assert.equal(longer.url, third.url, "a new pause reuses the audio");
  assert.equal(orderIn(dir, "af_heart").length, 1);
  await assert.rejects(store.sentence({ bookId, voice: "af_heart", section: 2, index: 9, sentence: sentences[0], passage }), /Invalid passage/);
});

test("an offline save speaks each paragraph of the script once", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  await store.saveScript({
    bookId, title: "Test", author: "Me",
    sections: [{ section: 0, title: "One", sentences: [
      { ...sentence("A b.", 0), passage: 0 }, { ...sentence("C d.", 1.15), passage: 0 },
      { ...sentence("* * *", 2.6), passage: 1 },
      { ...sentence("E f.", 2.5), passage: 2 },
    ] }],
  });
  let status = await store.offline({ bookId, voice: "af_heart", action: "start" });
  for (let i = 0; i < 100 && status.state !== "ready"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    status = await store.offline({ bookId, voice: "af_heart", action: "get" });
  }
  assert.equal(status.state, "ready");
  assert.equal(status.completed, 4);
  assert.deepEqual(orderIn(dir, "af_heart"), ["passage: A b. | C d.", "passage: * * *", "passage: E f."]);
});

test("the desktop, frontend and backend voice lists match", () => {
  const { kokoroVoices, chatterboxVoices } = require("../desktop/kokoro/voices.cjs");
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const backendFile = read("backend/src/services/reader/readerKokoroVoices.ts");
  const frontendFile = read("frontend/src/services/narration/kokoroVoices.ts");
  const ids = (text, pattern) => [...text.matchAll(pattern)].map((m) => m[1]);
  assert.deepEqual(ids(backendFile, /"([ab][fm]_[a-z]+)"/g), kokoroVoices);
  assert.deepEqual(ids(frontendFile, /voice\("([ab][fm]_[a-z]+)"/g), kokoroVoices);
  assert.deepEqual(ids(backendFile, /"(cb_[a-z]+)"/g), chatterboxVoices);
  assert.deepEqual(ids(frontendFile, /expressive\("(cb_[a-z]+)"/g), chatterboxVoices);
  // Every cloned voice ships a reference clip; cb_default is Turbo's built-in voice.
  const clips = fs.readdirSync(path.join(__dirname, "..", "desktop", "chatterbox", "voices")).map((name) => name.replace(/\.wav$/, ""));
  assert.deepEqual(clips.sort(), chatterboxVoices.filter((voice) => voice !== "cb_default").sort());
});

test("expressive voices go to the add-on engine, and only once it is installed", async (t) => {
  const { dir, engine, store } = setup();
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  let installed = false;
  const addonCalls = [];
  const addon = { synthesize: async (request) => { addonCalls.push(request.voice); fs.writeFileSync(request.out, Buffer.alloc(10)); return { duration: 1, words: [[0, 0.5]] }; }, dropLow: () => {} };
  const routed = createStore({
    audioDir: path.join(dir, "audio"), booksDir: path.join(dir, "books"), engine,
    engineFor: (voice) => {
      if (!voice.startsWith("cb_")) return engine;
      if (!installed) throw new Error("Expressive voices are not installed.");
      return addon;
    },
    engines: () => [engine, addon],
  });
  await assert.rejects(routed.sentence({ bookId, voice: "cb_heart", section: 0, index: 0, sentence: sentence("Hi.") }), /not installed/);
  installed = true;
  const clip = await routed.sentence({ bookId, voice: "cb_heart", section: 0, index: 0, sentence: sentence("Hi.") });
  assert.match(clip.url, /^\/__kokoro\/audio\/a{24}\/cb_heart\/0-0-[a-f0-9]{16}\.wav$/);
  assert.deepEqual(addonCalls, ["cb_heart"]);
  const kokoroClip = await routed.sentence({ bookId, voice: "af_heart", section: 0, index: 0, sentence: sentence("Hi.") });
  assert.match(kokoroClip.url, /\/af_heart\//);
  assert.deepEqual(addonCalls, ["cb_heart"], "Kokoro voices stay on Kokoro");

  const url = new URL("https://roza.esheleyni.com" + clip.url);
  assert.equal((await serveKokoroAudio(new Request(url), url, path.join(dir, "audio"))).status, 200);
  await routed.clearVoices(["cb_heart"]);
  assert.equal(fs.existsSync(path.join(dir, "audio", bookId, "cb_heart")), false, "removing the add-on removes its audio");
  assert.equal(fs.existsSync(path.join(dir, "audio", bookId, "af_heart")), true, "and keeps Kokoro's");
});

test("an idle engine stops itself and starts again on the next request", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roza-kokoro-idle-"));
  const script = path.join(dir, "fake-service.cjs");
  fs.writeFileSync(script, FAKE_SERVICE);
  const engine = createEngine({ python: () => process.execPath, script, cwd: os.tmpdir(), env: () => process.env, isInstalled: () => true, label: "Chatterbox", idleMs: 50 });
  t.after(() => { engine.stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  await engine.synthesize({ text: "one", words: ["one"], voice: "cb_heart", out: path.join(dir, "1.wav") }, "high");
  assert.equal(engine.status().state, "ready");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(engine.status().state, "stopped");
  await engine.synthesize({ text: "two", words: ["two"], voice: "cb_heart", out: path.join(dir, "2.wav") }, "high");
  assert.equal(engine.status().state, "ready");
});
