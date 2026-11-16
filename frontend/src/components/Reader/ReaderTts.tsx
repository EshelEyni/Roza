import { useEffect, useRef, useState } from "react";
import { ReaderSelect } from "./ReaderSelect";
import { kokoroVoices } from "../../services/readerTts";

export function ReaderTts({ getPassage }: { getPassage: () => Promise<string> }) {
  const [engine, setEngine] = useState("system");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [kokoroVoice, setKokoroVoice] = useState("af_heart");
  const [speed, setSpeed] = useState("1");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const worker = useRef<Worker>();
  const audio = useRef<HTMLAudioElement>();
  const url = useRef("");
  const utterance = useRef<SpeechSynthesisUtterance>();
  const passageRequest = useRef(0);
  const playbackRequest = useRef(0);
  const synth = window.speechSynthesis;

  function stop() {
    ++playbackRequest.current;
    // Remove listeners before cancel: late cancellation events must not overwrite new playback.
    if (utterance.current) {
      utterance.current.onend = null; utterance.current.onerror = null;
      utterance.current.onpause = null; utterance.current.onresume = null;
      synth?.cancel(); utterance.current = undefined;
    }
    if (audio.current) { audio.current.pause(); audio.current.currentTime = 0; }
    setPlaying(false); setPaused(false);
    if (worker.current && !audio.current) { worker.current.terminate(); worker.current = undefined; }
    setBusy(false); setStatus("");
  }
  function discard() {
    stop();
    worker.current?.terminate(); worker.current = undefined;
    if (audio.current) {
      audio.current.onended = null; audio.current.onpause = null;
      audio.current.onplaying = null; audio.current.onerror = null;
      audio.current.src = ""; audio.current = undefined;
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = ""; setReady(false); setError("");
  }
  async function loadPassage() {
    discard(); setText(""); setLoading(true);
    const request = ++passageRequest.current;
    try {
      const passage = await getPassage();
      if (request !== passageRequest.current) return;
      setText(passage);
      if (!passage) setError("No readable text here. Move to a paragraph and try again.");
    } catch {
      if (request === passageRequest.current) setError("Could not read this EPUB position. Move to a paragraph and try again.");
    } finally { if (request === passageRequest.current) setLoading(false); }
  }
  useEffect(() => {
    void loadPassage();
    const update = () => setVoices(synth?.getVoices() || []);
    update(); synth?.addEventListener("voiceschanged", update);
    const interrupt = () => {
      if (document.hidden) { stop(); setStatus("Playback stopped while the app was hidden. Tap Play to restart."); }
    };
    const hide = () => stop();
    document.addEventListener("visibilitychange", interrupt);
    window.addEventListener("pagehide", hide);
    return () => {
      // This ref is a request counter, not a DOM ref. Invalidate pending extraction.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++passageRequest.current;
      discard();
      synth?.removeEventListener("voiceschanged", update);
      document.removeEventListener("visibilitychange", interrupt);
      window.removeEventListener("pagehide", hide);
    };
    // A passage stays fixed while comparing engines. Refresh is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playSystem() {
    stop(); setError("");
    if (!synth) { setError("System speech is unavailable in this browser."); return; }
    try {
      const next = new SpeechSynthesisUtterance(text);
      next.voice = voices.find(item => item.voiceURI === voice) || null;
      if (next.voice) next.lang = next.voice.lang;
      next.rate = Number(speed);
      next.onend = () => { setPlaying(false); setPaused(false); setStatus("Finished."); utterance.current = undefined; };
      next.onerror = event => { setPlaying(false); setPaused(false); setError(`System speech: ${event.error}. Tap Play to retry.`); utterance.current = undefined; };
      next.onpause = () => setPaused(true);
      next.onresume = () => setPaused(false);
      utterance.current = next;
      synth.speak(next); setPlaying(true);
    } catch { setError("System speech could not start. Try another voice."); }
  }
  function generate() {
    discard(); setBusy(true); setStatus("Loading Kokoro… First use downloads a large model.");
    try {
      const next = new Worker(new URL("../../services/readerKokoro.worker.ts", import.meta.url), { type: "module" });
      worker.current = next;
      const fail = (message: string) => {
        next.terminate(); worker.current = undefined; setBusy(false); setStatus("");
        setError(`Kokoro could not run: ${message}. Try desktop Chrome or use System Voices on this device.`);
      };
      next.onerror = event => { event.preventDefault(); fail(event.message || "Worker failed"); };
      next.onmessage = (event: MessageEvent<{ status?: string; error?: string; blob?: Blob }>) => {
        if (worker.current !== next) return;
        if (event.data.error) { fail(event.data.error); return; }
        if (event.data.status) setStatus(event.data.status);
        if (event.data.blob) {
          url.current = URL.createObjectURL(event.data.blob);
          const player = new Audio(url.current);
          audio.current = player;
          player.onended = () => { setPlaying(false); setPaused(false); setStatus("Finished."); };
          player.onpause = () => setPaused(true);
          player.onplaying = () => { setPlaying(true); setPaused(false); };
          player.onerror = () => { setPlaying(false); setError("Generated audio could not play. Generate again or try another browser."); };
          setReady(true); setBusy(false); setStatus("Audio ready. Tap Play.");
        }
      };
      next.postMessage({ text, voice: kokoroVoice });
    } catch (cause) { setBusy(false); setStatus(""); setError(`Kokoro unavailable: ${String(cause)}`); }
  }
  async function playAudio() {
    const player = audio.current;
    if (!player) return;
    const request = ++playbackRequest.current;
    setError(""); player.playbackRate = Number(speed);
    try {
      await player.play();
      if (request === playbackRequest.current) { setPlaying(true); setPaused(false); }
    } catch {
      if (request === playbackRequest.current) { setPlaying(false); setError("Playback was blocked or interrupted. Tap Play again."); }
    }
  }
  function pauseResume() {
    if (engine === "kokoro") {
      if (paused) void playAudio(); else { audio.current?.pause(); setPaused(true); }
    } else if (paused) { synth?.resume(); setPaused(false); }
    else { synth?.pause(); setPaused(true); }
  }
  const systemOptions = [{ value: "", label: "Browser default" }, ...voices.map(item => ({ value: item.voiceURI, label: `${item.name} · ${item.lang}` }))];
  return <section className="reader-tts">
    <h2>Read aloud · Experiment</h2>
    <label id="tts-engine-label">Engine</label>
    <ReaderSelect id="tts-engine" labelId="tts-engine-label" value={engine} options={[{ value: "system", label: "System Voices" }, { value: "kokoro", label: "Kokoro · Local AI" }]} onChange={value => { discard(); setEngine(value); }} />
    <label id="tts-voice-label">Voice</label>
    <ReaderSelect id="tts-voice" labelId="tts-voice-label" value={engine === "system" ? voice : kokoroVoice} options={engine === "system" ? systemOptions : kokoroVoices} onChange={value => { discard(); if (engine === "system") setVoice(value); else setKokoroVoice(value); }} />
    {engine === "system" && !voices.length && <p>Waiting for system voices. The browser default may still work.</p>}
    <label id="tts-speed-label">Speed</label>
    <ReaderSelect id="tts-speed" labelId="tts-speed-label" value={speed} options={["0.75", "1", "1.25", "1.5", "2"].map(value => ({ value, label: value + "×" }))} onChange={value => { if (engine === "system") stop(); if (audio.current) audio.current.playbackRate = Number(value); setSpeed(value); }} />
    <p className="reader-tts-passage" dir="auto">{loading ? "Reading current EPUB position…" : text}</p>
    <div className="reader-tts-actions">
      {engine === "kokoro" && <button className="reader-button" disabled={!text || busy || loading} onClick={generate}>{ready ? "Generate again" : "Generate"}</button>}
      <button className="reader-button" disabled={!text || loading || busy || (engine === "kokoro" && !ready) || playing} onClick={() => engine === "system" ? playSystem() : void playAudio()}>Play</button>
      <button className="reader-button" disabled={!playing} onClick={pauseResume}>{paused ? "Resume" : "Pause"}</button>
      <button className="reader-button" disabled={!playing && !busy} onClick={stop}>Stop</button>
      <button className="reader-button" disabled={loading} onClick={() => void loadPassage()}>Use current position</button>
    </div>
    <p role="status" aria-live="polite">{status}</p>
    {error && <p role="alert">{error}</p>}
    <p>{engine === "kokoro" ? "English voices. Local WASM inference; first use requires internet for model files. iPhone may be slow or run out of memory. System Voices is the mobile fallback." : "Voice availability and Pause/Resume depend on your browser. If interrupted, Stop and Play again."} Keep the screen active; background and locked-screen playback are not supported in this experiment.</p>
  </section>;
}
