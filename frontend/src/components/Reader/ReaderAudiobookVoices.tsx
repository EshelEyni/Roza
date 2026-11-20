import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { FiCheck, FiPlay, FiSearch, FiSquare, FiX } from "react-icons/fi";
import { ReaderOpenAiAudio, type AudiobookConfig, type AudiobookEngine } from "../../services/readerOpenAiAudio";
import { desktopKokoro, type KokoroStatus } from "../../services/narration/desktopKokoro";
import { defaultKokoroVoice, kokoroLang, kokoroVoices } from "../../services/narration/kokoroVoices";
import type { KokoroAvailability } from "../../hooks/reader/useReaderAudiobook";
import { KokoroInstall } from "./Audiobook/KokoroInstall";

const ALL = "All";

function languageName(language: string) {
  try {
    const names = (Intl as typeof Intl & { DisplayNames?: new (locales: string[], options: { type: "language" }) => { of: (value: string) => string | undefined } }).DisplayNames;
    return names ? new names(["en"], { type: "language" }).of(language.replace("_", "-").split("-")[0]) || language : language;
  } catch { return language; }
}
function preferred(voices: SpeechSynthesisVoice[], selected: string) {
  return voices.find(voice => voice.voiceURI === selected)
    || voices.find(voice => /^en(?:[-_]|$)/i.test(voice.lang) && voice.default)
    || voices.find(voice => /^en(?:[-_]|$)/i.test(voice.lang))
    || voices[0];
}

