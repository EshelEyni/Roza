import { useEffect, useState } from "react";
import { FiCheck, FiFolder } from "react-icons/fi";
import { desktopKokoro, type KokoroExportFormat, type KokoroExportJob } from "../../../services/audiobook/desktopKokoro";
import { kokoroVoice } from "../../../services/audiobook/kokoroVoices";
import { AudiobookDialog, LocalVoicesNeeded } from "./AudiobookDialog";
import type { ReaderAudiobook } from "./audiobookNarrator";
import type { BookScriptState } from "./ReaderAudiobookHost";

const FORMATS: { id: KokoroExportFormat; label: string; detail: string }[] = [
  { id: "m4a", label: "M4A", detail: "AAC audio, best for Apple Books" },
  { id: "mp4", label: "MP4 audio", detail: "AAC in an MP4 container" },
  { id: "mp3", label: "MP3", detail: "Plays almost everywhere" },
];

/** Export a chapter or the whole book as one audio file with chapter markers (from RozaReader). */
export function AudiobookExportDialog({ audio, bookId, chapterTitle, script, onChooseVoice, onClose }: {
  audio: ReaderAudiobook; bookId?: string; chapterTitle: string; script: BookScriptState;
  onChooseVoice: () => void; onClose: () => void;
}) {
  const api = desktopKokoro();
  const reason = audio.engine !== "kokoro" && audio.kokoroAvailability === "ready" ? "choose" : audio.kokoroAvailability;
  const usable = audio.engine === "kokoro" && audio.kokoroAvailability === "ready" && !!api && !!bookId;
  const formats = FORMATS.filter(format => audio.kokoroStatus?.formats.includes(format.id));
  const voice = kokoroVoice(audio.localVoice);
  const [scope, setScope] = useState<"chapter" | "book">("chapter");
  const [format, setFormat] = useState<KokoroExportFormat>(formats[0]?.id || "m4a");
  const [folder, setFolder] = useState(audio.kokoroStatus?.exportFolder || "");
  const [job, setJob] = useState<KokoroExportJob | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { if (usable && script.state === "idle") void script.prepare(); }, [usable, script]);
  useEffect(() => {
    if (!api || !job || job.state !== "running") return;
    const timer = window.setTimeout(async () => {
      try { setJob(await api.getExport(job.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [api, job]);

  const start = async () => {
    if (!api || !bookId) return;
    setError("");
    try {
      setJob(await api.startExport({ bookId, voice: audio.localVoice, section: scope === "chapter" ? audio.section?.section ?? null : null, format }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const running = job?.state === "running";

  return <AudiobookDialog eyebrow="LOCAL VOICES" title="Export audio" onClose={onClose}
    description={usable ? `Read by ${voice?.name || audio.localVoice} · saved as one file with chapter markers` : undefined}
    footer={<>
      <button type="button" className="audiobook-voice-cancel" onClick={() => { if (running && job) void api?.stopExport(job.id); onClose(); }}>{running ? "Stop and close" : "Close"}</button>
      {usable && (job?.state === "done"
        ? <button type="button" className="audiobook-voice-apply" onClick={() => { if (job) void api?.revealExport(job.id); }}><FiFolder aria-hidden="true" /> Show in folder</button>
        : <button type="button" className="audiobook-voice-apply" disabled={running || script.state !== "ready" || !formats.length} onClick={() => void start()}>
          {running ? "Exporting…" : "Export"} <FiCheck aria-hidden="true" />
        </button>)}
    </>}>
    {!usable && <LocalVoicesNeeded reason={reason} onChooseVoice={onChooseVoice} />}
    {usable && <>
      {script.state === "preparing" && <div className="audiobook-progress" role="status">
        <div className="audiobook-progress-status"><span>Preparing the book’s text…</span><span>{script.done} / {script.total || "…"} sections</span></div>
        <progress max={Math.max(script.total, 1)} value={script.done} />
      </div>}
      {script.state === "error" && <p className="audiobook-error" role="alert">The book could not be prepared: {script.error}</p>}
      <div className="audiobook-voice-section-heading">WHAT TO EXPORT</div>
      <div className="audiobook-choice-row" role="radiogroup" aria-label="What to export">
        <button type="button" role="radio" aria-checked={scope === "chapter"} className={"audiobook-voice-filter" + (scope === "chapter" ? " is-active" : "")} disabled={running} onClick={() => setScope("chapter")}>This chapter · {chapterTitle}</button>
        <button type="button" role="radio" aria-checked={scope === "book"} className={"audiobook-voice-filter" + (scope === "book" ? " is-active" : "")} disabled={running} onClick={() => setScope("book")}>Whole book</button>
      </div>
      <div className="audiobook-voice-section-heading">FORMAT</div>
      <div className="audiobook-voice-options" role="radiogroup" aria-label="Format">
        {!formats.length && <div className="audiobook-voice-empty">No audio formats are available. Reinstall local voices.</div>}
        {formats.map(item => <label key={item.id} className={"audiobook-voice-card" + (item.id === format ? " is-selected" : "")}>
          <span className="audiobook-voice-choice">
            <input type="radio" name="audiobook-export-format" checked={item.id === format} disabled={running} onChange={() => setFormat(item.id)} />
            <span className="audiobook-voice-detail"><strong>{item.label}</strong><small>{item.detail}</small></span>
          </span>
        </label>)}
      </div>
      <div className="audiobook-voice-section-heading">SAVE TO</div>
      <div className="audiobook-folder-row">
        <span className="audiobook-folder" title={folder}>{folder || "Music › Roza Audiobooks"}</span>
        <button type="button" className="audiobook-voice-filter" disabled={running} onClick={async () => {
          try { setFolder((await api!.chooseFolder()).folder); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
        }}>Change…</button>
      </div>
      {scope === "book" && <p className="audiobook-voice-help">A whole book can take a while: every sentence is made first (saved sentences are reused), then encoded.</p>}
      {job && <div className="audiobook-progress" role="status" aria-live="polite">
        <div className="audiobook-progress-status"><span>{job.state === "error" ? "Export failed" : job.stage}</span><span>{job.progress}%</span></div>
        <progress max={100} value={job.progress} />
        {job.filePath && <span className="audiobook-folder" title={job.filePath}>{job.filePath}</span>}
      </div>}
      {(error || job?.error) && <p className="audiobook-error" role="alert">{error || job?.error}</p>}
    </>}
  </AudiobookDialog>;
}
