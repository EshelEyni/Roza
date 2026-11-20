import type { MutableRefObject } from "react";
import { FiChevronUp, FiFastForward, FiPause, FiPlay, FiRewind, FiX } from "react-icons/fi";
import { narratorLabel, type ReaderAudiobook } from "./audiobookNarrator";

import { useAudiobookSpaceShortcut } from "./useAudiobookSpaceShortcut";

/** Small player over the normal reader while narration continues outside the full audiobook view. */
export function AudiobookMiniPlayer({ audio, bookTitle, onOpen, onExit, keydownRef }: {
  audio: ReaderAudiobook; bookTitle: string; onOpen: () => void; onExit: () => void;
  keydownRef?: MutableRefObject<((event: KeyboardEvent) => void) | null>;
}) {
  const total = audio.section?.totalWords || 0;
  const canToggle = !audio.loading && !!total && audio.available;
  useAudiobookSpaceShortcut(!!keydownRef, canToggle, audio.toggle, keydownRef);
  const percent = total ? Math.round(audio.currentWord / total * 100) : 0;
  const narrator = narratorLabel(audio);
  return <div className="audiobook-mini" role="group" aria-label="Audiobook player">
    <button type="button" className="audiobook-mini-book" title="Open Audiobook Mode" aria-label={"Open Audiobook Mode: " + (audio.section?.title || bookTitle)} onClick={onOpen}>
      <FiChevronUp aria-hidden="true" />
      <span className="audiobook-mini-text">
        <span className="audiobook-mini-title">{audio.section?.title || bookTitle}</span>
        <span className="audiobook-mini-detail">{audio.error || (audio.available ? narrator.name + " · " + audio.status : "Selected voice engine is unavailable")}</span>
      </span>
    </button>
    <button type="button" className="audiobook-mini-control" aria-label="Previous sentence" title="Previous sentence" disabled={audio.loading} onClick={() => audio.move(-1)}><FiRewind /></button>
    <button type="button" className="audiobook-mini-play" aria-label={audio.playing ? "Pause narration" : "Play narration"} title={audio.playing ? "Pause" : "Play"}
      disabled={!canToggle} onClick={audio.toggle}>
      {audio.playing ? <FiPause fill="currentColor" /> : <FiPlay fill="currentColor" />}
    </button>
    <button type="button" className="audiobook-mini-control" aria-label="Next sentence" title="Next sentence" disabled={audio.loading} onClick={() => audio.move(1)}><FiFastForward /></button>
    <button type="button" className="audiobook-mini-control" aria-label="Stop and close the audiobook" title="Stop and close" onClick={onExit}><FiX /></button>
    <span className="audiobook-mini-progress" style={{ width: percent + "%" }} aria-hidden="true" />
  </div>;
}
