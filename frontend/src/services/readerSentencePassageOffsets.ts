import { EpubCFI } from "epubjs";
import { readerSentenceSelectionOffsets } from "./readerSentenceSelectionRange";

/** Clip a saved EPUB passage to a displayed sentence without changing its stored CFI. */
export function readerSentencePassageOffsets(
  source: Range,
  sectionIndex: number,
  passage: { cfi: string; endCfi?: string },
) {
  try {
    const doc = source.startContainer.ownerDocument!;
    const first = new EpubCFI(passage.cfi);
    const last = passage.endCfi ? new EpubCFI(passage.endCfi) : first;
    if (sectionIndex < first.spinePos || sectionIndex > last.spinePos) return null;
    const mark = sectionIndex === first.spinePos ? first.toRange(doc) : source.cloneRange();
    if (passage.endCfi) {
      const end = sectionIndex === last.spinePos ? last.toRange(doc) : source;
      mark.setEnd(end.endContainer, end.endOffset);
    }
    const offsets = readerSentenceSelectionOffsets(source, mark);
    return offsets && offsets.end > offsets.start ? offsets : null;
  } catch { return null; }
}
