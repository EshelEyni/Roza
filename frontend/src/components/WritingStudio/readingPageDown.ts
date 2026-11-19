export interface VerticalBounds {
  top: number;
  bottom: number;
}

/** Fraction of the visible height that one Page Down step covers, matching Chromium's paging step. */
export const pageStepFraction = 0.875;

/**
 * Scroll distance for one Page Down press that keeps the selected sentence visible, or
 * `undefined` when the sentence is offscreen and native paging should apply.
 *
 * `rects` are the sentence's client rects and `view` is the uncovered part of the scroller,
 * both in viewport coordinates. A sentence that fits and whose top edge is visible stays
 * entirely visible; a taller or already clipped sentence keeps its last line readable.
 */
export function readingPageDownDelta(
  rects: readonly VerticalBounds[],
  view: VerticalBounds,
  step = (view.bottom - view.top) * pageStepFraction,
): number | undefined {
  const lines = rects.filter(rect => rect.bottom > rect.top);
  if (!lines.length || view.bottom <= view.top) return undefined;
  const top = Math.min(...lines.map(rect => rect.top));
  const bottom = Math.max(...lines.map(rect => rect.bottom));
  if (bottom <= view.top || top >= view.bottom) return undefined;

  let limit: number;
  if (top >= view.top && bottom - top <= view.bottom - view.top) {
    limit = top - view.top;
  } else {
    const lastStart = Math.max(...lines.map(rect => rect.top));
    const lastLineTop = Math.min(...lines.filter(rect => rect.bottom > lastStart).map(rect => rect.top));
    limit = lastLineTop - view.top;
  }
  return Math.max(0, Math.min(step, Math.floor(limit)));
}
