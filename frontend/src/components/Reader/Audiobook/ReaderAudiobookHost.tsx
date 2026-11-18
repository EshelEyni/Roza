import { useEffect, useRef, useState } from "react";
import type { Book } from "epubjs";
import { useReaderAudiobook, type AudiobookLoader } from "../../../hooks/reader/useReaderAudiobook";
import { loadAudiobookBook, loadAudiobookChapters, type AudiobookChapter } from "../../../services/readerAudiobookSource";
import { desktopKokoro } from "../../../services/narration/desktopKokoro";
import { kokoroSentence, sectionPacing } from "../../../services/narration/kokoroPacing";
import { AudiobookView } from "./AudiobookView";
import { AudiobookMiniPlayer } from "./AudiobookMiniPlayer";

/** The whole book's text, prepared once per session for offline saves and export (local voices only). */
export type BookScriptState = {
  state: "idle" | "preparing" | "ready" | "error";
  done: number;
  total: number;
  error?: string;
  prepare: () => Promise<boolean>;
};

export type ReaderAudiobookSource = {
  bookTitle: string;
  bookAuthor: string;
  loadSection: AudiobookLoader;
  epub: () => Book | null | undefined;
};

/**
 * Owns one audiobook session per open book. The full view and the mini player share it, so closing the
 * full view keeps narration going while the reader follows along; Exit (or leaving the book) ends it.
 */
export function ReaderAudiobookHost({ open, bookId, source, onMinimize, onOpen, onExit, onFollow }: {
  open: boolean; bookId?: string; source: ReaderAudiobookSource;
  onMinimize: () => void; onOpen: () => void; onExit: (cfi?: string) => void; onFollow: (cfi: string) => void;
}) {
  const [session, setSession] = useState(open);
  useEffect(() => { if (open) setSession(true); }, [open]);
  if (!session) return null;
  return <AudiobookSession key={bookId} open={open} bookId={bookId} source={source} onMinimize={onMinimize} onOpen={onOpen}
    onExit={cfi => { setSession(false); onExit(cfi); }} onFollow={onFollow} />;
}

function AudiobookSession({ open, bookId, source, onMinimize, onOpen, onExit, onFollow }: {
  open: boolean; bookId?: string; source: ReaderAudiobookSource;
  onMinimize: () => void; onOpen: () => void; onExit: (cfi?: string) => void; onFollow: (cfi: string) => void;
}) {
  const sourceRef = useRef(source); sourceRef.current = source;
  const audio = useReaderAudiobook(source.loadSection, bookId, () => {
    const metadata = sourceRef.current.epub()?.packaging?.metadata as { language?: string } | undefined;
    return metadata?.language;
  });
  const [chapters, setChapters] = useState<AudiobookChapter[]>([]);
  const [script, setScript] = useState<Omit<BookScriptState, "prepare">>({ state: "idle", done: 0, total: 0 });
  const preparing = useRef<Promise<boolean>>();

  useEffect(() => {
    const epub = source.epub();
    if (epub) void loadAudiobookChapters(epub).then(setChapters).catch(() => setChapters([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While minimized, the page follows the spoken sentence.
  const followed = useRef<string>();
  useEffect(() => {
    if (open || !audio.playing || !audio.cfi || followed.current === audio.cfi) return;
    followed.current = audio.cfi;
    onFollow(audio.cfi);
  }, [open, audio.playing, audio.cfi, onFollow]);

  const abort = useRef<AbortController>();
  useEffect(() => () => abort.current?.abort(), []);

  function prepare() {
    if (preparing.current) return preparing.current;
    const api = desktopKokoro();
    const epub = sourceRef.current.epub();
    if (!api || !epub || !bookId) return Promise.resolve(false);
    const controller = new AbortController();
    abort.current = controller;
    setScript({ state: "preparing", done: 0, total: 0 });
    const task = (async () => {
      try {
        const sections = await loadAudiobookBook(epub, (done, total) => setScript({ state: "preparing", done, total }), controller.signal);
        await api.saveScript({
          bookId,
          title: sourceRef.current.bookTitle,
          author: sourceRef.current.bookAuthor,
          sections: sections.map(item => {
            const pacing = sectionPacing(item.sentences);
            return { section: item.section, title: item.title, sentences: item.sentences.map((sentence, index) => kokoroSentence(sentence, pacing[index])) };
          }),
        });
        setScript(current => ({ ...current, state: "ready" }));
        return true;
      } catch (cause) {
        if (!controller.signal.aborted) setScript(current => ({ ...current, state: "error", error: cause instanceof Error ? cause.message : String(cause) }));
        preparing.current = undefined;
        return false;
      }
    })();
    preparing.current = task;
    return task;
  }

  const exit = () => onExit(audio.cfi);
  if (open) {
    return <AudiobookView audio={audio} bookId={bookId} bookTitle={source.bookTitle} chapters={chapters}
      script={{ ...script, prepare }} onMinimize={onMinimize} onExit={exit} />;
  }
  return <AudiobookMiniPlayer audio={audio} bookTitle={source.bookTitle} onOpen={onOpen} onExit={exit} />;
}
