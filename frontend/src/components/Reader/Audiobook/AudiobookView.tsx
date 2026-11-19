import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  FiChevronLeft, FiChevronRight, FiDownload, FiFastForward, FiList, FiPause, FiPlay, FiRewind,
  FiSkipBack, FiSkipForward, FiVolume2, FiVolumeX, FiWifiOff, FiX,
} from "react-icons/fi";
import type { AudiobookChapter } from "../../../services/readerAudiobookSource";
import { audiobookTime } from "../../../services/readerTts";
import { ReaderAudiobookVoices } from "../ReaderAudiobookVoices";
import { AudiobookText } from "./AudiobookText";
import { AudiobookOfflineDialog } from "./AudiobookOfflineDialog";
import { AudiobookExportDialog } from "./AudiobookExportDialog";
import type { BookScriptState } from "./ReaderAudiobookHost";
import { narratorLabel, type ReaderAudiobook } from "./audiobookNarrator";

const FONT_SIZES = [16, 18, 20, 22, 24, 27];
const FONT_KEY = "roza-audiobook-font";
const readFont = () => {
  try { const value = Number(localStorage.getItem(FONT_KEY)); return FONT_SIZES.includes(value) ? value : 22; } catch { return 22; }
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function AudiobookView({ audio, bookId, bookTitle, chapters, script, onExit }: {
  audio: ReaderAudiobook; bookId?: string; bookTitle: string; chapters: AudiobookChapter[];
  script: BookScriptState; onMinimize: () => void; onExit: () => void;
}) {
  const [dialog, setDialog] = useState<"voice" | "offline" | "export" | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [speedDraft, setSpeedDraft] = useState(audio.speed);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState(readFont);
  const draggingSeek = useRef(false);
  const draggingSpeed = useRef(false);
  const lastVolume = useRef(audio.volume || 1);
  const root = useRef<HTMLDivElement>(null);
  const reading = useRef<HTMLElement>(null);
  const contentsRef = useRef<HTMLDivElement>(null);
  const speedAnchor = useRef<HTMLDivElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const resumeAfterVoice = useRef(false);

  useEffect(() => {
    if (!audio.narratorWarning) return;
    resumeAfterVoice.current = false; setSpeedOpen(false); setDialog("voice");
  }, [audio.narratorWarning]);

  // Leaving the page while choosing a narrator must not restart narration when the picker closes.
  useEffect(() => {
    if (dialog !== "voice") return;
    const hide = () => { resumeAfterVoice.current = false; };
    window.addEventListener("pagehide", hide);
    return () => window.removeEventListener("pagehide", hide);
  }, [dialog]);

  // The full view is a modal layer over the reader: everything behind it is inert while it is open.
  useEffect(() => {
    const mode = root.current;
    const shell = mode?.closest(".reader-shell");
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
    };
  }, []);

  useEffect(() => {
    if (!speedOpen && !contentsOpen) return;
    const outside = (event: PointerEvent) => {
      if (speedOpen && !speedAnchor.current?.contains(event.target as Node)) setSpeedOpen(false);
      if (contentsOpen && !contentsRef.current?.contains(event.target as Node)) setContentsOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [speedOpen, contentsOpen]);

  const section = audio.section;
  const chapterPosition = section ? chapters.findIndex(chapter => chapter.section === section.section) : -1;
  const previousChapter = section ? [...chapters].reverse().find(chapter => chapter.section < section.section) : undefined;
  const nextChapter = section ? chapters.find(chapter => chapter.section > section.section) : undefined;
  const goToPrevious = () => { if (previousChapter) audio.goToSection(previousChapter.section); else if (section?.previous !== null && section) audio.goToSection(section.previous); };
  const goToNext = () => { if (nextChapter) audio.goToSection(nextChapter.section); else if (section?.next !== null && section) audio.goToSection(section.next); };
  const canGoBack = !!section && (!!previousChapter || section.previous !== null);
  const canGoForward = !!section && (!!nextChapter || section.next !== null);

  const changeFont = (step: number) => {
    const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(fontSize) + step))];
    setFontSize(next);
    try { localStorage.setItem(FONT_KEY, String(next)); } catch { /* Kept for this session only. */ }
  };
  const openVoices = () => {
    setSpeedOpen(false); setContentsOpen(false); resumeAfterVoice.current = audio.playing;
    audio.pause("Paused while choosing a narrator"); setDialog("voice");
  };

  // Space plays and pauses, arrows move by sentence (Shift: chapter), + and − change the text size.
  const shortcuts = useRef<(event: KeyboardEvent) => void>(() => {});
  shortcuts.current = (event: KeyboardEvent) => {
    if (dialog || event.defaultPrevented || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Escape") {
      if (speedOpen) setSpeedOpen(false); else if (contentsOpen) setContentsOpen(false); else onExit();
      event.preventDefault(); return;
    }
    const actions: Record<string, () => void> = {
      " ": audio.toggle,
      ArrowLeft: () => (event.shiftKey ? goToPrevious() : audio.move(-1)),
      ArrowRight: () => (event.shiftKey ? goToNext() : audio.move(1)),
      "+": () => changeFont(1), "=": () => changeFont(1), "-": () => changeFont(-1),
    };
    const action = actions[event.key];
    if (!action) return;
    if ((event.target as Element | null)?.closest?.('input[type="range"]') && event.key.startsWith("Arrow")) return;
    event.preventDefault(); event.stopPropagation();
    // A focused button would also click on Space and undo the toggle.
    if (event.target instanceof HTMLButtonElement) event.target.blur();
    action();
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => shortcuts.current(event);
    document.addEventListener("keydown", handle, true);
    return () => document.removeEventListener("keydown", handle, true);
  }, []);

  const total = section?.totalWords || 0;
  const progress = seekDraft ?? audio.currentWord;
  // Times are estimates from the word count: Web Speech and prepared audio expose no whole-section duration.
  const secondsPerWord = 60 / (180 * audio.speed);
  const percent = total ? Math.round(progress / Math.max(1, total) * 100) : 0;
  const narrator = narratorLabel(audio);
  const isMuted = audio.volume === 0;

  return <div className="reader-audiobook" ref={root} role="dialog" aria-modal="true" aria-label="Audiobook Mode" tabIndex={-1}
    onKeyDown={event => {
      if (event.key !== "Tab" || dialog) return;
      const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || []).filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (first && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }}>
    <header className="audiobook-topbar">
      <div className="audiobook-titles">
        <span className="audiobook-titles-book">{bookTitle}</span>
        <span className="audiobook-titles-chapter">{section?.title || (audio.loading ? "Loading…" : "")}</span>
      </div>
      <div className="audiobook-header-status" role="status" aria-live="polite">
        <span className={"audiobook-pulse" + (audio.playing ? " is-live" : "")} aria-hidden="true" />
        <span>{audio.available ? audio.status : "Selected voice engine is unavailable"}</span>
      </div>
      <div className="audiobook-tools">
        <button type="button" className="audiobook-tool" onClick={() => setDialog("offline")} data-tooltip="Save for offline listening">
          <FiWifiOff /><span>Save offline</span>
        </button>
        <div className="audiobook-popover-anchor" ref={contentsRef}>
          <button type="button" className="audiobook-tool" aria-expanded={contentsOpen} aria-haspopup="menu" data-tooltip="Chapters" onClick={() => setContentsOpen(!contentsOpen)}>
            <FiList /><span>Contents</span>
          </button>
          {contentsOpen && <div className="audiobook-popover audiobook-contents" role="menu">
            <p className="audiobook-popover-label">Chapters</p>
            {!chapters.length && <p className="audiobook-popover-empty">This book has no table of contents.</p>}
            {chapters.map((chapter, position) => <button key={chapter.section + ":" + position} type="button" role="menuitem"
              className={chapter.section === section?.section ? "is-active" : ""}
              onClick={() => { audio.goToSection(chapter.section); setContentsOpen(false); }}>
              <span className="audiobook-contents-number">{position + 1}</span><span>{chapter.title}</span>
            </button>)}
            <p className="audiobook-shortcuts">Space play · ← → sentence · ⇧← ⇧→ chapter · + − text size</p>
          </div>}
        </div>
        <div className="audiobook-font-size" role="group" aria-label="Text size">
          <button type="button" data-tooltip="Smaller text (−)" aria-label="Smaller text" onClick={() => changeFont(-1)} disabled={fontSize === FONT_SIZES[0]}>A<sup>−</sup></button>
          <button type="button" data-tooltip="Larger text (+)" aria-label="Larger text" onClick={() => changeFont(1)} disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}>A<sup>+</sup></button>
        </div>
        <button ref={closeButton} type="button" className="audiobook-close" aria-label="Exit audiobook mode" data-tooltip="Exit audiobook mode" onClick={onExit}><FiX /></button>
      </div>
    </header>
    <div className="audiobook-section-progress" title={percent + "% of this chapter"}><span style={{ width: percent + "%" }} /></div>

    <main className="audiobook-reading" ref={reading} tabIndex={0} aria-label="Book text">
      <article className="audiobook-content" dir="auto" aria-busy={audio.loading} style={{ "--audiobook-font": fontSize + "px" } as CSSProperties}>
        <div className="audiobook-chapter-meta">
          {chapterPosition >= 0 ? `Chapter ${chapterPosition + 1} of ${chapters.length} · ` : ""}{bookTitle}
        </div>
        <h1 className="audiobook-chapter-title">{section?.title || bookTitle}</h1>
        {audio.loading && <p className="audiobook-loading" role="status">Loading book…</p>}
        {!audio.loading && section && <AudiobookText key={section.section} sentences={section.sentences} scrollRef={reading}
          index={audio.index} passageEnd={audio.passageEnd} highlight={audio.highlight} offset={audio.offset}
          playing={audio.playing} fontSize={fontSize} jump={sentence => audio.seek(section.sentences[sentence].startWord)} />}
        {!audio.loading && section && <nav className="audiobook-chapter-nav">
          <button type="button" onClick={goToPrevious} disabled={!canGoBack}><FiChevronLeft /><span>Previous chapter</span></button>
          <button type="button" onClick={goToNext} disabled={!canGoForward}><span>Next chapter</span><FiChevronRight /></button>
        </nav>}
      </article>
    </main>

    <footer className="audiobook-player">
      <div className="audiobook-player-inner">
        <div className="audiobook-progress-row">
          <span title="Estimated elapsed chapter time">{audiobookTime(progress * secondsPerWord)}</span>
          <input type="range" min={0} max={Math.max(1, total)} step={1} value={progress} disabled={audio.loading || !total} aria-label="Estimated section progress"
            aria-valuetext={total ? percent + "% of section · estimated timing" : "Loading"}
            onPointerDown={() => { draggingSeek.current = true; }}
            onChange={event => { const value = Number(event.target.value); if (draggingSeek.current) setSeekDraft(value); else audio.seek(value); }}
            onPointerUp={event => { draggingSeek.current = false; setSeekDraft(null); audio.seek(Number(event.currentTarget.value)); }}
            onPointerCancel={() => { draggingSeek.current = false; setSeekDraft(null); }} />
          <span title="Estimated remaining chapter time">−{audiobookTime(Math.max(0, total - progress) * secondsPerWord)}</span>
        </div>
        <div className="audiobook-control-row">
          <div className="audiobook-side">
            <button ref={voiceButton} type="button" className="audiobook-voice-trigger" aria-label="Choose narrator voice" data-tooltip="Choose narrator" aria-haspopup="dialog" aria-expanded={dialog === "voice"} onClick={openVoices}>
              <svg className="audiobook-voice-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6M9 5v14M13 8v8M17 6v12M21 10v4" /></svg>
              <span className="audiobook-voice-text"><span className="audiobook-voice-name">{narrator.name}</span><span className="audiobook-voice-detail-line">{narrator.detail}</span></span>
            </button>
          </div>
          <div className="audiobook-transport">
            <button className="audiobook-control audiobook-chapter-skip" aria-label="Previous chapter" data-tooltip="Previous chapter (⇧←)" disabled={audio.loading || !canGoBack} onClick={goToPrevious}><FiSkipBack /></button>
            <button className="audiobook-control" aria-label="Previous sentence" data-tooltip="Previous sentence (←)" disabled={audio.loading || !section || (!audio.index && section.previous === null)} onClick={() => audio.move(-1)}><FiRewind /></button>
            <button className="audiobook-play" aria-label={audio.playing ? "Pause narration" : "Play narration"} data-tooltip={audio.playing ? "Pause (Space)" : "Play (Space)"} disabled={audio.loading || !total || !audio.available} onClick={audio.toggle}>
              {audio.playing ? <FiPause fill="currentColor" /> : <FiPlay fill="currentColor" />}
            </button>
            <button className="audiobook-control" aria-label="Next sentence" data-tooltip="Next sentence (→)" disabled={audio.loading || !section || (audio.index === section.sentences.length - 1 && section.next === null)} onClick={() => audio.move(1)}><FiFastForward /></button>
            <button className="audiobook-control audiobook-chapter-skip" aria-label="Next chapter" data-tooltip="Next chapter (⇧→)" disabled={audio.loading || !canGoForward} onClick={goToNext}><FiSkipForward /></button>
          </div>
          <div className="audiobook-side is-end">
            <div className="audiobook-volume">
              <button type="button" className="audiobook-control" aria-label={isMuted ? "Unmute" : "Mute"} data-tooltip={isMuted ? "Unmute" : "Mute"}
                onClick={() => audio.changeVolume(isMuted ? lastVolume.current : 0)}>{isMuted ? <FiVolumeX /> : <FiVolume2 />}</button>
              <input type="range" min={0} max={1} step={0.05} value={audio.volume} aria-label="Volume" title={`Volume ${Math.round(audio.volume * 100)}%`}
                onChange={event => { const value = Number(event.target.value); if (value > 0) lastVolume.current = value; audio.changeVolume(value); }} />
            </div>
            <div className="audiobook-speed-anchor" ref={speedAnchor}>
              <button className="audiobook-speed-button" aria-label={"Reading speed " + audio.speed + "×"} data-tooltip="Reading speed" aria-haspopup="dialog" aria-expanded={speedOpen} aria-controls={speedOpen ? "audiobook-speed-popup" : undefined}
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
            <button type="button" className="audiobook-control" aria-label="Export audio" data-tooltip="Export as an audio file" onClick={() => setDialog("export")}><FiDownload /></button>
          </div>
        </div>
        {audio.error && <p className="audiobook-error" role="alert">{audio.error}</p>}
      </div>
    </footer>

    {dialog === "voice" && <ReaderAudiobookVoices voices={audio.voices} selected={audio.voice} engine={audio.engine} aiVoice={audio.aiVoice} localVoice={audio.localVoice}
      kokoroStatus={audio.kokoroStatus} kokoroAvailability={audio.kokoroAvailability} onKokoroChanged={() => void audio.refreshKokoro()}
      config={audio.config} configStatus={audio.configStatus} bookId={bookId} warning={audio.narratorWarning} beforePreview={audio.waitForAudioCancellation} onApplyGesture={audio.unlockNarrator} onClose={async (selected, engine) => {
        if (selected !== undefined) {
          if (!await audio.changeNarrator(engine || "system", selected)) return false;
        } else if (audio.narratorWarning) { onExit(); return true; }
        setDialog(null); voiceButton.current?.focus({ preventScroll: true });
        if (resumeAfterVoice.current) { resumeAfterVoice.current = false; audio.resume(); }
        return true;
      }} />}
    {dialog === "offline" && <AudiobookOfflineDialog audio={audio} bookId={bookId} chapterTitle={section?.title || bookTitle} script={script}
      onPlay={() => { if (!audio.playing) audio.toggle(); }} onChooseVoice={() => { setDialog(null); openVoices(); }} onClose={() => setDialog(null)} />}
    {dialog === "export" && <AudiobookExportDialog audio={audio} bookId={bookId} chapterTitle={section?.title || bookTitle} script={script}
      onChooseVoice={() => { setDialog(null); openVoices(); }} onClose={() => setDialog(null)} />}
  </div>;
}
