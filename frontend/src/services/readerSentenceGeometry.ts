export type SentenceWordRect = {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};
export type SentenceVisualLine = {
  centerY: number;
  height: number;
  words: SentenceWordRect[];
};

/** Measure glyph rectangles, excluding disabled note markers and keeping wrapped fragments. */
export function measureSentenceLines(
  element: HTMLElement,
): SentenceVisualLine[] {
  const origin = element.getBoundingClientRect();
  const fragments: SentenceWordRect[] = [];
  element.querySelectorAll("[data-sentence-word]").forEach((word, index) => {
    const walker = element.ownerDocument.createTreeWalker(word, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest(".reader-sentence-note")) continue;
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (!rect.width || !rect.height) continue;
        fragments.push({
          index,
          left: rect.left - origin.left,
          right: rect.right - origin.left,
          top: rect.top - origin.top,
          bottom: rect.bottom - origin.top,
        });
      }
    }
  });
  return groupSentenceWordRects(fragments);
}

export function groupSentenceWordRects(fragments: SentenceWordRect[]): SentenceVisualLine[] {
  const lines: SentenceVisualLine[] = [];
  for (const fragment of fragments) {
    const { index, left, right, top, bottom } = fragment;
    const centerY = (top + bottom) / 2;
    const height = bottom - top;
    let line = lines.find(candidate =>
      Math.abs(candidate.centerY - centerY) < Math.min(candidate.height, height) * 0.35,
    );
    if (!line) {
      line = { centerY, height, words: [] };
      lines.push(line);
    }
    const word = line.words.find(word => word.index === index);
    if (word) {
      word.left = Math.min(word.left, left);
      word.right = Math.max(word.right, right);
      word.top = Math.min(word.top, top);
      word.bottom = Math.max(word.bottom, bottom);
    } else line.words.push(fragment);
  }
  return lines.sort((a, b) => a.centerY - b.centerY);
}

export function closestSentenceWord(
  line: SentenceVisualLine,
  x: number,
): number {
  const distance = (word: SentenceWordRect) =>
    Math.max(word.left - x, 0, x - word.right);
  return line.words.reduce((best, word) =>
    distance(word) < distance(best) ? word : best,
  ).index;
}
