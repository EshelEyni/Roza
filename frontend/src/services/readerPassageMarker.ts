import type { Rendition } from "epubjs";
import type { ReaderPassage } from "../../../shared/types/readerChat";

/** Own only the temporary locator marks, including their rendition and expiry. */
export class ReaderPassageMarker {
  private marks: { cfi: string; rendition: Rendition }[] = [];
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private currentRendition: () => Rendition | null | undefined) {}
  clear = () => {
    ++this.version;
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const { cfi, rendition } of this.marks) {
      if (this.currentRendition() === rendition)
        rendition.annotations.remove(cfi, "highlight");
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
      rendition.annotations.highlight(
        cfi,
        {},
        undefined,
        "reader-locator-" + color,
        {
          fill: color === "blue" ? "#a3c2ff" : "#f2e66b",
          "fill-opacity": "0.4",
          "mix-blend-mode": "multiply",
          "pointer-events": "none",
        },
      );
      this.marks.push({ cfi, rendition });
    }
    this.timer = setTimeout(this.clear, 2000);
  }
}
