import { useTranslation } from "react-i18next";
import { EpubCFI } from "epubjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EpubRuntime } from "./useEpubRuntime";
import {
  extractRsvpWords,
  rsvpDelay,
  rsvpSentence,
  rsvpStart,
  type RsvpWord,
} from "../../services/readerRsvp";

export function useReaderRsvp(runtime: EpubRuntime, unavailable: boolean) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [words, setWords] = useState<RsvpWord[]>([]);
  const [index, setIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [boundary, setBoundary] = useState(false);
  const [wpm, setWpm] = useState(() => {
    try {
      return Math.max(
        100,
        Math.min(1000, Number(localStorage.getItem("roza-rsvp-wpm")) || 300),
      );
    } catch {
      return 300;
    }
  });
  const version = useRef(0);
  const word = words[index];
  async function load(target: string | number, from?: string) {
    const request = ++version.current;
    setBusy(true);
    setPlaying(false);
    setError("");
    setWords([]);
    try {
      const book = runtime.epubRef.current;
      if (!book) throw new Error("Book is not ready");
      const section = book.spine.get(target);
      if (!section) {
        setBoundary(true);
        return;
      }
      await section.load(book.load.bind(book));
      if (request !== version.current) return;
      const next = extractRsvpWords(section);
      setWords(next);
      setSectionIndex(section.index);
      setIndex(from && next.length ? rsvpStart(next, from) : 0);
      setBoundary(false);
    } catch {
      if (request === version.current) setError(t("reader.rsvp.loadError"));
    } finally {
      if (request === version.current) setBusy(false);
    }
  }
  const persist = useCallback(
    (current: RsvpWord) => {
      const book = runtime.epubRef.current;
      runtime.rsvpLocation.current = current.cfi;
      runtime.readingBoundary.current = current.cfi;
      runtime.updateRef.current({
        location: current.cfi,
        progress: book?.locations.length()
          ? book.locations.percentageFromCfi(current.cfi)
          : runtime.stateRef.current.progress,
      });
    },
    [runtime],
  );
  useEffect(() => {
    if (active && word && !busy) persist(word);
  }, [active, word, busy, persist]);
  useEffect(() => {
    if (!active || !playing || !word || busy || unavailable) return;
    const timer = window.setTimeout(
      () => {
        if (index === words.length - 1) {
          setPlaying(false);
          setBoundary(true);
        } else setIndex((value) => value + 1);
      },
      rsvpDelay(word, wpm),
    );
    return () => window.clearTimeout(timer);
  }, [active, playing, word, index, words.length, wpm, busy, unavailable]);
  const cancelLoad = useCallback(() => {
    ++version.current;
  }, []);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", pause);
    return () => {
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", pause);
      cancelLoad();
    };
  }, [cancelLoad]);
  useEffect(() => {
    if (unavailable) setPlaying(false);
  }, [unavailable]);
  async function toggle() {
    setPlaying(false);
    if (active) {
      ++version.current;
      setBusy(true);
      try {
        if (word) {
          runtime.rsvpActive.current = false;
          const target = new EpubCFI(word.cfi);
          target.collapse(true);
          await runtime.layoutTask.current;
          await runtime.renditionRef.current?.display(target.toString());
          persist(word);
        }
        runtime.rsvpActive.current = false;
        setActive(false);
      } catch {
        runtime.rsvpActive.current = true;
        setError(t("reader.rsvp.returnError"));
      } finally {
        setBusy(false);
      }
    } else {
      runtime.rsvpActive.current = true;
      setActive(true);
      const cfi = runtime.stateRef.current.location;
      await load(cfi || 0, cfi || undefined);
    }
  }
  function adjacent(direction: number) {
    const book = runtime.epubRef.current;
    let next = sectionIndex + direction;
    let section = book?.spine.get(next);
    while (section && section.linear === false) {
      next += direction;
      section = book?.spine.get(next);
    }
    return section ? next : null;
  }
  return {
    active,
    playing,
    busy,
    error,
    word,
    wpm,
    boundary,
    toggle,
    canPreviousChapter: adjacent(-1) !== null,
    canNextChapter: adjacent(1) !== null,
    play: () => {
      if (!busy && !unavailable && word && !boundary)
        setPlaying((value) => !value);
    },
    pause: () => setPlaying(false),
    speed: (value: number) => {
      const speed = Math.max(100, Math.min(1000, value || 300));
      setWpm(speed);
      try {
        localStorage.setItem("roza-rsvp-wpm", String(speed));
      } catch {
        /* optional preference */
      }
    },
    skip: (direction: number, sentence = false) => {
      setPlaying(false);
      setBoundary(false);
      setIndex((value) =>
        sentence
          ? rsvpSentence(words, value, direction)
          : Math.max(0, Math.min(words.length - 1, value + direction)),
      );
    },
    chapter: (direction: number) => {
      const next = adjacent(direction);
      if (next !== null) void load(next);
    },
  };
}
