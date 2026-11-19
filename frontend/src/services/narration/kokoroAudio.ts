// Plays Kokoro narration one sentence at a time (ported from RozaReader's narration.ts): a few
// sentences ahead are made and preloaded, so the next one starts the moment the current one ends,
// and the spoken word follows the clip's real word timings. The desktop app speaks a whole paragraph
// at once and saves it as one clip per sentence; the pause after a paragraph is added here.
import { audiobookWordAt, type AudiobookSection } from "../readerTts";
import { desktopKokoro, type KokoroClip, type KokoroSentenceInput } from "./desktopKokoro";
import { kokoroSectionRequests } from "./kokoroPacing";

// Three sentences ahead are made and loaded, so the next one can start the moment one ends.
const READ_AHEAD = 3;
const MAX_PREPARED = 10;

type Prepared = { clip: KokoroClip; element: HTMLAudioElement };

export type KokoroHandlers = {
  onStart: () => void;
  onWord: (word: number | null) => void;
  onEnd: () => void;
};

const requestCache = new WeakMap<AudiobookSection["sentences"], { withPassages: boolean; requests: KokoroSentenceInput[] }>();
function requestsOf(section: AudiobookSection, withPassages: boolean) {
  let cached = requestCache.get(section.sentences);
  if (!cached || cached.withPassages !== withPassages) {
    cached = { withPassages, requests: kokoroSectionRequests(section.sentences, withPassages) };
    requestCache.set(section.sentences, cached);
  }
  return cached.requests;
}

/** The sentences spoken together with sentence `index`. */
function passageOf(requests: KokoroSentenceInput[], index: number) {
  const id = requests[index].passage;
  if (id === undefined) return undefined;
  let first = index;
  let last = index;
  while (first > 0 && requests[first - 1].passage === id) first--;
  while (last + 1 < requests.length && requests[last + 1].passage === id) last++;
  return { first, sentences: requests.slice(first, last + 1) };
}

export class ReaderKokoroAudio {
  private prepared = new Map<string, Promise<Prepared>>();
  private current?: { element: HTMLAudioElement; cleanup: () => void };
  private pauseTimer?: ReturnType<typeof setTimeout>;
  private version = 0;
  private rate = 1;
  private volume = 1;

  constructor(private bookId: string) {}

  private key(section: AudiobookSection, index: number, voice: string) {
    return section.section + "/" + index + "/" + voice;
  }

  private prepare(section: AudiobookSection, index: number, voice: string, priority: "high" | "low") {
    const key = this.key(section, index, voice);
    // A sentence already being made (read-ahead) is reused; the desktop app finishes it first.
    const existing = this.prepared.get(key);
    if (existing) return existing;
    const kokoro = desktopKokoro();
    if (!kokoro) return Promise.reject(new Error("Local voices need the Roza desktop app."));
    const requests = requestsOf(section, !!kokoro.passages);
    const passage = passageOf(requests, index);
    const request = kokoro.sentence({
      bookId: this.bookId, voice, section: section.section, index, sentence: requests[index], priority,
      ...(passage ? { passage } : {}),
    }).then(clip => {
      const element = new Audio();
      element.preload = "auto";
      element.src = clip.url;
      element.load();
      return { clip, element };
    });
    this.prepared.set(key, request);
    request.catch(() => { if (this.prepared.get(key) === request) this.prepared.delete(key); });
    while (this.prepared.size > MAX_PREPARED) this.prepared.delete(this.prepared.keys().next().value!);
    return request;
  }

  /** Starts the sentence at `offset` (a character offset in it) and calls back on words and its end. */
  async play(section: AudiobookSection, index: number, offset: number, voice: string, handlers: KokoroHandlers) {
    this.stopCurrent();
    const run = ++this.version;
    const { clip, element } = await this.prepare(section, index, voice, "high");
    if (run !== this.version) return;
    // A prepared element is used once; a replay gets a fresh one from the cache.
    this.prepared.delete(this.key(section, index, voice));
    const sentence = section.sentences[index];
    const startWord = offset > 0 ? audiobookWordAt(sentence.words, offset) : 0;
    element.currentTime = offset > 0 ? clip.words[startWord]?.start ?? 0 : 0;
    element.playbackRate = this.rate;
    element.preservesPitch = true;
    element.volume = this.volume;

    let frame = 0;
    let lastWord: number | null = -1;
    const tick = () => {
      const time = element.currentTime;
      let word: number | null = null;
      for (let i = 0; i < clip.words.length; i++) {
        if (clip.words[i].start <= time + 0.02) word = i;
        else break;
      }
      if (word !== lastWord) { lastWord = word; handlers.onWord(word); }
      frame = requestAnimationFrame(tick);
    };
    const ended = () => {
      if (run !== this.version) return;
      cleanup();
      // The silence after a paragraph, heading or scene break; it follows the reading speed.
      const pause = (clip.pause || 0) / (this.rate || 1);
      if (pause <= 0) { handlers.onEnd(); return; }
      this.pauseTimer = setTimeout(() => {
        this.pauseTimer = undefined;
        if (run === this.version) handlers.onEnd();
      }, pause * 1000);
    };
    const cleanup = () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("ended", ended);
      element.pause();
    };
    element.addEventListener("ended", ended);
    this.current = { element, cleanup };
    await element.play();
    if (run !== this.version) { cleanup(); return; }
    handlers.onStart();
    frame = requestAnimationFrame(tick);
    for (let ahead = 1; ahead <= READ_AHEAD && index + ahead < section.sentences.length; ahead++) {
      void this.prepare(section, index + ahead, voice, "low").catch(() => undefined);
    }
  }

  /** Makes the first sentences of a section ready in the background (e.g. the next chapter). */
  prefetch(section: AudiobookSection, index: number, voice: string) {
    void this.prepare(section, index, voice, "low").catch(() => undefined);
  }

  private stopCurrent() {
    clearTimeout(this.pauseTimer);
    this.pauseTimer = undefined;
    this.current?.cleanup();
    this.current = undefined;
  }

  pause() {
    ++this.version;
    this.stopCurrent();
  }

  stop() {
    this.pause();
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.current) this.current.element.playbackRate = rate;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.current) this.current.element.volume = volume;
  }

  dispose() {
    this.stop();
    this.prepared.clear();
  }
}
