import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiTrash2 } from "react-icons/fi";
import { desktopKokoro, type KokoroOffline } from "../../../services/narration/desktopKokoro";
import { kokoroVoice } from "../../../services/narration/kokoroVoices";
import { AudiobookDialog, LocalVoicesNeeded } from "./AudiobookDialog";
import type { ReaderAudiobook } from "./audiobookNarrator";
import type { BookScriptState } from "./ReaderAudiobookHost";

/** Save a chapter or the whole book with local voices, for listening without internet (from RozaReader). */
// Sentences saved per second, measured while saving and remembered for the next estimate.
const RATE_KEY = "roza-kokoro-save-rate";
const readRate = () => { try { const value = Number(localStorage.getItem(RATE_KEY)); return value > 0 ? value : 0; } catch { return 0; } };
const timeLeft = (seconds: number) => {
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return "about " + minutes + " min";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return "about " + hours + " h" + (rest ? " " + rest + " min" : "");
};

export function AudiobookOfflineDialog({ audio, bookId, chapterTitle, script, chapterOnly = false, open = true, container, onChapterProgress, onPlay, onChooseVoice, onClose }: {
  audio: ReaderAudiobook; bookId?: string; chapterTitle: string; script: BookScriptState;
  chapterOnly?: boolean;
  open?: boolean;
  container?: HTMLElement | null;
  onChapterProgress?: (percent: number | null) => void;
  onPlay: () => void; onChooseVoice: () => void; onClose: () => void;
}) {
  const api = desktopKokoro();
  const reason = audio.engine !== "kokoro" && audio.kokoroAvailability === "ready" ? "choose" : audio.kokoroAvailability;
  const usable = audio.engine === "kokoro" && audio.kokoroAvailability === "ready" && !!api && !!bookId;
  const voice = kokoroVoice(audio.localVoice);
  const section = audio.section?.section ?? null;
  const [chapter, setChapter] = useState<KokoroOffline | null>(null);
  const [book, setBook] = useState<KokoroOffline | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [rate, setRate] = useState(readRate);
  const sample = useRef<{ scope: "chapter" | "book"; at: number; done: number } | null>(null);
  const running = usable && chapter?.state === "downloading";
  const chapterPercent = chapter?.total ? Math.floor(chapter.completed / chapter.total * 100) : 0;

  useEffect(() => {
    onChapterProgress?.(running ? chapterPercent : null);
  }, [onChapterProgress, running, chapterPercent]);

  // Measure the save speed from the running job's progress between polls.
  useEffect(() => {
    const scope = book?.state === "downloading" ? "book" : chapter?.state === "downloading" ? "chapter" : null;
    const job = scope === "book" ? book : scope === "chapter" ? chapter : null;
    if (!scope || !job) { sample.current = null; return; }
    const now = performance.now(), start = sample.current;
    if (!start || start.scope !== scope || job.completed < start.done) { sample.current = { scope, at: now, done: job.completed }; return; }
    const seconds = (now - start.at) / 1000, saved = job.completed - start.done;
    if (seconds < 8 || saved < 2) return;
    const next = saved / seconds;
    setRate(next);
    try { localStorage.setItem(RATE_KEY, String(next)); } catch { /* The estimate is kept for this dialog only. */ }
  }, [chapter, book]);

  useEffect(() => { if (open && usable && script.state === "idle") void script.prepare(); }, [open, usable, script]);

  useEffect(() => {
    if (!usable || section === null || (open ? script.state !== "ready" : !onChapterProgress)) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const [nextChapter, nextBook] = await Promise.all([
          api!.offline({ bookId: bookId!, voice: audio.localVoice, section, action: "get" }),
          chapterOnly ? null : api!.offline({ bookId: bookId!, voice: audio.localVoice, section: null, action: "get" }),
        ]);
        if (cancelled) return;
        setChapter(nextChapter); setBook(nextBook); setError("");
        // The whole-book save fills this chapter too, so both are followed while either runs.
        if (nextChapter.state !== "downloading" && nextBook?.state !== "downloading") return;
      } catch (cause) {
        if (!open && !running) return;
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
      if (!cancelled) timer = window.setTimeout(poll, 1500);
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, onChapterProgress, running, usable, script.state, section, audio.localVoice, bookId, api, chapterOnly, chapter?.state, book?.state]);

  const act = async (scope: "chapter" | "book", action: "start" | "stop" | "delete") => {
    if (!api || !bookId) return;
    setBusy(true); setError("");
    try {
      const status = await api.offline({ bookId, voice: audio.localVoice, section: scope === "chapter" ? section : null, action });
      if (scope === "chapter") setChapter(status); else setBook(status);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); setConfirmRemove(false); }
  };
  // Removing the whole book's audio also stops its saves, so poll once more to refresh this chapter too.
  const removeAll = async () => {
    await act("book", "delete");
    if (!api || !bookId || section === null) return;
    try { setChapter(await api.offline({ bookId, voice: audio.localVoice, section, action: "get" })); } catch { /* the next poll retries */ }
  };

  const ready = chapter?.state === "ready";
  const bookReady = book?.state === "ready";
  const bookRunning = book?.state === "downloading";
  const bookPercent = book?.total ? Math.floor(book.completed / book.total * 100) : 0;

  const savedAudio = chapterOnly ? chapter : book;
  const voiceName = voice?.name || audio.localVoice;
  const scriptReady = script.state === "ready";
  const estimate = (status: KokoroOffline | null, active: boolean) => {
    if (!status || status.state === "ready") return "";
    if (!rate) return active ? "estimating time…" : "";
    return timeLeft((status.total - status.completed) / rate) + (active ? " left" : "");
  };
  const withEstimate = (text: string, eta: string) => eta ? text + " · " + eta : text;
  const chapterStatus = withEstimate(ready ? "Ready offline" : running ? "Saving…" : chapter?.completed ? "Partly saved" : "Not saved yet", estimate(chapter, running));
  const bookEta = estimate(book, bookRunning);
  const bookStatus = bookReady ? "Whole book ready offline"
    : bookRunning ? withEstimate("Saving chapter " + ((book?.section ?? 0) + 1) + "…", bookEta)
      : book?.completed ? withEstimate("Partly saved", bookEta) : bookEta ? "Not saved yet · " + bookEta : "Saves every chapter in the background";

  if (!open) return null;

  const dialog = <AudiobookDialog eyebrow="LOCAL VOICES" title="Save for offline" onClose={onClose}
    description={usable ? `${chapterTitle} · read by ${voiceName}` : undefined}
    footer={usable && !!savedAudio?.completed && <>
      {confirmRemove
        ? <p className="audiobook-offline-footer-text">Remove all saved audio for {voiceName} in this {chapterOnly ? "chapter" : "book"}?</p>
        : <p className="audiobook-offline-footer-text">Saved audio for {voiceName} stays on this computer.</p>}
      <div className="audiobook-offline-footer-actions">
        {confirmRemove
          ? <>
            <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep it</button>
            <button type="button" className="audiobook-offline-remove" disabled={busy} onClick={() => void (chapterOnly ? act("chapter", "delete") : removeAll())}><FiTrash2 aria-hidden="true" />{busy ? "Removing…" : "Remove"}</button>
          </>
          : <button type="button" className="audiobook-offline-remove" disabled={busy} onClick={() => setConfirmRemove(true)}><FiTrash2 aria-hidden="true" />Remove saved audio</button>}
      </div>
    </>}>
    {!usable && <LocalVoicesNeeded reason={reason} onChooseVoice={onChooseVoice} />}
    {usable && <>
      <p className="audiobook-voice-help audiobook-offline-intro">Listen without internet, with word highlighting. Keep Roza open while saving.</p>
      {script.state === "preparing" && <div className="audiobook-progress" role="status">
        <div className="audiobook-progress-status"><span>Preparing the {chapterOnly ? "chapter’s" : "book’s"} text…</span><span>{script.done} / {script.total || "…"} sections</span></div>
        <progress max={Math.max(script.total, 1)} value={script.done} />
      </div>}
      {script.state === "error" && <p className="audiobook-error" role="alert">The {chapterOnly ? "chapter" : "book"} could not be prepared: {script.error}</p>}

      {chapter && <section className="audiobook-offline-row" aria-label="This chapter">
        <div className="audiobook-offline-row-main" role="status" aria-live="polite">
          <div className="audiobook-progress-status"><strong>This chapter</strong><span>{chapter.completed} / {chapter.total} sentences{running && ` · ${chapterPercent}%`}</span></div>
          <progress max={Math.max(chapter.total, 1)} value={chapter.completed} aria-label="Chapter save progress" />
          <span className="audiobook-offline-row-status">{chapterStatus}</span>
        </div>
        {scriptReady && (ready
          ? <button type="button" className="audiobook-voice-apply" onClick={() => { onPlay(); onClose(); }}>Play</button>
          : running
            ? <button type="button" className="audiobook-voice-cancel" disabled={busy} onClick={() => void act("chapter", "stop")}>{busy ? "Stopping…" : "Stop"}</button>
            : <button type="button" className={chapter.completed ? "audiobook-voice-cancel" : "audiobook-voice-apply"} disabled={busy || bookRunning} onClick={() => void act("chapter", "start")}>
              {busy ? "Starting…" : chapter.completed ? "Resume" : "Save chapter"}
            </button>)}
      </section>}
      {(error || chapter?.error) && <p className="audiobook-error" role="alert">{error || chapter?.error}</p>}

      {book && <section className="audiobook-offline-row" aria-label="Whole book">
        <div className="audiobook-offline-row-main" role="status" aria-live="polite">
          <div className="audiobook-progress-status"><strong>Whole book</strong><span>{book.chaptersReady} / {book.chapters} chapters · {bookPercent}%</span></div>
          <progress max={Math.max(book.total, 1)} value={book.completed} aria-label="Book save progress" />
          <span className="audiobook-offline-row-status">{bookStatus}</span>
        </div>
        {bookRunning
          ? <button type="button" className="audiobook-voice-cancel" disabled={busy} onClick={() => void act("book", "stop")}>{busy ? "Stopping…" : "Stop"}</button>
          : !bookReady && <button type="button" className="audiobook-voice-cancel" disabled={busy} onClick={() => void act("book", "start")}>{busy ? "Starting…" : book.completed ? "Resume" : "Save book"}</button>}
      </section>}
      {book?.error && !bookRunning && <p className="audiobook-error" role="alert">{book.error}</p>}
    </>}
  </AudiobookDialog>;
  return container ? createPortal(dialog, container) : dialog;
}
