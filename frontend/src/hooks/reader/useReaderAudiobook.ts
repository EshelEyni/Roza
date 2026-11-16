import { useEffect, useRef, useState } from "react";
import { audiobookSpeechSlice, audiobookSeek, audiobookWordAt, type AudiobookSection } from "../../services/readerTts";

export type AudiobookLoader = (target?: number, direction?: 1 | -1) => Promise<AudiobookSection | null>;

export function useReaderAudiobook(loadSection: AudiobookLoader) {
  const [section, setSection] = useState<AudiobookSection | null>(null);
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [wordEvents, setWordEvents] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading book…");
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState(1);
  const position = useRef({ section: null as AudiobookSection | null, index: 0, offset: 0 });
  const loader = useRef(loadSection); loader.current = loadSection;
  const selectedVoice = useRef("");
  const rate = useRef(1);
  const wantPlay = useRef(false);
  const version = useRef(0);
  const loadVersion = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance>();
  const synth = window.speechSynthesis;

  function cancel() {
    ++version.current;
    const previous = utterance.current;
    utterance.current = undefined;
    if (previous) {
      previous.onstart = null; previous.onboundary = null;
      previous.onend = null; previous.onerror = null;
      synth?.cancel();
    }
  }
  function pause(message = "Paused · press Play to continue") {
    // Cancel at the last real word boundary: native pause/resume is unreliable
    // on mobile voices. Without boundaries, replay the current speech chunk.
    cancel(); wantPlay.current = false; setPlaying(false); setStatus(message);
  }
  function completed() {
    cancel(); wantPlay.current = false;
    setPlaying(false); setEnded(true); setStatus("End of book");
  }
  function fail(cause: unknown) {
    pause("Playback paused");
    setError(cause instanceof Error ? cause.message : String(cause));
  }
  function speak() {
    const { section: current, index: sentenceIndex, offset: start } = position.current;
    if (!current || !wantPlay.current) return;
    cancel();
    const run = version.current;
    const sentence = current.sentences[sentenceIndex];
    const part = audiobookSpeechSlice(sentence.text, start);
    try {
      if (!synth) throw new Error("System speech is unavailable in this browser.");
      const next = new SpeechSynthesisUtterance(part.text);
      next.voice = synth.getVoices().find(item => item.voiceURI === selectedVoice.current) || null;
      if (next.voice) next.lang = next.voice.lang;
      next.rate = rate.current;
      next.onstart = () => { if (version.current === run) setStatus("Following narration"); };
      next.onboundary = event => {
        if (version.current !== run || event.name === "sentence" || !Number.isFinite(event.charIndex)) return;
        const word = audiobookWordAt(sentence.words, start + event.charIndex);
        const character = sentence.words[word]?.start || 0;
        position.current.offset = character;
        setOffset(character); setHighlight(word); setWordEvents(true);
      };
      next.onend = () => {
        if (version.current !== run || !wantPlay.current) return;
        utterance.current = undefined;
        let following = part.end;
        while (/\s/u.test(sentence.text[following] || "") && following < sentence.text.length) following++;
        if (following < sentence.text.length) {
          position.current.offset = following; setOffset(following); speak();
        } else if (sentenceIndex + 1 < current.sentences.length) {
          goTo(sentenceIndex + 1, 0);
        } else if (current.next !== null) {
          void load(current.next, 1, true);
        } else completed();
      };
      next.onerror = event => {
        if (version.current === run) fail(new Error("System speech: " + event.error + ". Press Play to retry or choose another voice."));
      };
      utterance.current = next;
      synth.resume(); synth.speak(next);
    } catch (cause) { fail(cause); }
  }
  function goTo(sentence: number, character = 0) {
    cancel(); setError(""); setEnded(false);
    position.current.index = sentence; position.current.offset = character;
    setIndex(sentence); setOffset(character); setHighlight(null);
    if (wantPlay.current) { setStatus("Starting narration…"); speak(); }
    else setStatus("Paused · press Play to continue");
  }
  async function load(target?: number, direction: 1 | -1 = 1, autoplay = false) {
    cancel();
    const request = ++loadVersion.current;
    wantPlay.current = autoplay;
    setPlaying(autoplay); setLoading(true); setError(""); setHighlight(null);
    setStatus("Loading book…");
    try {
      const next = await loader.current(target, direction);
      if (request !== loadVersion.current) return;
      if (!next) {
        if (!position.current.section) { setStatus("No readable text in this book section"); return; }
        const previous = position.current.section;
        const bounded = { ...previous, ...(direction > 0 ? { next: null } : { previous: null }) };
        position.current.section = bounded; setSection(bounded);
        if (direction > 0) completed(); else pause("Start of book");
        return;
      }
      position.current = { section: next, index: next.start, offset: next.offset };
      setSection(next); setIndex(next.start); setOffset(next.offset); setEnded(false);
      const shouldPlay = wantPlay.current;
      setStatus(shouldPlay ? "Starting narration…" : autoplay ? "Paused · press Play to continue" : "Ready to listen");
      if (shouldPlay) speak();
    } catch (cause) {
      if (request === loadVersion.current) fail(cause);
    } finally {
      if (request === loadVersion.current) setLoading(false);
    }
  }
  function resume() {
    if (!position.current.section) return;
    if (ended && !loading) goTo(0);
    setError(""); wantPlay.current = true; setPlaying(true);
    setStatus(loading ? "Loading book…" : "Starting narration…");
    if (!loading) speak();
  }
  function toggle() {
    if (wantPlay.current) { pause(); return; }
    if (!loading) resume();
  }
  function move(direction: 1 | -1) {
    const current = position.current.section;
    if (!current || loading) return;
    const next = position.current.index + direction;
    if (next >= 0 && next < current.sentences.length) goTo(next);
    else {
      const target = direction > 0 ? current.next : current.previous;
      if (target !== null) void load(target, direction, wantPlay.current);
    }
  }
  function seek(word: number) {
    const current = position.current.section;
    if (!current || loading) return;
    const next = audiobookSeek(current, word);
    goTo(next.sentence, next.offset);
  }
  function changeVoice(value: string) {
    selectedVoice.current = value; setVoice(value); setWordEvents(false);
    if (position.current.section) goTo(position.current.index, position.current.offset);
  }
  function changeSpeed(value: number) {
    rate.current = Math.max(0.5, Math.min(2.5, value)); setSpeed(rate.current);
    if (position.current.section) goTo(position.current.index, position.current.offset);
  }

  useEffect(() => {
    void load();
    const updateVoices = () => setVoices(Array.from(new Map((synth?.getVoices() || []).filter(item => item.voiceURI).map(item => [item.voiceURI, item])).values()));
    updateVoices(); synth?.addEventListener("voiceschanged", updateVoices);
    const hide = () => {
      wantPlay.current = false; setPlaying(false);
      pause("Paused while the app was hidden · press Play to continue");
    };
    const visibility = () => { if (document.hidden) hide(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    return () => {
      // These refs invalidate pending requests; they are not DOM refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++loadVersion.current;
      wantPlay.current = false; cancel();
      synth?.removeEventListener("voiceschanged", updateVoices);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
    };
    // Load once per book/mode mount; mutable playback work uses refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sentence = section?.sentences[index];
  const currentWord = sentence ? sentence.startWord + audiobookWordAt(sentence.words, offset) : 0;
  return {
    section, index, offset, highlight, wordEvents, playing, ended, loading, status, error,
    voices, voice, speed, toggle, move, seek, changeVoice, changeSpeed, pause, resume,
    available: !!synth,
    currentWord: ended ? section?.totalWords || 0 : currentWord,
    cfi: sentence?.cfi,
  };
}