export function ReaderAudiobookVoices({ voices, selected, engine = "system", aiVoice = "", localVoice = defaultKokoroVoice, kokoroStatus = null, kokoroAvailability = "website", onKokoroChanged, config, configStatus, bookId, warning, beforePreview, onApplyGesture, onClose }: {
  voices: SpeechSynthesisVoice[]; selected: string; engine?: AudiobookEngine; aiVoice?: string;
  localVoice?: string; kokoroStatus?: KokoroStatus | null; kokoroAvailability?: KokoroAvailability; onKokoroChanged?: () => void;
  config?: AudiobookConfig; configStatus?: string;
  bookId?: string; warning?: string; beforePreview?: () => Promise<unknown>;
  onApplyGesture?: (engine: AudiobookEngine) => void;
  onClose: (selected?: string, engine?: AudiobookEngine) => void | boolean | Promise<void | boolean>;
}) {
  const [stagedEngine, setStagedEngine] = useState(engine);
  const [staged, setStaged] = useState(() => engine === "openai" ? aiVoice : engine === "kokoro" ? localVoice : preferred(voices, selected)?.voiceURI || (warning ? "browser-default" : ""));
  const [gender, setGender] = useState(ALL);
  const [accent, setAccent] = useState(ALL);
  const localPreview = useRef<HTMLAudioElement>();
  const kokoroReady = kokoroAvailability === "ready";
  const [englishOnly, setEnglishOnly] = useState(() => {
    const voice = voices.find(item => item.voiceURI === selected);
    return !voice || /^en(?:[-_]|$)/i.test(voice.lang);
  });
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [previewStatus, setPreviewStatus] = useState("");
  const aiPreview = useRef<ReaderOpenAiAudio>();
  const previewVersion = useRef(0);
  const sample = config?.previewText || "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.";
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }));
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const preview = useRef<SpeechSynthesisUtterance>();
  const titleId = useId(), descriptionId = useId(), radioName = useId();
  const synth = window.speechSynthesis;

  function stopPreview() {
    ++previewVersion.current; aiPreview.current?.stop(); setPreviewStatus("");
    if (localPreview.current) { localPreview.current.onended = null; localPreview.current.pause(); }
    const previous = preview.current;
    preview.current = undefined;
    if (previous) {
      previous.onend = null; previous.onerror = null;
      synth?.cancel();
    }
    setPreviewing("");
  }
  async function dismiss(value?: string) {
    if (busy.current) return;
    if (value !== undefined) onApplyGesture?.(stagedEngine);
    stopPreview(); busy.current = true; setSaving(true);
    try {
      await aiPreview.current?.waitForCancellation();
      const result = await onClose(value, stagedEngine);
      if (result !== false) dialog.current?.close();
    } finally { busy.current = false; if (dialog.current?.isConnected) setSaving(false); }
  }
  function playPreview(voice: SpeechSynthesisVoice) {
    const alreadyPlaying = preview.current?.voice?.voiceURI === voice.voiceURI;
    stopPreview(); setError("");
    if (alreadyPlaying) return;
    try {
      if (!synth) throw new Error("System speech is unavailable in this browser.");
      const utterance = new SpeechSynthesisUtterance(sample);
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 1;
      utterance.onend = () => { if (preview.current === utterance) stopPreview(); };
      utterance.onerror = event => {
        if (preview.current !== utterance) return;
        stopPreview(); setError("Voice preview: " + event.error + ". Try another voice.");
      };
      preview.current = utterance; setPreviewing(voice.voiceURI);
      setPreviewStatus("Playing voice preview");
      synth.resume(); synth.speak(utterance);
    } catch (cause) { stopPreview(); setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  function playAiPreview(voice: string) {
    const already = previewing === voice;
    stopPreview(); setError("");
    if (already || !bookId) return;
    const run = previewVersion.current;
    const player = aiPreview.current ??= new ReaderOpenAiAudio(bookId, () => {
      stopPreview(); setError("Voice preview was interrupted. Tap Play to retry.");
    });
    try {
      const ready = player.unlock();
      setPreviewing(voice); setPreviewStatus("Preparing AI-generated voice preview…");
      void ready.then(async () => {
        await beforePreview?.();
        if (run !== previewVersion.current) return;
        await player.play({ text: sample, cfi: "voice-preview", preview: true }, voice, 1,
          () => { if (run === previewVersion.current) setPreviewStatus("Playing AI-generated voice preview"); },
          () => { if (run === previewVersion.current) stopPreview(); });
      }).catch(cause => {
        if (run !== previewVersion.current) return;
        stopPreview(); setError(cause instanceof Error ? cause.message : String(cause));
      });
    } catch (cause) { stopPreview(); setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  function playKokoroPreview(voice: string) {
    const already = previewing === voice;
    stopPreview(); setError("");
    const api = desktopKokoro();
    if (already || !api) return;
    const run = previewVersion.current;
    setPreviewing(voice); setPreviewStatus("Preparing local voice preview… the first one takes a few seconds");
    void (async () => {
      await beforePreview?.();
      const { url } = await api.preview(voice);
      if (run !== previewVersion.current) return;
      const element = localPreview.current ??= new Audio();
      element.src = url;
      element.onended = () => { if (run === previewVersion.current) stopPreview(); };
      await element.play();
      if (run === previewVersion.current) setPreviewStatus("Playing local voice preview");
    })().catch(cause => {
      if (run !== previewVersion.current) return;
      stopPreview(); setError(cause instanceof Error ? cause.message : String(cause));
    });
  }
  useEffect(() => {
    const element = dialog.current!;
    element.showModal(); close.current?.focus({ preventScroll: true });
    const updateViewport = () => setViewport({ height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 });
    const hide = () => stopPreview();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("pagehide", hide);
    return () => {
      stopPreview(); element.close();
      aiPreview.current?.dispose();
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("pagehide", hide);
    };
    // Preview ownership is held in a ref; never restart it on a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (stagedEngine !== "system") return;
    setStaged(current => voices.some(voice => voice.voiceURI === current) ? current : preferred(voices, selected)?.voiceURI || (warning ? "browser-default" : ""));
    if (preview.current && !voices.some(voice => voice.voiceURI === preview.current?.voice?.voiceURI)) stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices, selected, stagedEngine, warning]);

  const search = query.trim().toLocaleLowerCase();
  const localChoices = kokoroVoices.filter(voice => (gender === ALL || voice.gender === gender) && (accent === ALL || voice.nationality === accent));
  const choices = stagedEngine === "system" ? (voices.length || !warning || !synth ? voices : [{voiceURI:"browser-default",name:"Browser default",lang:"en",localService:false}])
    : stagedEngine === "kokoro" ? (kokoroReady ? localChoices.map(voice => ({ voiceURI: voice.id, name: voice.name, lang: kokoroLang(voice), localService: true, detail: voice.nationality + " · " + voice.gender })) : [])
      : (config?.voices || []).map(name => ({ voiceURI: name, name, lang: "en", localService: false }));
  const visible = choices.filter(voice => (stagedEngine !== "system" || !englishOnly || /^en(?:[-_]|$)/i.test(voice.lang))
    && (!search || (voice.name + " " + voice.lang + " " + languageName(voice.lang)).toLocaleLowerCase().includes(search)));
  const localStatus = kokoroAvailability === "website" ? "Desktop app only · runs on your computer"
    : kokoroAvailability === "not-english" ? "English books only"
      : kokoroAvailability === "checking" ? "Checking this computer…"
        : kokoroAvailability === "not-installed" ? "Free and private · install once (about 1.6 GB)"
          : "Free and private · runs on this computer, works offline";
  const stagedVoice = choices.find(voice => voice.voiceURI === staged);
  // Once local voices are installed, their "remove" link sits in the footer, out of the way of the voice grid.
  const kokoroInstalled = !!kokoroStatus?.installed && !kokoroStatus.installing;
  return <dialog className="audiobook-voice-modal" ref={dialog} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    style={{ "--audiobook-voice-height": viewport.height + "px", "--audiobook-voice-top": viewport.top + "px" } as CSSProperties}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') || []).filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (first && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <section className="audiobook-voice-dialog is-wide">
      <header className="audiobook-voice-dialog-header">
        <div><div className="audiobook-voice-eyebrow">AUDIOBOOK SETTINGS</div><h2 id={titleId}>Choose a narrator</h2><p id={descriptionId}>Find the voice that feels right for your book.</p></div>
        <button ref={close} type="button" className="audiobook-voice-dialog-close" disabled={saving} aria-label="Close voice picker" onClick={() => void dismiss()}><FiX /></button>
      </header>
      <div className="audiobook-voice-dialog-scroll">
        {warning && <p className="audiobook-error" role="alert">{warning}</p>}
        <div className="audiobook-voice-section-heading">VOICE ENGINE <span className="audiobook-voice-count">{Number(!!synth) + Number(!!config?.available) + Number(kokoroReady)} available</span></div>
        <div className="audiobook-voice-engines">
        <button type="button" className="audiobook-voice-engine" disabled={saving} aria-pressed={stagedEngine === "system"} onClick={() => { stopPreview(); setStagedEngine("system"); setStaged(preferred(voices, selected)?.voiceURI || (warning ? "browser-default" : "")); }}>
          <span className="audiobook-voice-engine-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></svg></span>
          <span className="audiobook-voice-engine-copy"><strong>System voices</strong><small>Voices available on this device</small></span>
          {stagedEngine === "system" && <span className="audiobook-voice-engine-check" aria-hidden="true"><FiCheck /></span>}
        </button>
        <button type="button" className="audiobook-voice-engine" aria-pressed={stagedEngine === "openai"} disabled={saving || !config?.available} onClick={() => { stopPreview(); setStagedEngine("openai"); setStaged(aiVoice || config?.defaultVoice || ""); }}>
          <span className="audiobook-voice-engine-copy"><strong>OpenAI voices</strong><small>{configStatus || "OpenAI narration is unavailable"}</small></span>
          {stagedEngine === "openai" && <span className="audiobook-voice-engine-check" aria-hidden="true"><FiCheck /></span>}
        </button>
        <button type="button" className="audiobook-voice-engine" aria-pressed={stagedEngine === "kokoro"} disabled={saving || (kokoroAvailability !== "ready" && kokoroAvailability !== "not-installed")}
          onClick={() => { stopPreview(); setStagedEngine("kokoro"); setStaged(localVoice || defaultKokoroVoice); }}>
          <span className="audiobook-voice-engine-copy"><strong>Local voices</strong><small>{localStatus}</small></span>
          {stagedEngine === "kokoro" && <span className="audiobook-voice-engine-check" aria-hidden="true"><FiCheck /></span>}
        </button>
        </div>
        {stagedEngine === "kokoro" && !kokoroInstalled && <KokoroInstall status={kokoroStatus} availability={kokoroAvailability} onChanged={() => onKokoroChanged?.()} />}
        {stagedEngine === "openai" && <p className="audiobook-voice-help">These voices are generated by AI. Playback and previews use your server’s OpenAI account and may incur API charges. Tap a voice’s play icon to compare the same sample.</p>}
        <div className="audiobook-voices-heading"><div className="audiobook-voice-section-heading">NARRATOR VOICE</div><span className="audiobook-voice-count" role="status">{visible.length} {visible.length === 1 ? "voice" : "voices"}</span></div>
        <div className="audiobook-voice-tools">
          <label className="audiobook-voice-search"><FiSearch aria-hidden="true" /><input type="search" autoComplete="off" placeholder="Search voices or languages" aria-label="Search voices" value={query} onChange={event => setQuery(event.target.value)} /></label>
          {stagedEngine === "system" && <button type="button" className={"audiobook-voice-filter" + (englishOnly ? " is-active" : "")} aria-pressed={englishOnly} onClick={() => setEnglishOnly(!englishOnly)}>English only</button>}
          {stagedEngine === "kokoro" && kokoroReady && ([{ label: "Gender", options: [ALL, "Female", "Male"], value: gender, set: setGender }, { label: "Accent", options: [ALL, "American", "British"], value: accent, set: setAccent }].map(filter =>
            <div key={filter.label} className="audiobook-voice-chip-group" role="radiogroup" aria-label={filter.label}>
              <span>{filter.label}</span>
              {filter.options.map(option => <button key={option} type="button" role="radio" aria-checked={option === filter.value}
                className={"audiobook-voice-filter" + (option === filter.value ? " is-active" : "")} onClick={() => filter.set(option)}>{option}</button>)}
            </div>))}
        </div>
        <div className="audiobook-voice-options" role="radiogroup" aria-label={stagedEngine === "system" ? "Available system voices" : stagedEngine === "kokoro" ? "Available local voices" : "Available OpenAI voices"}>
          {!visible.length && <div className="audiobook-voice-empty">{stagedEngine === "kokoro" ? (kokoroReady ? "No local voices match these filters." : "Local voices appear here once they are installed.") : voices.length ? "No matching voices. Try a different search or turn off English only." : "No system voices detected yet. Voices may still be loading; browser-default narration remains available."}</div>}
          {visible.map(voice => <div key={voice.voiceURI} className={"audiobook-voice-card" + (voice.voiceURI === staged ? " is-selected" : "")}>
            <label className="audiobook-voice-choice">
              <input type="radio" disabled={saving} name={radioName} value={voice.voiceURI} checked={voice.voiceURI === staged} onChange={() => setStaged(voice.voiceURI)} />
              <span className="audiobook-voice-detail"><strong>{voice.name}</strong><small>{stagedEngine === "openai" ? "Multilingual · AI-generated" : "detail" in voice ? String(voice.detail) : languageName(voice.lang) + " · " + voice.lang + (voice.localService ? " · On device" : "")}</small></span>
            </label>
            <button type="button" disabled={saving || voice.voiceURI === "browser-default" || (stagedEngine === "openai" && (!bookId || !config?.available))} className={"audiobook-voice-preview" + (previewing === voice.voiceURI ? " is-previewing" : "")} title={(previewing === voice.voiceURI ? "Stop preview of " : "Preview ") + voice.name}
              aria-label={(previewing === voice.voiceURI ? "Stop preview of " : "Preview ") + voice.name} onClick={() => { if (stagedEngine === "openai") playAiPreview(voice.voiceURI); else if (stagedEngine === "kokoro") playKokoroPreview(voice.voiceURI); else { const systemVoice = voices.find(item => item.voiceURI === voice.voiceURI); if (systemVoice) playPreview(systemVoice); } }}>{previewing === voice.voiceURI ? <FiSquare fill="currentColor" /> : <FiPlay fill="currentColor" />}</button>
          </div>)}
        </div>
        <p className="audiobook-voice-help">{stagedEngine === "system" ? "Voices come from your browser and device. " : ""}Preview text: “{sample}”</p>
        <div className="audiobook-voice-preview-status" role="status" aria-live="polite">{previewStatus}</div>
        {error && <p className="audiobook-error" role="alert">{error}</p>}
      </div>
      <footer className="audiobook-voice-dialog-footer">
        {stagedEngine === "kokoro" && kokoroInstalled && <div className="audiobook-voice-footer-start"><KokoroInstall status={kokoroStatus} availability={kokoroAvailability} onChanged={() => onKokoroChanged?.()} /></div>}
        <button type="button" className="audiobook-voice-cancel" disabled={saving} onClick={() => void dismiss()}>{warning ? "Exit audiobook mode" : "Cancel"}</button>
        <button type="button" className="audiobook-voice-apply" disabled={saving || !stagedVoice || (stagedEngine === "openai" && !config?.available) || (stagedEngine === "kokoro" && !kokoroReady)} onClick={() => { if (stagedVoice) void dismiss(stagedVoice.voiceURI); }}>{saving ? "Saving…" : "Save"} <FiCheck aria-hidden="true" /></button>
      </footer>
    </section>
  </dialog>;
}
