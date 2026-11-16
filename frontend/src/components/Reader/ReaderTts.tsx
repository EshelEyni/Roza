import { useEffect, useRef, useState } from "react";
import { ReaderSelect } from "./ReaderSelect";
import type { TtsCursor, TtsPassage } from "../../services/readerTts";

type VoiceOption = { value: string; label: string };
type Prepared = { passage: TtsPassage; buffer: AudioBuffer };
type PreparedResult = { value: Prepared | null; error?: unknown };
type Pending = { id: number; resolve: (blob: Blob) => void; reject: (error: Error) => void };

export function ReaderTts({ getPassage }: {
  getPassage: (cursor?: TtsCursor) => Promise<TtsPassage | null>;
}) {
  const [engine, setEngine] = useState("system");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [kokoroVoices, setKokoroVoices] = useState<VoiceOption[]>([{ value: "af_heart", label: "Heart · en-us · Female" }]);
  const [kokoroVoice, setKokoroVoice] = useState("af_heart");
  const [speed, setSpeed] = useState("1");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const current = useRef<TtsPassage | null>(null);
  const getCurrentPassage = useRef(getPassage);
  getCurrentPassage.current = getPassage;
  const session = useRef(0);
  const loadRequest = useRef(0);
  const workerRequest = useRef(0);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  const buffering = useRef(false);
  const worker = useRef<Worker>();
  const pending = useRef<Pending>();
  const context = useRef<AudioContext>();
  const source = useRef<AudioBufferSourceNode>();
  const finishAudio = useRef<() => void>();
  const resumeSpeech = useRef<() => void>();
  const utterance = useRef<SpeechSynthesisUtterance>();
  const synth = window.speechSynthesis;

  function stop(silent = false) {
    ++session.current;
    pausedRef.current = false; buffering.current = false;
    resumeSpeech.current = undefined;
    if (utterance.current) {
      utterance.current.onend = null; utterance.current.onerror = null;
      utterance.current.onpause = null; utterance.current.onresume = null;
      synth?.cancel(); utterance.current = undefined;
    }
    if (source.current) {
      source.current.onended = null;
      source.current.stop(); source.current.disconnect(); source.current = undefined;
    }
    finishAudio.current?.(); finishAudio.current = undefined;
    const oldContext = context.current;
    context.current = undefined;
    if (oldContext) oldContext.onstatechange = null;
    if (oldContext && oldContext.state !== "closed") void oldContext.close().catch(() => {});
    worker.current?.terminate(); worker.current = undefined;
    pending.current?.reject(new Error("Stopped"));
    pending.current = undefined;
    if (!silent) { setActive(false); setPaused(false); setStatus(""); }
  }
  function fail(run: number, cause: unknown) {
    if (session.current !== run) return;
    stop();
    setError(cause instanceof Error ? cause.message : String(cause));
  }
  function finish(run: number) {
    if (session.current !== run) return;
    stop(); setStatus("End of book.");
  }

  function ensureWorker() {
    if (worker.current) return worker.current;
    const next = new Worker(new URL("../../services/readerKokoro.worker.ts", import.meta.url), { type: "module" });
    worker.current = next;
    next.onmessage = (event: MessageEvent<{ id?: number; voices?: VoiceOption[]; status?: string; error?: string; blob?: Blob }>) => {
      if (worker.current !== next) return;
      if (event.data.voices) setKokoroVoices(event.data.voices);
      const request = pending.current;
      if (!request || request.id !== event.data.id) return;
      if (event.data.status && buffering.current) setStatus(pausedRef.current ? "Paused." : event.data.status);
      if (event.data.error) {
        pending.current = undefined;
        request.reject(new Error("Kokoro: " + event.data.error + ". Try System Voices on this device."));
      } else if (event.data.blob) {
        pending.current = undefined; request.resolve(event.data.blob);
      }
    };
    next.onerror = event => {
      event.preventDefault();
      if (worker.current !== next) return;
      const message = "Kokoro could not load. Check your connection or try System Voices.";
      const request = pending.current;
      pending.current = undefined;
      next.terminate(); worker.current = undefined;
      if (request) request.reject(new Error(message)); else setError(message);
    };
    return next;
  }
  async function prepare(passage: TtsPassage, run: number, ctx: AudioContext, selectedVoice: string): Promise<Prepared> {
    if (session.current !== run) throw new Error("Stopped");
    const next = ensureWorker();
    const blob = await new Promise<Blob>((resolve, reject) => {
      const id = ++workerRequest.current;
      pending.current = { id, resolve, reject };
      next.postMessage({ id, text: passage.text, voice: selectedVoice });
    });
    if (session.current !== run) throw new Error("Stopped");
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    return { passage, buffer };
  }
  function playBuffer(buffer: AudioBuffer, ctx: AudioContext, run: number) {
    return new Promise<void>(resolve => {
      if (session.current !== run) { resolve(); return; }
      const node = ctx.createBufferSource();
      node.buffer = buffer; node.playbackRate.value = speedRef.current;
      node.connect(ctx.destination);
      source.current = node; finishAudio.current = resolve;
      node.onended = () => {
        node.disconnect();
        if (source.current === node) { source.current = undefined; finishAudio.current = undefined; }
        resolve();
      };
      // The context was unlocked synchronously by Play. A suspended context also
      // holds a ready next chunk during Pause, without requiring another gesture.
      node.start();
    });
  }
  async function readKokoro(passage: TtsPassage, run: number, ctx: AudioContext, selectedVoice: string) {
    try {
      let prepared: Prepared | null = await prepare(passage, run, ctx, selectedVoice);
      while (prepared && session.current === run) {
        current.current = prepared.passage; setText(prepared.passage.text);
        buffering.current = false;
        setStatus(pausedRef.current ? "Paused." : "Reading…");
        const ended = playBuffer(prepared.buffer, ctx, run);
        // At most one chunk ahead, never a whole chapter/book of generated audio.
        const ahead: Promise<PreparedResult> = (prepared.passage.next
          ? getCurrentPassage.current(prepared.passage.next).then(next => next ? prepare(next, run, ctx, selectedVoice) : null)
          : Promise.resolve(null)).then(
            value => ({ value, error: undefined }),
            error => ({ value: null, error }),
          );
        await ended;
        if (session.current !== run) return;
        buffering.current = true;
        setStatus(pausedRef.current ? "Paused." : "Preparing next passage…");
        const outcome = await ahead;
        if (session.current !== run) return;
        if (outcome.error) throw outcome.error;
        prepared = outcome.value;
      }
      finish(run);
    } catch (cause) { fail(run, cause); }
  }
  function readSystem(passage: TtsPassage, run: number, selectedVoice: SpeechSynthesisVoice | null) {
    if (session.current !== run) return;
    current.current = passage; setText(passage.text);
    if (pausedRef.current) {
      resumeSpeech.current = () => readSystem(passage, run, selectedVoice);
      return;
    }
    try {
      if (!synth) throw new Error("System speech is unavailable in this browser.");
      const next = new SpeechSynthesisUtterance(passage.text);
      next.voice = selectedVoice;
      if (selectedVoice) next.lang = selectedVoice.lang;
      next.rate = speedRef.current;
      next.onend = () => {
        if (session.current !== run) return;
        utterance.current = undefined;
        if (!passage.next) { finish(run); return; }
        setStatus("Preparing next passage…");
        void getCurrentPassage.current(passage.next).then(following => {
          if (session.current !== run) return;
          if (following) readSystem(following, run, selectedVoice); else finish(run);
        }).catch(cause => fail(run, cause));
      };
      next.onerror = event => fail(run, new Error("System speech: " + event.error + ". Tap Play to retry."));
      next.onpause = () => { if (session.current === run) { pausedRef.current = true; setPaused(true); setStatus("Paused."); } };
      next.onresume = () => { if (session.current === run) { pausedRef.current = false; setPaused(false); setStatus("Reading…"); } };
      utterance.current = next;
      setStatus("Reading…"); synth.resume(); synth.speak(next);
    } catch (cause) { fail(run, cause); }
  }
  function play() {
    const passage = current.current;
    if (!passage) return;
    stop(); setError(""); setActive(true);
    const run = session.current;
    if (engine === "system") {
      readSystem(passage, run, voices.find(item => item.voiceURI === voice) || null);
    } else {
      try {
        // Safari requires unlocking audio inside the click, before model download/inference.
        const ctx = new AudioContext();
        context.current = ctx; buffering.current = true;
        setStatus("Preparing speech… First use downloads the voice model.");
        void ctx.resume().then(() => {
          if (session.current !== run) return;
          ctx.onstatechange = () => {
            if (session.current === run && ctx.state === "suspended" && !pausedRef.current) {
              pausedRef.current = true; setPaused(true);
              setStatus("Audio was interrupted. Tap Resume to continue.");
            }
          };
          return readKokoro(passage, run, ctx, kokoroVoice);
        }).catch(cause => fail(run, cause));
      } catch (cause) { fail(run, cause); }
    }
  }
  function pauseResume() {
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused; setPaused(nextPaused);
    setStatus(nextPaused ? "Paused." : buffering.current ? "Preparing speech…" : "Reading…");
    if (engine === "kokoro") {
      const ctx = context.current;
      const run = session.current;
      if (ctx) void (nextPaused ? ctx.suspend() : ctx.resume()).catch(cause => fail(run, cause));
    } else if (nextPaused) synth?.pause();
    else {
      const resume = resumeSpeech.current;
      resumeSpeech.current = undefined;
      if (resume) resume(); else synth?.resume();
    }
  }
  async function loadPassage() {
    stop(); setText(""); setError(""); setLoading(true); current.current = null;
    const request = ++loadRequest.current;
    try {
      const passage = await getCurrentPassage.current();
      if (request !== loadRequest.current) return;
      current.current = passage; setText(passage?.text || "");
      if (!passage) setStatus("No readable text here. Move to a paragraph and try again.");
    } catch {
      if (request === loadRequest.current) setError("Could not read this EPUB position. Try another paragraph.");
    } finally { if (request === loadRequest.current) setLoading(false); }
  }
  useEffect(() => {
    void loadPassage();
    const update = () => setVoices(synth?.getVoices() || []);
    update(); synth?.addEventListener("voiceschanged", update);
    const hide = () => { stop(); setStatus("Playback stopped while the app was hidden. Tap Play to continue from this passage."); };
    const visibility = () => { if (document.hidden) hide(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    return () => {
      // Invalidate pending extraction; this is a request counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++loadRequest.current;
      stop(true);
      synth?.removeEventListener("voiceschanged", update);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
    };
    // Playback and extraction use refs so a render never restarts a listening session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const systemOptions = [{ value: "", label: "Browser default" }, ...voices.map(item => ({ value: item.voiceURI, label: item.name + " · " + item.lang }))];
  return <section className="reader-tts">
    <h2>Read aloud</h2>
    <label id="tts-engine-label">Engine</label>
    <ReaderSelect id="tts-engine" labelId="tts-engine-label" value={engine} options={[{ value: "system", label: "System Voices" }, { value: "kokoro", label: "Kokoro · Local AI" }]} onChange={value => {
      stop(); setError(""); setEngine(value);
      if (value === "kokoro") { try { ensureWorker(); } catch { setError("Kokoro is unavailable in this browser."); } }
    }} />
    <label id="tts-voice-label">Voice</label>
    <ReaderSelect id="tts-voice" labelId="tts-voice-label" value={engine === "system" ? voice : kokoroVoice} options={engine === "system" ? systemOptions : kokoroVoices} onChange={value => { stop(); setError(""); if (engine === "system") setVoice(value); else setKokoroVoice(value); }} />
    {engine === "system" && !voices.length && <p>Waiting for system voices. The browser default may still work.</p>}
    <label id="tts-speed-label">Speed</label>
    <ReaderSelect id="tts-speed" labelId="tts-speed-label" value={speed} options={["0.75", "1", "1.25", "1.5", "2"].map(value => ({ value, label: value + "×" }))} onChange={value => {
      if (engine === "system") stop();
      speedRef.current = Number(value); setSpeed(value);
      if (source.current) source.current.playbackRate.value = Number(value);
    }} />
    <p className="reader-tts-passage" dir="auto">{loading ? "Reading current EPUB position…" : text}</p>
    <div className="reader-tts-actions">
      <button className="reader-button" disabled={!text || loading || active} onClick={play}>Play</button>
      <button className="reader-button" disabled={!active} onClick={pauseResume}>{paused ? "Resume" : "Pause"}</button>
      <button className="reader-button" disabled={!active} onClick={() => stop()}>Stop</button>
      <button className="reader-button" disabled={loading} onClick={() => void loadPassage()}>Use current position</button>
    </div>
    <p role="status" aria-live="polite">{status}</p>
    {error && <p role="alert">{error}</p>}
    <p>Reads continuously from this position through the book. {engine === "kokoro"
      ? "Speech is prepared automatically as you listen. First use downloads a large voice model; slower devices may pause between passages. These are all English voices supported by this Kokoro package."
      : "Voice availability and Pause/Resume depend on your browser."} Keep the screen active. Background and locked-screen playback are not supported yet.</p>
  </section>;
}
