import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { FiPause, FiPlay, FiSkipBack, FiSkipForward, FiX } from "react-icons/fi";
import { ReaderSelect } from "./ReaderSelect";
import { ScanLineIcon } from "./ReaderSentenceMode";
import { useReaderAudiobook, type AudiobookLoader } from "../../hooks/reader/useReaderAudiobook";
import { audiobookTime, type AudiobookSentence } from "../../services/readerTts";

export function ReaderTts({ bookTitle, loadSection, onClose }: {
  bookTitle: string; loadSection: AudiobookLoader; onClose: (cfi?: string) => void;
}) {
  const audio = useReaderAudiobook(loadSection);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [speedDraft, setSpeedDraft] = useState(audio.speed);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const draggingSeek = useRef(false);
  const draggingSpeed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const reading = useRef<HTMLElement>(null);
  const speedAnchor = useRef<HTMLDivElement>(null);
  const speedButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const exit = () => onClose(audio.cfi);
  const paragraphs = useMemo(() => {
    const groups: { paragraph: number; items: { index: number; sentence: AudiobookSentence }[] }[] = [];
    audio.section?.sentences.forEach((sentence, index) => {
      let group = groups[groups.length - 1];
      if (!group || group.paragraph !== sentence.paragraph) { group = { paragraph: sentence.paragraph, items: [] }; groups.push(group); }
      group.items.push({ index, sentence });
    });
    return groups;
  }, [audio.section]);

  useEffect(() => {
    const mode = root.current;
    const shell = mode?.closest(".reader-shell");
    const trigger = shell?.querySelector<HTMLElement>('.reader-toolbar [aria-label="Reader menu"]');
    const inert: { element: HTMLElement; previous: boolean }[] = [];
    let branch: Element | null = mode;
    while (branch && branch !== shell && branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) { inert.push({ element: sibling, previous: sibling.inert }); sibling.inert = true; }
      }
      branch = branch.parentElement;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      for (const item of inert) item.element.inert = item.previous;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const container = reading.current;
    const target = container?.querySelector<HTMLElement>(".audiobook-word.is-active, .audiobook-sentence.is-active");
    // Prefer the actual boundary word when one is available.
    const word = container?.querySelector<HTMLElement>(".audiobook-word.is-active") || target;
    if (!container || !word) return;
    const rect = word.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    if (rect.top < viewport.top + 70 || rect.bottom > viewport.top + viewport.height * 0.72) {
      container.scrollTo({
        top: Math.max(0, container.scrollTop + rect.top - viewport.top - viewport.height * 0.33),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  }, [audio.index, audio.highlight, audio.section]);
  useEffect(() => {
    if (!speedOpen) return;
    const outside = (event: PointerEvent) => {
      if (!speedAnchor.current?.contains(event.target as Node)) setSpeedOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [speedOpen]);

  const total = audio.section?.totalWords || 0;
  const progress = seekDraft ?? audio.currentWord;
  // Web Speech exposes no exact duration: these are explicitly text-based estimates.
  const secondsPerWord = 60 / (180 * audio.speed);
  const options = [{ value: "", label: "System voice" }, ...audio.voices.map(voice => ({ value: voice.voiceURI, label: voice.name + " · " + voice.lang }))];
  return <div className="reader-audiobook" ref={root} role="dialog" aria-modal="true" aria-label="Audiobook Mode" tabIndex={-1}
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        if (speedOpen) { setSpeedOpen(false); speedButton.current?.focus(); }
        else exit();
        event.preventDefault(); event.stopPropagation(); return;
      }
      if (event.key === "Tab") {
        const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || []).filter(element => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (first && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
        return;
      }
      if ((event.target as Element).closest('button,input,[role="combobox"],[role="listbox"]')) return;
      if (event.code === "Space") { event.preventDefault(); event.stopPropagation(); audio.toggle(); }
      if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
        event.preventDefault(); event.stopPropagation(); audio.seek(audio.currentWord + (event.code === "ArrowRight" ? 1 : -1));
      }
    }}>
    <header className="audiobook-topbar">
      <div className="audiobook-brand"><ScanLineIcon /><span>Audiobook Mode</span></div>
      <span className="audiobook-mode-label">Follow along</span>
      <button ref={closeButton} className="audiobook-close" aria-label="Exit audiobook mode" title="Exit audiobook mode" onClick={exit}><FiX /></button>
    </header>
    <main className="audiobook-reading" ref={reading} tabIndex={0} aria-label="Book text">
      <article className="audiobook-content" dir="auto" aria-busy={audio.loading}>
        {audio.section?.title && <div className="audiobook-chapter-meta">{bookTitle}</div>}
        <h1 className="audiobook-chapter-title">{audio.section?.title || bookTitle}</h1>
        {audio.loading && <p className="audiobook-loading" role="status">Loading book…</p>}
        {!audio.loading && paragraphs.map(group => <p key={group.paragraph}>
          {group.items.map(({ sentence, index }) => <Fragment key={sentence.cfi}>
            <span className={"audiobook-sentence" + (index === audio.index ? " is-active" : "")} aria-current={index === audio.index ? "true" : undefined} data-sentence={index}>
              {sentence.words.map((word, wordIndex) => <Fragment key={word.start}>
                <span className={"audiobook-word" + (index === audio.index && wordIndex === audio.highlight ? " is-active" : "")}>{word.text}</span>
                {wordIndex < sentence.words.length - 1 ? " " : ""}
              </Fragment>)}
            </span>{" "}
          </Fragment>)}
        </p>)}
      </article>
    </main>
    <footer className="audiobook-player">
      <div className="audiobook-player-inner">
        <div className="audiobook-progress-row">
          <span title="Estimated elapsed section time">{audiobookTime(progress * secondsPerWord)}</span>
          <input type="range" min={0} max={Math.max(1, total)} step={1} value={progress} disabled={audio.loading || !total} aria-label="Estimated section progress"
            aria-valuetext={total ? Math.round(progress / total * 100) + "% of section · estimated timing" : "Loading"}
            onPointerDown={() => { draggingSeek.current = true; }}
            onChange={event => { const value = Number(event.target.value); if (draggingSeek.current) setSeekDraft(value); else audio.seek(value); }}
            onPointerUp={event => { draggingSeek.current = false; setSeekDraft(null); audio.seek(Number(event.currentTarget.value)); }}
            onPointerCancel={() => { draggingSeek.current = false; setSeekDraft(null); }} />
          <span title="Estimated remaining section time">−{audiobookTime(Math.max(0, total - progress) * secondsPerWord)}</span>
        </div>
        <div className="audiobook-control-row">
          <div className="audiobook-transport">
            <button className="audiobook-control" aria-label="Previous sentence" title="Previous sentence" disabled={audio.loading || !audio.section || (!audio.index && audio.section.previous === null)} onClick={() => audio.move(-1)}><FiSkipBack /></button>
            <button className="audiobook-play" aria-label={audio.playing ? "Pause narration" : "Play narration"} title={audio.playing ? "Pause narration" : "Play narration"} disabled={audio.loading || !total || !audio.available} onClick={audio.toggle}>
              {audio.playing ? <FiPause fill="currentColor" /> : <FiPlay fill="currentColor" />}
            </button>
            <button className="audiobook-control" aria-label="Next sentence" title="Next sentence" disabled={audio.loading || !audio.section || (audio.index === audio.section.sentences.length - 1 && audio.section.next === null)} onClick={() => audio.move(1)}><FiSkipForward /></button>
            <div className="audiobook-speed-anchor" ref={speedAnchor}>
              <button ref={speedButton} className="audiobook-speed-button" aria-label={"Reading speed " + audio.speed + "×"} aria-haspopup="dialog" aria-expanded={speedOpen} aria-controls={speedOpen ? "audiobook-speed-popup" : undefined}
                onClick={() => { setSpeedDraft(audio.speed); setSpeedOpen(!speedOpen); }}>{audio.speed}×</button>
              {speedOpen && <div id="audiobook-speed-popup" className="audiobook-speed-popup" role="dialog" aria-label="Reading speed">
                <span>Reading speed</span>
                <input type="range" min="0.5" max="2.5" step="0.1" value={speedDraft} aria-label="Reading speed"
                  onPointerDown={() => { draggingSpeed.current = true; }}
                  onChange={event => { const value = Number(event.target.value); setSpeedDraft(value); if (!draggingSpeed.current) audio.changeSpeed(value); }}
                  onPointerUp={event => { draggingSpeed.current = false; audio.changeSpeed(Number(event.currentTarget.value)); }}
                  onPointerCancel={() => { draggingSpeed.current = false; setSpeedDraft(audio.speed); }} />
                <output>{speedDraft.toFixed(1)}</output>
              </div>}
            </div>
          </div>
          <div className="audiobook-voice" onPointerDown={() => setSpeedOpen(false)}>
            <span id="audiobook-voice-label" className="audiobook-sr-only">Narrator voice</span>
            <svg className="audiobook-voice-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6M9 5v14M13 8v8M17 6v12M21 10v4" /></svg>
            <ReaderSelect id="audiobook-voice" labelId="audiobook-voice-label" value={audio.voice} options={options} onChange={audio.changeVoice} />
          </div>
        </div>
        <div className="audiobook-player-meta" role="status" aria-live="polite"><span className={"audiobook-pulse" + (audio.playing ? " is-live" : "")} aria-hidden="true" /><span>{audio.available ? audio.status : "System speech is unavailable in this browser"}</span></div>
        <div className="audiobook-timing-note">Estimated section timing · {audio.wordEvents ? "Word follow-along" : "Sentence follow-along; word support varies by voice"}</div>
        {audio.error && <p className="audiobook-error" role="alert">{audio.error}</p>}
      </div>
    </footer>
  </div>;
}
