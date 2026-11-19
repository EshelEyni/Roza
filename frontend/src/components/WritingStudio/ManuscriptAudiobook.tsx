import "../Reader/Audiobook/audiobook.css";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FiActivity, FiArrowDownCircle, FiDownload, FiFastForward, FiHeadphones, FiMaximize2, FiMinimize2, FiMove, FiPause, FiPlay, FiRewind, FiSkipBack, FiSkipForward, FiSquare, FiVolume2, FiVolumeX, FiX } from "react-icons/fi";
import { AudiobookOfflineDialog } from "../Reader/Audiobook/AudiobookOfflineDialog";
import { AudiobookExportDialog } from "../Reader/Audiobook/AudiobookExportDialog";
import { narratorLabel } from "../Reader/Audiobook/audiobookNarrator";
import type { BookScriptState } from "../Reader/Audiobook/ReaderAudiobookHost";
import { ReaderAudiobookVoices } from "../Reader/ReaderAudiobookVoices";
import { useReaderAudiobook } from "../../hooks/reader/useReaderAudiobook";
import { desktopKokoro } from "../../services/narration/desktopKokoro";
import { kokoroSectionRequests } from "../../services/narration/kokoroPacing";
import { audiobookTime } from "../../services/readerTts";
import { followManuscriptNarration, manuscriptNarration } from "./useManuscriptReadingMarks";

type Narration = ReturnType<typeof manuscriptNarration>;
type Point = { x: number; y: number };
const inset = 8;

function fitPlayer(player: HTMLElement, position: Point): Point {
  return {
    x: Math.max(inset, Math.min(position.x, window.innerWidth - player.offsetWidth - inset)),
    y: Math.max(inset, Math.min(position.y, window.innerHeight - player.offsetHeight - inset)),
  };
}

function readingSelection(editable: HTMLElement, marked?: Range) {
  const selection = editable.ownerDocument.getSelection();
  const range = selection?.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0) : undefined;
  return range && editable.contains(range.commonAncestorContainer) ? range : marked;
}

