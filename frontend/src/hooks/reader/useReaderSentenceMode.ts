import { flushSync } from "react-dom";
import type { Contents, Location } from "epubjs";
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
export function useReaderSentenceMode(runtime: EpubRuntime, restore: (cfi: string) => Promise<void>) {
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
  const [target, setTarget] = useState<{ text: string; cfis: string[] } | null>(null);
  const sentence = sentences[index];
  async function setReadingTarget(cfi: string, text: string, origin: string) {
    const book = runtime.epubRef.current;
    if (!book) throw new Error("Book is not ready");
    const compare = new EpubCFI().compare;
    const start = new EpubCFI(origin); start.collapse(true);
    const end = new EpubCFI(cfi); end.collapse(false);
    if (compare(end.toString(), start.toString()) <= 0)
      throw new Error("Choose a target after your starting sentence.");
    const first = book.spine.get(origin), last = book.spine.get(cfi);
    if (!first || !last) throw new Error("Target is unavailable.");
    const cfis: string[] = [];
    for (let i = first.index; i <= last.index; i++) {
      const section = book.spine.get(i);
      if (!section || section.linear === false) continue;
      await section.load(book.load.bind(book));
      for (const item of extractReaderSentences(section)) {
        const a = new EpubCFI(item.cfi); a.collapse(true);
        const b = new EpubCFI(item.cfi); b.collapse(false);
        if (compare(b.toString(), start.toString()) > 0 && compare(a.toString(), end.toString()) < 0) cfis.push(item.cfi);
      }
    }
    if (!cfis.length) throw new Error("No readable sentences found before this target.");
    setTarget({ text, cfis });
  }
  const targetNumber = target && sentence ? (() => {
    const point = new EpubCFI(sentence.cfi); point.collapse(true);
    const first = new EpubCFI(target.cfis[0]); first.collapse(true);
    const compare = new EpubCFI().compare;
    if (compare(point.toString(), first.toString()) < 0) return 0;
    const position = target.cfis.findIndex(cfi => {
      const end = new EpubCFI(cfi); end.collapse(false);
      return compare(end.toString(), point.toString()) > 0;
    });
    return position < 0 ? target.cfis.length : position + 1;
  })() : null;
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
    setTarget(previous => {
      if (!previous) return previous;
      const end = new EpubCFI(previous.cfis[previous.cfis.length - 1]); end.collapse(false);
      const point = new EpubCFI(current.cfi); point.collapse(true);
      return new EpubCFI().compare(point.toString(), end.toString()) >= 0 ? null : previous;
    });
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
  function entryCfi() {
    const rendition = runtime.renditionRef.current;
    const contents = (rendition?.getContents() as unknown as Contents[] | undefined) || [];
    for (const content of contents) {
      const selected = content.document.getSelection();
      if (selected?.rangeCount && !selected.isCollapsed && selected.toString().trim())
        return content.cfiFromRange(selected.getRangeAt(0));
    }
    return runtime.selectionRef.current?.cfi || runtime.keyboardWordCfi.current ||
      (rendition?.currentLocation() as unknown as Location | undefined)?.start?.cfi ||
      runtime.stateRef.current.location;
  }
  async function toggle(startCfi?: string) {
    if (locked.current) return;
    if (!active) {
      runtime.rsvpActive.current = true;
      setActive(true);
      const cfi = startCfi || entryCfi();
      await load(cfi || 0, 1, cfi || undefined);
      return;
    }
    locked.current = true;
    setBusy(true);
    const current = sentence;
    const rendition = runtime.renditionRef.current;
    let restoreVersion = runtime.navigationVersion.current;
    const superseded = async () => {
      runtime.rsvpActive.current = false;
      if (!runtime.explicitNavigation.current && runtime.renditionRef.current === rendition)
        await rendition?.reportLocation();
    };
    try {
      if (!current || !rendition) throw new Error("Sentence unavailable");
      // Commit the visible Page Mode layout before epub.js resolves the stable sentence CFI.
      // Keep relocation/persistence suppressed until the navigation transaction has finished.
      flushSync(() => setActive(false));
      const restoring = restore(current.cfi);
      restoreVersion = runtime.navigationVersion.current;
      await restoring;
      if (runtime.renditionRef.current !== rendition) return;
      if (runtime.navigationVersion.current !== restoreVersion) { await superseded(); return; }
      persist(current);
      runtime.rsvpActive.current = false;
      await rendition.reportLocation();
      setError("");
    } catch {
      if (runtime.navigationVersion.current !== restoreVersion) { await superseded(); return; }
      runtime.rsvpActive.current = true;
      setActive(true);
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
    entryCfi,
    move,
    target, setReadingTarget, clearReadingTarget: () => setTarget(null),
    number: targetNumber ?? (sentences.length ? index + 1 : 0),
    count: target ? target.cfis.length : sentences.length,
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
