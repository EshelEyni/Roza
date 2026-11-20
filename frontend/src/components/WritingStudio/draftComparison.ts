import { Node, type Range } from "slate";
import type { SlateCustomElement } from "../../../../shared/types/books";
import { wordDiff } from "./aiEditing";

export type DraftComparisonMark = Range & {
  draftAddition?: boolean;
  draftDeletion?: string;
  draftAddedBreak?: boolean;
};

export function compareDraftText(mainText: string, draftText: string, blocks: SlateCustomElement[]) {
  const marks = new Map<string, DraftComparisonMark[]>();
  let blockStart = 0;
  const leaves = blocks.flatMap((block, index) => {
    let start = blockStart;
    const blockLeaves = Array.from(Node.texts(block), ([node, path]) => {
      const leaf = { path: [index, ...path], start, end: start + node.text.length };
      start = leaf.end;
      return leaf;
    });
    blockStart = start + 1; // plainText joins top-level blocks with a newline.
    return blockLeaves;
  });
  if (!leaves.length) leaves.push({ path: [0, 0], start: 0, end: 0 });

  const addMark = (mark: DraftComparisonMark) => {
    const key = mark.anchor.path.join(".");
    const existing = marks.get(key);
    if (existing) existing.push(mark);
    else marks.set(key, [mark]);
  };

  let offset = 0;
  let leafIndex = 0;
  let count = 0;
  let inChange = false;
  for (const part of wordDiff(mainText, draftText)) {
    if (part.type === "same") {
      offset += part.text.length;
      inChange = false;
      continue;
    }
    if (!inChange) count++;
    inChange = true;
    while (leafIndex + 1 < leaves.length && leaves[leafIndex + 1].start <= offset) leafIndex++;
    if (part.type === "remove") {
      const leaf = leaves[leafIndex];
      const point = { path: leaf.path, offset: Math.min(offset, leaf.end) - leaf.start };
      addMark({ anchor: point, focus: point, draftDeletion: part.text });
      continue;
    }

    const end = offset + part.text.length;
    for (let index = leafIndex; index < leaves.length && leaves[index].start < end; index++) {
      const leaf = leaves[index];
      const startOffset = Math.max(offset, leaf.start) - leaf.start;
      const endOffset = Math.min(end, leaf.end) - leaf.start;
      if (startOffset < endOffset) {
        addMark({
          anchor: { path: leaf.path, offset: startOffset },
          focus: { path: leaf.path, offset: endOffset },
          draftAddition: true,
        });
      }
      if (leaves[index + 1]?.start > leaf.end && offset <= leaf.end && leaf.end < end) {
        const point = { path: leaf.path, offset: leaf.end - leaf.start };
        addMark({ anchor: point, focus: point, draftAddedBreak: true });
      }
    }
    offset = end;
  }
  return { count, marks };
}
