import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { FiCheck, FiPlay, FiSearch, FiSquare, FiX } from "react-icons/fi";

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

export function ReaderAudiobookVoices({ voices, selected, onClose }: {
  voices: SpeechSynthesisVoice[]; selected: string; onClose: (selected?: string) => void;
}) {
  const [staged, setStaged] = useState(() => preferred(voices, selected)?.voiceURI || "");
  const [englishOnly, setEnglishOnly] = useState(() => {
    const voice = voices.find(item => item.voiceURI === selected);
    return !voice || /^en(?:[-_]|$)/i.test(voice.lang);
  });
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState("");
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 }));
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const preview = useRef<SpeechSynthesisUtterance>();
  const titleId = useId(), descriptionId = useId(), radioName = useId();
  const synth = window.speechSynthesis;

  function stopPreview() {
    const previous = preview.current;
    preview.current = undefined;
    if (previous) {
      previous.onend = null; previous.onerror = null;
      synth?.cancel();
    }
    setPreviewing("");
  }
  function dismiss(value?: string) {
    stopPreview(); dialog.current?.close(); onClose(value);
  }
  function playPreview(voice: SpeechSynthesisVoice) {
    const alreadyPlaying = preview.current?.voice?.voiceURI === voice.voiceURI;
    stopPreview(); setError("");
    if (alreadyPlaying) return;
    try {
      if (!synth) throw new Error("System speech is unavailable in this browser.");
      const utterance = new SpeechSynthesisUtterance("The morning arrived quietly, and the world seemed full of possibility.");
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 1;
      utterance.onend = () => { if (preview.current === utterance) stopPreview(); };
      utterance.onerror = event => {
        if (preview.current !== utterance) return;
        stopPreview(); setError("Voice preview: " + event.error + ". Try another voice.");
      };
      preview.current = utterance; setPreviewing(voice.voiceURI);
      synth.resume(); synth.speak(utterance);
    } catch (cause) { stopPreview(); setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  useEffect(() => {
    const element = dialog.current!;
    element.showModal(); close.current?.focus({ preventScroll: true });
    const updateViewport = () => setViewport({ height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0 });
    const hide = () => stopPreview();
    const visibility = () => { if (document.hidden) hide(); };
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopPreview(); element.close();
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
    // Preview ownership is held in a ref; never restart it on a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setStaged(current => voices.some(voice => voice.voiceURI === current) ? current : preferred(voices, selected)?.voiceURI || "");
    if (preview.current && !voices.some(voice => voice.voiceURI === preview.current?.voice?.voiceURI)) stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices, selected]);

  const search = query.trim().toLocaleLowerCase();
  const visible = voices.filter(voice => (!englishOnly || /^en(?:[-_]|$)/i.test(voice.lang))
    && (!search || (voice.name + " " + voice.lang + " " + languageName(voice.lang)).toLocaleLowerCase().includes(search)));
  const stagedVoice = voices.find(voice => voice.voiceURI === staged);
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
    <section className="audiobook-voice-dialog">
      <header className="audiobook-voice-dialog-header">
        <div><div className="audiobook-voice-eyebrow">AUDIOBOOK SETTINGS</div><h2 id={titleId}>Choose a narrator</h2><p id={descriptionId}>Find the voice that feels right for your book.</p></div>
        <button ref={close} type="button" className="audiobook-voice-dialog-close" aria-label="Close voice picker" onClick={() => dismiss()}><FiX /></button>
      </header>
      <div className="audiobook-voice-dialog-scroll">
        <div className="audiobook-voice-section-heading">VOICE ENGINE <span className="audiobook-voice-count">{synth ? "1 available" : "Unavailable"}</span></div>
        <div className="audiobook-voice-engine">
          <span className="audiobook-voice-engine-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></svg></span>
          <span className="audiobook-voice-engine-copy"><strong>System voices</strong><small>Voices available on this device</small></span>
          <span className="audiobook-voice-engine-check" aria-hidden="true"><FiCheck /></span>
        </div>
        <div className="audiobook-voices-heading"><div className="audiobook-voice-section-heading">NARRATOR VOICE</div><span className="audiobook-voice-count" role="status">{visible.length} {visible.length === 1 ? "voice" : "voices"}</span></div>
        <div className="audiobook-voice-tools">
          <label className="audiobook-voice-search"><FiSearch aria-hidden="true" /><input type="search" autoComplete="off" placeholder="Search voices or languages" aria-label="Search voices" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <button type="button" className={"audiobook-voice-filter" + (englishOnly ? " is-active" : "")} aria-pressed={englishOnly} onClick={() => setEnglishOnly(!englishOnly)}>English only</button>
        </div>
        <div className="audiobook-voice-options" role="radiogroup" aria-label="Available system voices">
          {!visible.length && <div className="audiobook-voice-empty">{voices.length ? "No matching voices. Try a different search or turn off English only." : "No system voices detected yet. Voices may still be loading; browser-default narration remains available."}</div>}
          {visible.map(voice => <div key={voice.voiceURI} className={"audiobook-voice-card" + (voice.voiceURI === staged ? " is-selected" : "")}>
            <label className="audiobook-voice-choice">
              <input type="radio" name={radioName} value={voice.voiceURI} checked={voice.voiceURI === staged} onChange={() => setStaged(voice.voiceURI)} />
              <span className="audiobook-voice-detail"><strong>{voice.name}</strong><small>{languageName(voice.lang)} · {voice.lang}{voice.localService ? " · On device" : ""}</small></span>
            </label>
            <button type="button" className={"audiobook-voice-preview" + (previewing === voice.voiceURI ? " is-previewing" : "")} title={(previewing === voice.voiceURI ? "Stop preview of " : "Preview ") + voice.name}
              aria-label={(previewing === voice.voiceURI ? "Stop preview of " : "Preview ") + voice.name} onClick={() => playPreview(voice)}>{previewing === voice.voiceURI ? <FiSquare fill="currentColor" /> : <FiPlay fill="currentColor" />}</button>
          </div>)}
        </div>
        <p className="audiobook-voice-help">Voices come from your browser and device. Tap the play icon to hear a real preview.</p>
        <div className="audiobook-voice-preview-status" role="status" aria-live="polite">{previewing ? "Playing voice preview" : ""}</div>
        {error && <p className="audiobook-error" role="alert">{error}</p>}
      </div>
      <footer className="audiobook-voice-dialog-footer">
        <button type="button" className="audiobook-voice-cancel" onClick={() => dismiss()}>Cancel</button>
        <button type="button" className="audiobook-voice-apply" disabled={!stagedVoice} onClick={() => { if (stagedVoice) dismiss(stagedVoice.voiceURI); }}>Use this voice <FiCheck aria-hidden="true" /></button>
      </footer>
    </section>
  </dialog>;
}
