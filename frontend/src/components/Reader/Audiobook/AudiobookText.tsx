import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useVirtualizer, type Range } from "@tanstack/react-virtual";
import { audiobookParagraphs, audiobookWordAt, audiobookWordWindow, type AudiobookParagraphData, type AudiobookSentence } from "../../../services/readerTts";

// Keep roughly 50 paragraphs on either side of the visible reading position (from RozaReader),
// so long chapters stay light while find-in-page still covers the neighbourhood being read.
function readingRange(range: Range) {
  const start = Math.max(0, Math.min(range.startIndex - 45, range.count - 100));
  const end = Math.min(range.count, Math.max(start + 100, range.endIndex + 1));
  return Array.from({ length: end - start }, (_, index) => start + index);
}

/** The spoken sentence: only a stable 64-word window around the spoken word gets word elements. */
const HighlightedSentence = memo(function HighlightedSentence({ sentence, index, highlight, offset, jump }: {
  sentence: AudiobookSentence; index: number; highlight: number | null; offset: number; jump: (sentence: number) => void;
}) {
  const cursor = highlight ?? audiobookWordAt(sentence.words, offset);
  const band = Math.floor(cursor / 32);
  const wordWindow = useMemo(() => audiobookWordWindow(sentence, band * 32), [sentence, band]);
  return <span className="audiobook-sentence is-active" aria-current="true" data-sentence={index} onClick={() => jump(index)}>
    {wordWindow.prefix}
    {sentence.words.slice(wordWindow.start, wordWindow.end).map((word, localIndex) => {
      const wordIndex = wordWindow.start + localIndex;
      return <Fragment key={word.start}>
        <span className={"audiobook-word" + (wordIndex === highlight ? " is-active" : "")}
          data-audiobook-cursor={wordIndex === cursor ? "" : undefined}>{word.text}</span>
        {wordIndex + 1 < wordWindow.end ? sentence.text.slice(word.end, sentence.words[wordIndex + 1].start) : ""}
      </Fragment>;
    })}
    {wordWindow.suffix}
  </span>;
});

/** Inactive paragraphs are plain sentence spans; status changes never re-render them. */
const Paragraph = memo(function Paragraph({ paragraph, activeIndex, activeEnd, highlight, offset, jump }: {
  paragraph: AudiobookParagraphData; activeIndex: number; activeEnd: number; highlight: number | null; offset: number;
  jump: (sentence: number) => void;
}) {
  return <p>{paragraph.items.map(({ index, sentence }, position) => {
    const gap = position + 1 < paragraph.items.length ? " " : "";
    if (index === activeIndex) {
      return <Fragment key={index}>
        <HighlightedSentence sentence={sentence} index={index} highlight={highlight} offset={offset} jump={jump} />{gap}
      </Fragment>;
    }
    const inPassage = activeIndex >= 0 && index > activeIndex && index <= activeEnd;
    return <Fragment key={index}>
      <span className={"audiobook-sentence" + (inPassage ? " is-active" : "")} data-sentence={index}
        title="Read from here" onClick={() => jump(index)}>{sentence.text}</span>{gap}
    </Fragment>;
  })}</p>;
});

