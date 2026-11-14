import { useEffect, useRef, useState } from "react";
import { EpubCFI } from "epubjs";
import type Section from "epubjs/types/section";
import type { EpubRuntime } from "./useEpubRuntime";
import {
  extractReaderSentences,
  type ReaderSentence,
} from "../../services/readerSentences";
import { rsvpStart } from "../../services/readerRsvp";

/** Loads one spine section at a time and shares the reader's exact focus anchor. */
export function useReaderSentenceMode(runtime: EpubRuntime) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentences, setSentences] = useState<ReaderSentence[]>([]);
  const [index, setIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [chapterTitle, setChapterTitle] = useState("");
  const [edge, setEdge] = useState({ back: false, next: false });
  const version = useRef(0);
  const locked = useRef(false);
  const lastLoad = useRef<{
    target: string | number;
    direction: number;
    from?: string;
  }>({ target: 0, direction: 1 });
  const sentence = sentences[index];
  useEffect(
    () => () => {
      ++version.current;
    },
    [],
  );
  function adjacent(from: number, direction: number) {
    const book = runtime.epubRef.current;
    let next = from + direction;
    let section = book?.spine.get(next);
    while (section && section.linear === false) {
      next += direction;
      section = book?.spine.get(next);
    }
    return section ? next : null;
  }
  function persist(current: ReaderSentence) {
    const book = runtime.epubRef.current;
    runtime.rsvpLocation.current = current.cfi;
    const end = new EpubCFI(current.cfi);
    end.collapse(false);
    runtime.readingBoundary.current = end.toString();
    const progress = book?.locations.length()
      ? book.locations.percentageFromCfi(current.cfi)
      : runtime.stateRef.current.progress;
    runtime.updateRef.current({
      location: current.cfi,
      progress: Number.isFinite(progress)
        ? progress
        : runtime.stateRef.current.progress,
    });
  }
  async function load(target: string | number, direction = 1, from?: string) {
    lastLoad.current = { target, direction, from };
    const request = ++version.current;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const book = runtime.epubRef.current;
      if (!book) throw new Error("Book is not ready");
      let section: Section | undefined = book.spine.get(target);
      while (section) {
        await section.load(book.load.bind(book));
        if (request !== version.current) return;
        const next = extractReaderSentences(section);
        if (next.length) {
          const position = from
            ? rsvpStart(
                next.map((item) => ({ ...item, paragraphEnd: false })),
                from,
              )
            : direction < 0
              ? next.length - 1
              : 0;
          setSentences(next);
          setIndex(position);
          setSectionIndex(section.index);
          setEdge({ back: false, next: false });
          setChapterTitle(
            book.navigation.get(section.href)?.label?.trim() ||
              section.document
                .querySelector("title,h1,h2")
                ?.textContent?.trim() ||
              "",
          );
          persist(next[position]);
          return;
        }
        const nextIndex = adjacent(section.index, direction);
        section = nextIndex === null ? undefined : book.spine.get(nextIndex);
      }
      setEdge((current) => ({
        ...current,
        [direction < 0 ? "back" : "next"]: true,
      }));
      if (!sentences.length) setError("No readable sentences found.");
    } catch {
      if (request === version.current)
        setError("Could not load sentences. Please retry.");
    } finally {
      if (request === version.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function toggle() {
    if (locked.current) return;
    if (!active) {
      runtime.rsvpActive.current = true;
      setActive(true);
      const cfi = runtime.stateRef.current.location;
      await load(cfi || 0, 1, cfi || undefined);
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      if (sentence) {
        const point = new EpubCFI(sentence.cfi);
        point.collapse(true);
        await runtime.layoutTask.current;
        // Resume normal chapter/page tracking while retaining the exact focus anchor.
        runtime.rsvpActive.current = false;
        await runtime.renditionRef.current?.display(point.toString());
        persist(sentence);
      }
      runtime.rsvpActive.current = false;
      setActive(false);
      setError("");
    } catch {
      runtime.rsvpActive.current = true;
      setError("Could not return to the reader. Please retry.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function move(direction: number) {
    if (locked.current || runtime.panelRef.current) return;
    const next = index + direction;
    if (next >= 0 && next < sentences.length) {
      setIndex(next);
      persist(sentences[next]);
      setError("");
    } else {
      const target = adjacent(sectionIndex, direction);
      if (target !== null) void load(target, direction);
    }
  }
  return {
    active,
    busy,
    error,
    sentence,
    chapterTitle,
    toggle,
    move,
    number: sentences.length ? index + 1 : 0,
    count: sentences.length,
    canBack: index > 0 || (!edge.back && adjacent(sectionIndex, -1) !== null),
    canNext:
      index + 1 < sentences.length ||
      (!edge.next && adjacent(sectionIndex, 1) !== null),
    retry: () =>
      load(
        lastLoad.current.target,
        lastLoad.current.direction,
        lastLoad.current.from,
      ),
  };
}
