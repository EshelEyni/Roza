import { bindNativeHighlight } from "./readerNativeHighlight";
import type { Rendition } from "epubjs";
import type { ReaderPassage } from "../../../shared/types/readerChat";

// epub.js keys highlights by CFI, so overlapping owners must share one annotation.
const layers = new WeakMap<Rendition, Map<string, { owner: ReaderPassageMarker; draw: () => void; cleanup: () => void }[]>>();

/** Own passage and translation marks without leaving duplicate SVG annotations. */
export class ReaderPassageMarker {
  private marks: { cfi: string; rendition: Rendition }[] = [];
  private version = 0;
  constructor(
    private currentRendition: () => Rendition | null | undefined,
    private markerColor?: (color: "blue" | "yellow") => string | undefined,
    private markerTextColor?: (color: "blue" | "yellow") => string | undefined,
    private markerClass?: string,
  ) {}
  clear = () => {
    ++this.version;
    for (const { cfi, rendition } of this.marks) {
      const byRange = layers.get(rendition);
      const stack = byRange?.get(cfi);
      if (!stack) continue;
      stack.filter(layer => layer.owner === this).forEach(layer => layer.cleanup());
      const wasVisible = stack[stack.length - 1]?.owner === this;
      const remaining = stack.filter(layer => layer.owner !== this);
      if (remaining.length) byRange!.set(cfi, remaining);
      else byRange!.delete(cfi);
      if (wasVisible && this.currentRendition() === rendition) {
        rendition.annotations.remove(cfi, "highlight");
        remaining[remaining.length - 1]?.draw();
      }
    }
    this.marks = [];
  };
  async show(
    passage: ReaderPassage,
    color: "blue" | "yellow",
    ranges: (passage: ReaderPassage) => Promise<string[]>,
  ) {
    this.clear();
    const version = this.version;
    const rendition = this.currentRendition();
    if (!rendition) return;
    const pieces = await ranges(passage);
    if (version !== this.version || this.currentRendition() !== rendition)
      return;
    for (const cfi of pieces) {
      let cleanup = () => {};
      const draw = () => {
        cleanup();
        const background = this.markerColor?.(color) || (color === "blue" ? "#a3c2ff" : "#f2e66b");
        const annotation = rendition.annotations.highlight(
        cfi,
        {},
        undefined,
        this.markerClass || "reader-locator-" + color,
        {
          fill: background,
          "fill-opacity": "1",
          "mix-blend-mode": "multiply",
          "pointer-events": "none",
        },
      );
        cleanup = bindNativeHighlight(annotation, background, this.markerTextColor?.(color) || "#28231e");
      };
      let byRange = layers.get(rendition);
      if (!byRange) { byRange = new Map(); layers.set(rendition, byRange); }
      const stack = byRange.get(cfi) || [];
      if (stack.length) { stack[stack.length - 1].cleanup(); rendition.annotations.remove(cfi, "highlight"); }
      stack.push({ owner: this, draw, cleanup: () => cleanup() });
      byRange.set(cfi, stack);
      draw();
      this.marks.push({ cfi, rendition });
    }
  }
}
