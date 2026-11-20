// Sentence audio cache, saved book scripts and offline saves for Kokoro narration.
//
// The renderer owns the text: it splits sentences and words exactly as it highlights them, works out
// each sentence's pacing, and sends that here. A clip's file name includes a hash of everything that
// shapes its sound, so changed text or pacing never plays stale audio.
//
// A sentence that comes with its passage (usually its paragraph) is spoken together with the other
// sentences of that passage, so Kokoro phrases them as one thought; one Kokoro call saves a clip for
// every sentence of the passage. Its pause is not part of the clip: the player and the exporter add
// it, so changing pauses never makes audio again. A sentence without a passage (an older Roza page)
// is spoken alone with its pause in the clip, as before.
const { createHash } = require("node:crypto");
const { existsSync } = require("node:fs");
const { mkdir, readFile, readdir, rename, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { isKokoroVoice, kokoroVoices } = require("./voices.cjs");

// Bump when the audio format or timing rules change, so old clips are made again.
const AUDIO_VERSION = "1";
const PASSAGE_AUDIO_VERSION = "p1";
// Silence the service keeps after the last words of a passage; the player adds the rest of the pause.
const PASSAGE_TAIL_SECONDS = 0.16;
const MAX_PASSAGE_SENTENCES = 80;
const MAX_PASSAGE_WORDS = 1200;
// A whole-book save skips a sentence that fails; this many failures in a row stop it.
const MAX_FAILURES_IN_A_ROW = 3;
const BOOK_ID = /^[a-f0-9]{24}$/;
const MAX_SENTENCE_CHARS = 4000;
const MAX_WORDS = 800;
const MAX_SECTIONS = 5000;
const MAX_SCRIPT_SENTENCES = 200000;

const isIndex = (value, max = 1e6) => Number.isInteger(value) && value >= 0 && value <= max;
const isPace = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Throws unless `sentence` is { text, words, pause, speed, passage? } with sane sizes. */
function checkSentence(sentence) {
  const valid = sentence && typeof sentence.text === "string" && sentence.text.length <= MAX_SENTENCE_CHARS
    && Array.isArray(sentence.words) && sentence.words.length > 0 && sentence.words.length <= MAX_WORDS
    && sentence.words.every((word) => typeof word === "string" && word.length <= 200)
    && isPace(sentence.pause, 0, 5) && isPace(sentence.speed, 0.5, 2)
    && (sentence.passage === undefined || isIndex(sentence.passage));
  if (!valid) throw new Error("Invalid sentence.");
  return {
    text: sentence.text, words: sentence.words, pause: sentence.pause, speed: sentence.speed,
    ...(sentence.passage === undefined ? {} : { passage: sentence.passage }),
  };
}

/** Throws unless `passage` is { first, sentences } holding the sentence at `index`. */
function checkPassage(passage, index) {
  if (!passage || !isIndex(passage.first) || !Array.isArray(passage.sentences) || !passage.sentences.length
    || passage.sentences.length > MAX_PASSAGE_SENTENCES || index < passage.first || index >= passage.first + passage.sentences.length) {
    throw new Error("Invalid passage.");
  }
  const sentences = passage.sentences.map(checkSentence);
  if (sentences.reduce((sum, sentence) => sum + sentence.words.length, 0) > MAX_PASSAGE_WORDS) throw new Error("Invalid passage.");
  return { first: passage.first, sentences };
}

/** The passage of a saved script's sentence: the run of neighbours sharing its `passage` number. */
function passageIn(sentences, index) {
  const id = sentences[index].passage;
  if (id === undefined) return null;
  let first = index;
  let last = index;
  while (first > 0 && sentences[first - 1].passage === id) first--;
  while (last + 1 < sentences.length && sentences[last + 1].passage === id) last++;
  return { first, sentences: sentences.slice(first, last + 1) };
}

function checkBookId(bookId) {
  if (typeof bookId !== "string" || !BOOK_ID.test(bookId)) throw new Error("Invalid book.");
  return bookId;
}

function checkVoice(voice) {
  if (!isKokoroVoice(voice)) throw new Error("Unknown Kokoro voice.");
  return voice;
}

const clipName = (section, index, voice, sentence) => {
  const hash = createHash("sha1")
    .update(JSON.stringify([AUDIO_VERSION, voice, sentence.text, sentence.words, sentence.pause, sentence.speed]))
    .digest("hex").slice(0, 16);
  return `${section}-${index}-${hash}`;
};

// Pauses are left out: they are added at playback, so the same passage audio serves any pacing.
const passageHash = (voice, passage) => createHash("sha1")
  .update(JSON.stringify([PASSAGE_AUDIO_VERSION, voice, passage.sentences.map((sentence) => [sentence.text, sentence.words])]))
  .digest("hex").slice(0, 16);

const passageName = (section, index, hash, offset) =>
  `${section}-${index}-${createHash("sha1").update(`${hash}/${offset}`).digest("hex").slice(0, 16)}`;

const passageClipName = (section, index, voice, passage) =>
  passageName(section, index, passageHash(voice, passage), index - passage.first);

const nameOf = (section, index, voice, sentence, passage) =>
  passage ? passageClipName(section, index, voice, passage) : clipName(section, index, voice, sentence);

// Clip names of a saved section per voice, worked out once: offline status is polled often.
const sectionNames = new WeakMap();
function sectionClipNames(section, voice) {
  let byVoice = sectionNames.get(section);
  if (!byVoice) sectionNames.set(section, byVoice = new Map());
  let names = byVoice.get(voice);
  if (!names) {
    names = [];
    for (let index = 0; index < section.sentences.length;) {
      const passage = passageIn(section.sentences, index);
      if (!passage) {
        names.push(clipName(section.section, index, voice, section.sentences[index]));
        index++;
        continue;
      }
      const hash = passageHash(voice, passage);
      for (let offset = 0; offset < passage.sentences.length; offset++, index++) {
        names.push(passageName(section.section, index, hash, offset));
      }
    }
    byVoice.set(voice, names);
  }
  return names;
}

/** Seconds of silence the player or exporter adds after a sentence's clip. */
const pauseAfter = (sentence, passage) => (passage ? Math.max(0, sentence.pause - PASSAGE_TAIL_SECONDS) : 0);

/**
 * @param {{ audioDir: string, booksDir: string, engine: ReturnType<typeof import("./engine.cjs").createEngine> }} options
 */
function createStore({ audioDir, booksDir, engine }) {
  const inFlight = new Map();
  const previewJobs = new Map();
  const scripts = new Map();
  const bookJobs = new Map();

  const urlOf = (bookId, voice, name) => `/__kokoro/audio/${bookId}/${voice}/${name}.wav`;

  /**
   * Makes sure one sentence has audio; returns its url, file, length, word times and the pause to add
   * after it. With a passage, the whole passage is spoken once and every sentence of it is saved.
   */
  async function ensureSentence({ bookId, voice, section, index, sentence, passage = null, priority }) {
    const folder = path.join(audioDir, bookId, voice);
    const name = nameOf(section, index, voice, sentence, passage);
    const wav = path.join(folder, `${name}.wav`);
    const json = path.join(folder, `${name}.json`);
    const pause = pauseAfter(sentence, passage);
    const result = (timing) => ({
      url: urlOf(bookId, voice, name), file: wav, duration: timing.duration, pause,
      words: timing.words.map(([start, end]) => ({ start, end })),
    });
    if (existsSync(wav) && existsSync(json)) {
      try { return result(JSON.parse(await readFile(json, "utf8"))); } catch { /* Remake a damaged clip. */ }
    }
    if (passage) return result(await ensurePassage({ bookId, voice, section, passage, priority }, index));
    const key = `${bookId}/${voice}/${name}`;
    const pending = inFlight.get(key);
    if (pending) {
      // A listener waiting on read-ahead gets it promoted by asking again at high priority.
      return result(await pending);
    }
    const task = (async () => {
      await mkdir(folder, { recursive: true });
      const temp = path.join(folder, `${name}.${process.pid}.tmp.wav`);
      const timing = await engine.synthesize({
        text: sentence.text, words: sentence.words, voice, out: temp, pause: sentence.pause, speed: sentence.speed,
        bookId,
      }, priority);
      await rename(temp, wav);
      await writeFile(json, JSON.stringify(timing));
      return timing;
    })();
    inFlight.set(key, task);
    try {
      return result(await task);
    } finally {
      inFlight.delete(key);
    }
  }

  /** Speaks a passage once and saves a clip per sentence; resolves to the timing of sentence `index`. */
  async function ensurePassage({ bookId, voice, section, passage, priority }, index) {
    const folder = path.join(audioDir, bookId, voice);
    const key = `${bookId}/${voice}/${section}-${passage.first}-${passageHash(voice, passage)}`;
    let task = inFlight.get(key);
    if (!task) {
      task = (async () => {
        await mkdir(folder, { recursive: true });
        const names = passage.sentences.map((_, offset) => passageClipName(section, passage.first + offset, voice, passage));
        const temps = names.map((name) => path.join(folder, `${name}.${process.pid}.tmp.wav`));
        const { clips } = await engine.synthesize({
          voice, bookId,
          sentences: passage.sentences.map((item, offset) => ({ text: item.text, words: item.words, out: temps[offset] })),
        }, priority);
        if (!Array.isArray(clips) || clips.length !== names.length) throw new Error("Kokoro returned the wrong number of sentences.");
        for (let offset = 0; offset < names.length; offset++) {
          await rename(temps[offset], path.join(folder, `${names[offset]}.wav`));
          await writeFile(path.join(folder, `${names[offset]}.json`), JSON.stringify(clips[offset]));
        }
        return clips;
      })();
      inFlight.set(key, task);
      task.finally(() => { if (inFlight.get(key) === task) inFlight.delete(key); }).catch(() => {});
    }
    return (await task)[index - passage.first];
  }

  async function sentence(input) {
    const bookId = checkBookId(input?.bookId);
    const voice = checkVoice(input?.voice);
    if (!isIndex(input.section, MAX_SECTIONS) || !isIndex(input.index)) throw new Error("Invalid position.");
    const passage = input.passage === undefined ? null : checkPassage(input.passage, input.index);
    const { url, duration, words, pause } = await ensureSentence({
      bookId, voice, section: input.section, index: input.index,
      sentence: passage ? passage.sentences[input.index - passage.first] : checkSentence(input.sentence),
      passage, priority: input.priority === "low" ? "low" : "high",
    });
    return { url, duration, words, pause };
  }

  async function preview(voice, text, priority = "high", signal) {
    checkVoice(voice);
    const hash = createHash("sha256").update(AUDIO_VERSION).update(text).digest("hex").slice(0, 16);
    const name = `${voice}-${hash}`;
    const folder = path.join(audioDir, "_preview");
    const wav = path.join(folder, `${name}.wav`);
    if (!existsSync(wav)) {
      let job = previewJobs.get(name);
      if (!job) {
        job = (async () => {
          await mkdir(folder, { recursive: true });
          signal?.throwIfAborted();
          const temp = path.join(folder, `${name}.${process.pid}.tmp.wav`);
          try {
            await engine.synthesize({ text, words: text.split(" "), voice, out: temp }, priority);
            await rename(temp, wav);
          } finally {
            await rm(temp, { force: true }).catch(() => {});
          }
        })().finally(() => previewJobs.delete(name));
        previewJobs.set(name, job);
      }
      await job;
    }
    return { url: `/__kokoro/preview/${name}.wav` };
  }

  async function warmPreviews(text, signal) {
    for (const voice of kokoroVoices) {
      signal.throwIfAborted();
      await preview(voice, text, "low", signal);
    }
  }

  // ---- Book scripts (the whole book's sentences, for offline saves and export) ----

  /** Saves the book's script so offline saves and exports can run without the page. */
  async function saveScript(input) {
    const bookId = checkBookId(input?.bookId);
    if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > MAX_SECTIONS) {
      throw new Error("Invalid book script.");
    }
    let count = 0;
    const sections = input.sections.map((section) => {
      if (!isIndex(section?.section, MAX_SECTIONS) || !Array.isArray(section.sentences)) throw new Error("Invalid book script.");
      count += section.sentences.length;
      if (count > MAX_SCRIPT_SENTENCES) throw new Error("This book is too long to save.");
      const sentences = section.sentences.map(checkSentence);
      for (let index = 0; index < sentences.length; index++) {
        const passage = passageIn(sentences, index);
        if (passage && passage.first === index) checkPassage(passage, index);
      }
      return {
        section: section.section,
        title: typeof section.title === "string" ? section.title.slice(0, 300) : "",
        sentences,
      };
    });
    const script = {
      bookId,
      title: typeof input.title === "string" ? input.title.slice(0, 300) : "Audiobook",
      author: typeof input.author === "string" ? input.author.slice(0, 300) : "",
      sections,
    };
    await mkdir(booksDir, { recursive: true });
    await writeFile(path.join(booksDir, `${bookId}.json`), JSON.stringify(script));
    scripts.set(bookId, script);
    return { sections: sections.length, sentences: count };
  }

  async function loadScript(bookId) {
    if (scripts.has(bookId)) return scripts.get(bookId);
    try {
      const script = JSON.parse(await readFile(path.join(booksDir, `${bookId}.json`), "utf8"));
      scripts.set(bookId, script);
      return script;
    } catch {
      return null;
    }
  }

  async function hasScript(bookId) {
    return Boolean(await loadScript(checkBookId(bookId)));
  }

  // ---- Offline saves ----

  /** Counts saved clips per section from one folder listing, so polling stays cheap. */
  async function savedPerSection(script, voice) {
    const names = new Set(await readdir(path.join(audioDir, script.bookId, voice)).catch(() => []));
    return script.sections.map((section) => sectionClipNames(section, voice)
      .filter((name) => names.has(`${name}.wav`) && names.has(`${name}.json`)).length);
  }

  const jobKey = (bookId, voice, section) => `${bookId}/${voice}/${section ?? "book"}`;

  /** `section` null = whole book. Returns status. */
  async function offline(input) {
    const bookId = checkBookId(input?.bookId);
    const voice = checkVoice(input?.voice);
    const action = ["get", "start", "stop", "delete"].includes(input.action) ? input.action : "get";
    const section = input.section === null || input.section === undefined ? null : input.section;
    if (section !== null && !isIndex(section, MAX_SECTIONS)) throw new Error("Invalid chapter.");
    const script = await loadScript(bookId);
    if (!script) return { state: "missing", completed: 0, total: 0, chaptersReady: 0, chapters: 0, needsScript: true };
    const parts = section === null ? script.sections : script.sections.filter((item) => item.section === section);
    if (!parts.length) throw new Error("Chapter not found.");
    const key = jobKey(bookId, voice, section);

    if (action === "start" && !bookJobs.get(key)?.task) {
      const job = { stopped: false, section: parts[0].section };
      bookJobs.set(key, job);
      job.task = (async () => {
        let failures = 0;
        for (const part of parts) {
          job.section = part.section;
          for (let index = 0; index < part.sentences.length && !job.stopped; index++) {
            try {
              await ensureSentence({
                bookId, voice, section: part.section, index, sentence: part.sentences[index],
                passage: passageIn(part.sentences, index), priority: "low",
              });
              failures = 0;
            } catch (error) {
              if (job.stopped) break;
              failures += 1;
              job.error = error.message;
              if (failures >= MAX_FAILURES_IN_A_ROW) job.stopped = true;
            }
          }
          if (job.stopped) break;
        }
      })().finally(() => { job.task = undefined; });
    }
    if (action === "stop" || action === "delete") {
      // Stop every save of this book and voice that covers this part.
      for (const [otherKey, job] of bookJobs) {
        if (otherKey.startsWith(`${bookId}/${voice}/`) && (section === null || otherKey === key || otherKey.endsWith("/book"))) {
          job.stopped = true;
        }
      }
      engine.dropLow((request) => request.bookId === bookId && request.voice === voice);
      await Promise.all([...bookJobs.values()].map((job) => job.task).filter(Boolean));
    }
    if (action === "delete") {
      if (section === null) {
        await rm(path.join(audioDir, bookId, voice), { recursive: true, force: true });
      } else {
        const names = await readdir(path.join(audioDir, bookId, voice)).catch(() => []);
        await Promise.all(names.filter((name) => name.startsWith(`${section}-`))
          .map((name) => rm(path.join(audioDir, bookId, voice, name), { force: true })));
      }
      bookJobs.delete(key);
    }

    const saved = await savedPerSection({ ...script, sections: parts }, voice);
    const job = bookJobs.get(key);
    const total = parts.reduce((sum, part) => sum + part.sentences.length, 0);
    const completed = saved.reduce((sum, count) => sum + count, 0);
    const isRunning = Boolean(job?.task) && !job?.stopped;
    return {
      state: completed >= total ? "ready" : isRunning ? "downloading" : job?.error ? "error" : completed ? "partial" : "missing",
      completed, total,
      chaptersReady: parts.filter((part, index) => saved[index] >= part.sentences.length).length,
      chapters: parts.length,
      ...(isRunning && job ? { section: job.section } : {}),
      ...(job?.error && completed < total ? { error: job.error } : {}),
    };
  }

  /** Removes every saved clip (used by "Remove local voices"). */
  async function clearAudio() {
    for (const job of bookJobs.values()) job.stopped = true;
    await rm(audioDir, { recursive: true, force: true });
  }

  return { sentence, preview, warmPreviews, saveScript, hasScript, loadScript, ensureSentence, offline, clearAudio };
}

module.exports = { createStore, clipName, passageIn, AUDIO_VERSION };
