import { useEffect, useState } from "react";
import { desktopKokoro, type KokoroOffline } from "../../../services/narration/desktopKokoro";
import { kokoroVoice } from "../../../services/narration/kokoroVoices";
import { AudiobookDialog, LocalVoicesNeeded } from "./AudiobookDialog";
import type { ReaderAudiobook } from "./audiobookNarrator";
import type { BookScriptState } from "./ReaderAudiobookHost";

/** Save a chapter or the whole book with local voices, for listening without internet (from RozaReader). */
export function AudiobookOfflineDialog({ audio, bookId, chapterTitle, script, onPlay, onChooseVoice, onClose }: {
  audio: ReaderAudiobook; bookId?: string; chapterTitle: string; script: BookScriptState;
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

  useEffect(() => { if (usable && script.state === "idle") void script.prepare(); }, [usable, script]);

  useEffect(() => {
    if (!usable || script.state !== "ready" || section === null) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const [nextChapter, nextBook] = await Promise.all([
          api!.offline({ bookId: bookId!, voice: audio.localVoice, section, action: "get" }),
          api!.offline({ bookId: bookId!, voice: audio.localVoice, section: null, action: "get" }),
        ]);
        if (cancelled) return;
        setChapter(nextChapter); setBook(nextBook); setError("");
        // The whole-book save fills this chapter too, so both are followed while either runs.
        if (nextChapter.state !== "downloading" && nextBook.state !== "downloading") return;
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
      if (!cancelled) timer = window.setTimeout(poll, 1500);
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [usable, script.state, section, audio.localVoice, bookId, api, chapter?.state, book?.state]);

  const act = async (scope: "chapter" | "book", action: "start" | "stop" | "delete") => {
    if (!api || !bookId) return;
    setBusy(true); setError("");
    try {
      const status = await api.offline({ bookId, voice: audio.localVoice, section: scope === "chapter" ? section : null, action });
      if (scope === "chapter") setChapter(status); else setBook(status);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const ready = chapter?.state === "ready";
  const running = chapter?.state === "downloading";
  const bookReady = book?.state === "ready";
  const bookRunning = book?.state === "downloading";
  const bookPercent = book?.total ? Math.floor(book.completed / book.total * 100) : 0;

  return <AudiobookDialog eyebrow="LOCAL VOICES" title="Save for offline" onClose={onClose}
    description={usable ? `${chapterTitle} · read by ${voice?.name || audio.localVoice}` : undefined}
    footer={<>
      <button type="button" className="audiobook-voice-cancel" onClick={onClose}>Close</button>
      {usable && script.state === "ready" && (ready
        ? <button type="button" className="audiobook-voice-apply" onClick={() => { onPlay(); onClose(); }}>Play with word tracking</button>
        : running
          ? <button type="button" className="audiobook-voice-apply" disabled={busy} onClick={() => void act("chapter", "stop")}>{busy ? "Stopping…" : "Stop saving"}</button>
          : <button type="button" className="audiobook-voice-apply" disabled={busy || !chapter || bookRunning} onClick={() => void act("chapter", "start")}>
            {busy ? "Starting…" : chapter?.completed ? "Resume chapter" : "Save chapter"}
          </button>)}
    </>}>
    {!usable && <LocalVoicesNeeded reason={reason} onChooseVoice={onChooseVoice} />}
    {usable && <>
      <p className="audiobook-voice-help">Saves this chapter’s audio and word timings on this computer, so it plays with word highlighting, seeking and speed control even without internet. A different voice needs its own save. You can close this window while saving; keep Roza open until it finishes.</p>
      {script.state === "preparing" && <div className="audiobook-progress" role="status">
        <div className="audiobook-progress-status"><span>Preparing the book’s text…</span><span>{script.done} / {script.total || "…"} sections</span></div>
        <progress max={Math.max(script.total, 1)} value={script.done} />
      </div>}
      {script.state === "error" && <p className="audiobook-error" role="alert">The book could not be prepared: {script.error}</p>}
      {chapter && <div className="audiobook-progress" role="status" aria-live="polite">
        <div className="audiobook-progress-status">
          <span>{ready ? "Ready for offline listening" : running ? "Saving chapter…" : chapter.completed ? "Partly saved · resume anytime" : "Not saved yet"}</span>
          <span>{chapter.completed} / {chapter.total} sentences</span>
        </div>
        <progress max={Math.max(chapter.total, 1)} value={chapter.completed} aria-label="Chapter save progress" />
        {ready && <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void act("chapter", "delete")}>Remove this chapter’s saved audio</button>}
      </div>}
      {(error || chapter?.error) && <p className="audiobook-error" role="alert">{error || chapter?.error}</p>}

      {book && <section className="audiobook-offline-book" aria-label="Whole book">
        <div className="audiobook-voice-section-heading">WHOLE BOOK</div>
        <p className="audiobook-voice-help">Saves every chapter in order, gently in the background so the computer stays responsive. Each chapter is ready as soon as it finishes, and listening always comes first. Stop anytime; finished audio is kept.</p>
        <div className="audiobook-progress" role="status" aria-live="polite">
          <div className="audiobook-progress-status">
            <span>{bookReady ? "The whole book is ready offline" : bookRunning ? "Saving chapter " + ((book.section ?? 0) + 1) + "…" : book.completed ? "Partly saved · resume anytime" : "Not saved yet"}</span>
            <span>{book.chaptersReady} / {book.chapters} chapters · {bookPercent}%</span>
          </div>
          <progress max={Math.max(book.total, 1)} value={book.completed} aria-label="Book save progress" />
        </div>
        {book.error && !bookRunning && <p className="audiobook-error" role="alert">{book.error}</p>}
        <div className="audiobook-offline-actions">
          {bookRunning
            ? <button type="button" className="audiobook-voice-cancel" disabled={busy} onClick={() => void act("book", "stop")}>{busy ? "Stopping…" : "Stop saving book"}</button>
            : !bookReady && <button type="button" className="audiobook-voice-cancel" disabled={busy} onClick={() => void act("book", "start")}>{busy ? "Starting…" : book.completed ? "Resume whole book" : "Save whole book"}</button>}
          {book.completed > 0 && !bookRunning && <button type="button" className="audiobook-link-button" disabled={busy} onClick={() => void act("book", "delete")}>Remove all saved audio for this voice</button>}
        </div>
      </section>}
    </>}
  </AudiobookDialog>;
}