function ManuscriptPlayback({ narration, localId, markedSentence, header, onClose }: {
  narration: Narration;
  localId?: string;
  markedSentence: { current?: Range };
  header: HTMLElement;
  onClose: () => void;
}) {
  const { section, editable, ranges, wordRanges } = narration;
  const audio = useReaderAudiobook(async () => section, undefined, undefined, { preserveSystemPosition: true, localBookId: localId });
  const [dialog, setDialog] = useState<"voice" | "export" | "offline">();
  const [minimized, setMinimized] = useState(false);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const minimizeButton = useRef<HTMLButtonElement>(null);
  const switchedPresentation = useRef(false);
  const [following, setFollowing] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [seekDraft, setSeekDraft] = useState<number>();
  const [position, setPosition] = useState<Point>();
  const [script, setScript] = useState<Omit<BookScriptState, "prepare">>({ state: "idle", done: 0, total: 1 });
  const panel = useRef<HTMLDivElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ pointer: number; offset: Point }>();
  const seeking = useRef(false);
  const positionChosen = useRef(false);
  const lastVolume = useRef(audio.volume || 1);
  const resumeAfterVoice = useRef(false);
  const ready = !audio.loading && !!section.totalWords;
  const narrator = narratorLabel(audio);
  const mute = audio.volume === 0;
  const volumePercent = Math.round(audio.volume * 100) + "%";
  const progress = seekDraft ?? audio.currentWord;
  const secondsPerWord = 60 / (180 * audio.speed);
  const range = following && audio.section && !audio.ended ? ranges[audio.index] : undefined;

  useEffect(() => {
    if (range) return followManuscriptNarration(editable, range);
  }, [editable, range]);

  const spokenWord = audio.highlight;
  const wordRangeAt = range ? wordRanges[audio.index] : undefined;
  useEffect(() => {
    const word = spokenWord === null ? undefined : wordRangeAt?.(spokenWord);
    if (word) return followManuscriptNarration(editable, word, "word");
  }, [editable, spokenWord, wordRangeAt]);

  useLayoutEffect(() => {
    const player = panel.current;
    if (!player) return;
    const fit = () => setPosition(current => {
      const next = fitPlayer(player, current ?? {
        x: (window.innerWidth - player.offsetWidth) / 2,
        y: window.innerHeight - player.offsetHeight - 20,
      });
      return current?.x === next.x && current?.y === next.y ? current : next;
    });
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(player);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [minimized]);

  useLayoutEffect(() => {
    if (switchedPresentation.current) (minimized ? restoreButton : minimizeButton).current?.focus();
  }, [minimized]);

  const seek = (word: number) => {
    positionChosen.current = true;
    setFollowing(true);
    audio.seek(word);
  };
  const move = (direction: -1 | 1) => {
    positionChosen.current = true;
    setFollowing(true);
    audio.move(direction);
  };
  const toggle = () => {
    if (!positionChosen.current) {
      const selected = readingSelection(editable, markedSentence.current);
      const index = selected && ranges.findIndex(range => range.isPointInRange(selected.startContainer, selected.startOffset));
      if (index !== undefined && index >= 0 && index !== audio.index) seek(section.sentences[index].startWord);
    }
    positionChosen.current = true;
    setFollowing(true);
    audio.toggle();
  };
  const openVoices = () => {
    resumeAfterVoice.current = audio.playing;
    // System voice previews share the speech queue, so release the paused utterance first.
    audio.pause("Paused while choosing a narrator", false);
    setDialog("voice");
  };
  const prepareChapter = async () => {
    const api = desktopKokoro();
    if (!api || !localId) return false;
    setScript({ state: "preparing", done: 0, total: 1 });
    try {
      await api.saveScript({
        bookId: localId, title: section.title, author: "",
        sections: [{
          section: section.section, title: section.title,
          sentences: kokoroSectionRequests(section.sentences, !!api.passages),
        }],
      });
      setScript({ state: "ready", done: 1, total: 1 });
      return true;
    } catch (error) {
      setScript({ state: "error", done: 0, total: 1, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };

  const changePresentation = () => {
    switchedPresentation.current = true;
    setMinimized(!minimized);
  };
  const playLabel = audio.playing ? "Pause narration" : "Play narration";
  const playIcon = audio.playing ? <FiPause fill="currentColor" /> : <FiPlay fill="currentColor" />;
  const canPlay = ready && audio.available;

  if (minimized) return createPortal(
    <div className="ws-header-audio-player" role="group" aria-label="Minimized audiobook player">
      <button ref={restoreButton} type="button" aria-label="Restore mini player" title="Restore mini player" onClick={changePresentation}><FiMaximize2 /></button>
      <button type="button" aria-label={playLabel} title={playLabel} disabled={!canPlay}
        onMouseDown={event => event.preventDefault()} onClick={toggle}>{playIcon}</button>
      <button type="button" aria-label="Close mini player" title="Stop and close" onClick={onClose}><FiX /></button>
    </div>,
    header,
  );

  return createPortal(
    <div ref={panel} className="reader-audiobook ws-floating-audio" dir="ltr" role="region" aria-label="Audiobook mini player"
      style={{ left: position?.x, top: position?.y }}
      onKeyDown={event => {
        if (event.key === "Escape" && !dialog) { event.stopPropagation(); onClose(); }
      }}>
      <header className="ws-floating-audio-header">
        <button type="button" className="ws-floating-audio-grip" aria-label="Move mini player with arrow keys" title="Drag to move"
          onPointerDown={event => {
            if (event.button !== 0 || !panel.current) return;
            const box = panel.current.getBoundingClientRect();
            drag.current = { pointer: event.pointerId, offset: { x: event.clientX - box.left, y: event.clientY - box.top } };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const active = drag.current;
            if (!active || active.pointer !== event.pointerId || !panel.current) return;
            setPosition(fitPlayer(panel.current, { x: event.clientX - active.offset.x, y: event.clientY - active.offset.y }));
          }}
          onLostPointerCapture={() => { drag.current = undefined; }}
          onKeyDown={event => {
            if (!panel.current || !position) return;
            const directions: Record<string, Point> = {
              ArrowLeft: { x: -24, y: 0 }, ArrowRight: { x: 24, y: 0 },
              ArrowUp: { x: 0, y: -24 }, ArrowDown: { x: 0, y: 24 },
            };
            const step = directions[event.key];
            if (!step) return;
            event.preventDefault();
            setPosition(fitPlayer(panel.current, { x: position.x + step.x, y: position.y + step.y }));
          }}>
          <FiMove aria-hidden="true" /><span dir="auto">{section.title || "Audiobook"}</span>
        </button>
        <button ref={minimizeButton} type="button" className="audiobook-control" aria-label="Minimize to header" title="Minimize to header" onClick={changePresentation}><FiMinimize2 /></button>
        <button type="button" className="audiobook-control" aria-label="Close mini player" title="Stop and close" onClick={onClose}><FiX /></button>
      </header>

      <div className="audiobook-progress-row">
        <span title="Estimated elapsed time">{audiobookTime(progress * secondsPerWord)}</span>
        <input type="range" min={0} max={Math.max(1, section.totalWords)} value={progress} disabled={!ready} aria-label="Chapter progress"
          aria-valuetext={Math.round(100 * progress / Math.max(1, section.totalWords)) + "% of chapter"}
          onPointerDown={() => { seeking.current = true; }}
          onChange={event => {
            const word = Number(event.target.value);
            if (seeking.current) setSeekDraft(word); else seek(word);
          }}
          onPointerUp={event => { seeking.current = false; setSeekDraft(undefined); seek(Number(event.currentTarget.value)); }}
          onPointerCancel={() => { seeking.current = false; setSeekDraft(undefined); }} />
        <span title="Estimated total chapter time">{audiobookTime(section.totalWords * secondsPerWord)}</span>
      </div>

      <div className="ws-floating-audio-controls">
        <div className="audiobook-transport">
          <button type="button" className="audiobook-control" aria-label="Chapter start" title="Chapter start" disabled={!ready} onClick={() => seek(0)}><FiSkipBack /></button>
          <button type="button" className="audiobook-control" aria-label="Previous sentence" title="Previous sentence" disabled={!ready || !audio.index} onClick={() => move(-1)}><FiRewind /></button>
          <button type="button" className="audiobook-play" aria-label={playLabel} title={audio.playing ? "Pause" : "Play or resume"}
            disabled={!canPlay} onMouseDown={event => event.preventDefault()} onClick={toggle}>
            {playIcon}
          </button>
          <button type="button" className="audiobook-control" aria-label="Next sentence" title="Next sentence" disabled={!ready || audio.index >= section.sentences.length - 1} onClick={() => move(1)}><FiFastForward /></button>
          <button type="button" className="audiobook-control" aria-label="Last sentence" title="Last sentence" disabled={!ready}
            onClick={() => seek(section.sentences.at(-1)?.startWord || 0)}><FiSkipForward /></button>
          <button type="button" className="audiobook-control" aria-label="Stop narration" title="Stop" disabled={!ready}
            onClick={() => { positionChosen.current = false; setFollowing(false); audio.stop(); editable.focus({ preventScroll: true }); }}><FiSquare /></button>
        </div>
        <button ref={voiceButton} type="button" className="audiobook-voice-trigger" aria-label="Choose narrator voice"
          title="Choose narrator" aria-haspopup="dialog" onClick={openVoices}>
          <FiActivity aria-hidden="true" />
          <span className="audiobook-voice-text">
            <span className="audiobook-voice-name">{audio.voice || audio.engine !== "system" ? narrator.name : "System voice"}</span>
            <span className="audiobook-voice-detail-line">{narrator.detail}</span>
          </span>
        </button>
        <div className="ws-floating-audio-settings">
          <button type="button" className="audiobook-control" aria-label={mute ? "Unmute" : "Mute"} title={mute ? "Unmute" : "Mute"}
            onClick={() => audio.changeVolume(mute ? lastVolume.current : 0)}>{mute ? <FiVolumeX /> : <FiVolume2 />}</button>
          <div className="ws-floating-audio-volume">
            <input type="range" min={0} max={1} step={0.05} value={audio.volume} aria-label="Volume" aria-valuetext={volumePercent}
              onChange={event => { const value = Number(event.target.value); if (value > 0) lastVolume.current = value; audio.changeVolume(value); }} />
            <span className="ws-floating-audio-volume-tooltip" aria-hidden="true">{volumePercent}</span>
          </div>
          <button type="button" className="audiobook-speed-button" aria-label="Reading speed" aria-expanded={speedOpen} onClick={() => setSpeedOpen(!speedOpen)}>{audio.speed}×</button>
          <button type="button" className="audiobook-control" aria-label="Save for offline" title="Save for offline" onClick={() => setDialog("offline")}><FiArrowDownCircle /></button>
          <button type="button" className="audiobook-control" aria-label="Export audio" title="Export audio" onClick={() => setDialog("export")}><FiDownload /></button>
        </div>
      </div>
      {speedOpen && <label className="ws-floating-audio-speed">Reading speed
        <input type="range" min={0.5} max={2.5} step={0.1} value={audio.speed} onChange={event => audio.changeSpeed(Number(event.target.value))} />
      </label>}
      <div className="ws-floating-audio-status" role="status">
        {audio.error || audio.narratorWarning || (audio.loading ? "Preparing narration…"
          : !section.totalWords ? "This draft has no text to narrate."
          : !audio.available ? "Narration is unavailable. Choose a narrator voice."
          : audio.ended ? "Chapter narration complete." : audio.status)}
      </div>
      {dialog === "voice" && <ReaderAudiobookVoices voices={audio.voices} selected={audio.voice} engine={audio.engine}
        localVoice={audio.localVoice} kokoroStatus={audio.kokoroStatus} kokoroAvailability={audio.kokoroAvailability}
        onKokoroChanged={() => void audio.refreshKokoro()} warning={audio.narratorWarning}
        configStatus={audio.configStatus} beforePreview={audio.waitForAudioCancellation} onClose={async (voice, engine) => {
          if (voice !== undefined && !await audio.changeNarrator(engine || "system", voice)) return false;
          setDialog(undefined);
          voiceButton.current?.focus({ preventScroll: true });
          if (resumeAfterVoice.current && !audio.narratorWarning) audio.resume();
          resumeAfterVoice.current = false;
          return true;
        }} />}
      {dialog === "offline" && <AudiobookOfflineDialog audio={audio} bookId={localId} chapterTitle={section.title}
        script={{ ...script, prepare: prepareChapter }} chapterOnly onChooseVoice={openVoices}
        onPlay={() => { if (!audio.playing) toggle(); }} onClose={() => setDialog(undefined)} />}
      {dialog === "export" && <AudiobookExportDialog audio={audio} bookId={localId} chapterTitle={section.title}
        script={{ ...script, prepare: prepareChapter }} chapterOnly onChooseVoice={openVoices} onClose={() => setDialog(undefined)} />}
    </div>,
    editable.ownerDocument.body,
  );
}

export function ManuscriptAudiobook({ chapter, header, root, markedSentence }: {
  chapter: { id: string; title: string };
  header: HTMLElement;
  root: RefObject<HTMLDivElement>;
  markedSentence: { current?: Range };
}) {
  const [narration, setNarration] = useState<Narration>();
  const open = () => {
    const editable = root.current?.querySelector<HTMLElement>("[data-slate-editor]");
    if (!editable) return;
    const next = manuscriptNarration(editable, readingSelection(editable, markedSentence.current));
    next.section.title = chapter.title;
    setNarration(next);
  };
  const close = () => {
    narration?.editable.focus({ preventScroll: true });
    setNarration(undefined);
  };
  const id = chapter.id.replace(/-/g, "").slice(0, 24);
  const localId = /^[a-f0-9]{24}$/i.test(id) ? id.toLowerCase() : undefined;

  return (
    <>
      {createPortal(
        <button type="button" className="ws-audiobook-launch" aria-label="Audiobook" title="Audiobook" aria-expanded={!!narration}
          onMouseDown={event => event.preventDefault()} onClick={narration ? close : open}>
          <FiHeadphones aria-hidden="true" />
        </button>,
        header,
      )}
      {narration && <>
        <span hidden data-ws-audiobook-open />
        <ManuscriptPlayback narration={narration} localId={localId} markedSentence={markedSentence} header={header} onClose={close} />
      </>}
    </>
  );
}