export const AudiobookText = memo(function AudiobookText({ sentences, scrollRef, index, passageEnd, highlight, offset, playing, fontSize, jump }: {
  sentences: AudiobookSentence[]; scrollRef: RefObject<HTMLElement>;
  index: number; passageEnd: number; highlight: number | null; offset: number; playing: boolean; fontSize: number;
  jump: (sentence: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const [resizeVersion, setResizeVersion] = useState(0);
  const pausedUntil = useRef(0);
  const latestJump = useRef(jump);
  latestJump.current = jump;
  const stableJump = useMemo(() => (sentence: number) => latestJump.current(sentence), []);
  const paragraphs = useMemo(() => audiobookParagraphs(sentences), [sentences]);
  const paragraphOfSentence = useMemo(() => {
    const result: number[] = [];
    paragraphs.forEach((paragraph, position) => paragraph.items.forEach(item => { result[item.index] = position; }));
    return result;
  }, [paragraphs]);
  const activeParagraph = paragraphOfSentence[index] ?? 0;
  const lastParagraph = paragraphOfSentence[Math.max(index, passageEnd)] ?? activeParagraph;
  const lineHeight = 1.9;
  const virtualizer = useVirtualizer({
    count: paragraphs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: position => {
      const characters = paragraphs[position].text.length;
      const width = listRef.current?.clientWidth ?? 634;
      return Math.max(1, Math.ceil(characters * fontSize * 0.5 / width)) * fontSize * lineHeight + fontSize * 1.15;
    },
    rangeExtractor: readingRange,
    scrollMargin: margin,
    useAnimationFrameWithResizeObserver: true,
  });

  // A reader who scrolls by hand keeps the view for a few seconds before it follows narration again.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const pause = () => { pausedUntil.current = Date.now() + 4000; };
    container.addEventListener("wheel", pause, { passive: true });
    container.addEventListener("touchmove", pause, { passive: true });
    container.addEventListener("pointerdown", pause, { passive: true });
    return () => {
      container.removeEventListener("wheel", pause);
      container.removeEventListener("touchmove", pause);
      container.removeEventListener("pointerdown", pause);
    };
  }, [scrollRef]);
  useEffect(() => {
    const container = scrollRef.current;
    const list = listRef.current;
    if (!container || !list) return;
    const update = () => {
      const view = container.getBoundingClientRect();
      const current = container.querySelector(".audiobook-sentence.is-active")?.getBoundingClientRect();
      if (current && current.top >= view.top && current.top < view.bottom) setResizeVersion(version => version + 1);
      setMargin(list.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop);
      virtualizer.measure();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fontSize, virtualizer, scrollRef, sentences]);

  const restored = useRef(false);
  const previousIndex = useRef(index);
  const previousFont = useRef(fontSize);
  const previousResize = useRef(resizeVersion);
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      if (!virtualizer.scrollElement) return;
      const initial = !restored.current;
      restored.current = true;
      const sought = previousIndex.current !== index && (!playing || Math.abs(previousIndex.current - index) > 1);
      const resized = previousFont.current !== fontSize || previousResize.current !== resizeVersion;
      previousIndex.current = index;
      previousFont.current = fontSize;
      previousResize.current = resizeVersion;
      if (!initial && !sought && !resized && (!playing || Date.now() < pausedUntil.current)) return;
      const container = scrollRef.current;
      if (!container) return;
      const instant = initial || sought || resized || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const reveal = (attempt: number) => {
        const target = container.querySelector(".audiobook-word.is-active") || container.querySelector("[data-audiobook-cursor]")
          || container.querySelector('[data-sentence="' + index + '"]');
        const view = container.getBoundingClientRect();
        const rect = target?.getBoundingClientRect();
        if (rect && rect.top >= view.top + view.height * 0.15 && rect.bottom <= view.top + view.height * 0.7) return;
        if (rect) container.scrollBy({ top: rect.top - view.top - view.height * 0.3, behavior: instant ? "auto" : "smooth" });
        else if (attempt < 4) {
          virtualizer.scrollToIndex(activeParagraph, { align: "center" });
          frame = requestAnimationFrame(() => reveal(attempt + 1));
        }
      };
      reveal(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [index, highlight, playing, activeParagraph, virtualizer, margin, fontSize, resizeVersion, scrollRef]);

  return <div ref={listRef} className="audiobook-virtual-text" style={{ height: virtualizer.getTotalSize() }}>
    {virtualizer.getVirtualItems().map(item => {
      const active = item.index >= activeParagraph && item.index <= lastParagraph;
      return <div key={item.key} data-index={item.index} ref={virtualizer.measureElement} className="audiobook-virtual-paragraph"
        style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}>
        <Paragraph paragraph={paragraphs[item.index]} activeIndex={active ? index : -1} activeEnd={active ? passageEnd : -1}
          highlight={active ? highlight : null} offset={active ? offset : 0} jump={stableJump} />
      </div>;
    })}
  </div>;
});
