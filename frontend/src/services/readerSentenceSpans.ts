/** Sentence offsets preserve punctuation and inline text; paragraph breaks are explicit. */
export function readerSentenceSpans(
  text: string,
  language = "en",
): { start: number; end: number }[] {
  type Segment = { index: number; segment: string };
  type Segmenter = { segment: (value: string) => Iterable<Segment> };
  const constructor = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locale: string,
        options: { granularity: "sentence" },
      ) => Segmenter;
    }
  ).Segmenter;
  let segmenter: Segmenter | undefined;
  if (constructor) {
    try {
      segmenter = new constructor(language, { granularity: "sentence" });
    } catch {
      segmenter = new constructor("en", { granularity: "sentence" });
    }
  }
  const spans: { start: number; end: number }[] = [];
  let offset = 0;
  for (const paragraph of text.split("\u2029")) {
    const segments: Iterable<Segment> = segmenter
      ? segmenter.segment(paragraph)
      : Array.from(
          paragraph.matchAll(/[^.!?。！？]+(?:[.!?。！？]+["'’”»)\]]*|$)/gu),
          (match) => ({ index: match.index!, segment: match[0] }),
        );
    for (const { index, segment } of segments) {
      const leading = segment.length - segment.trimStart().length;
      const end = offset + index + segment.trimEnd().length;
      const start = offset + index + leading;
      if (end > start) spans.push({ start, end });
    }
    offset += paragraph.length + 1;
  }
  return spans;
}
