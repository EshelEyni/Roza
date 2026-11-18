import { Editor, Element, Operation, Range, Text } from "slate";
import { ChapterAnnotation } from "../../../../shared/types/books";
import { readerSentenceSpans } from "../../services/readerSentenceSpans";

export function validAnchor(
  editor: Editor,
  range: Range | null,
): range is Range {
  if (!range) return false;
  return [range.anchor, range.focus].every(point => {
    if (!Editor.hasPath(editor, point.path)) return false;
    const [node] = Editor.node(editor, point.path);
    return (
      Text.isText(node) && point.offset >= 0 && point.offset <= node.text.length
    );
  });
}
export function annotationSentenceRange(
  editor: Editor,
  anchor: Range | null,
  language?: string,
): Range | undefined {
  if (!validAnchor(editor, anchor)) return;
  const start = Range.start(anchor);
  const block = Editor.above(editor, {
    at: start,
    match: node => Element.isElement(node) && Editor.isBlock(editor, node),
  });
  if (!block) return;

  const [, path] = block;
  const text = Editor.string(editor, path);
  const offset = Editor.string(editor, Editor.range(editor, Editor.start(editor, path), start)).length;
  const sentence = readerSentenceSpans(
    text.replace(/\r?\n(?:[\t ]*\r?\n)+/g, breaks => "\u2029".repeat(breaks.length)),
    language,
  ).find(span => span.end > offset);
  if (!sentence) return;

  let leafStart = 0;
  let sentenceStart: Range["anchor"] | undefined;
  for (const [leaf, leafPath] of Editor.nodes<Text>(editor, { at: path, match: Text.isText })) {
    const leafEnd = leafStart + leaf.text.length;
    if (!sentenceStart && sentence.start < leafEnd) {
      sentenceStart = { path: leafPath, offset: sentence.start - leafStart };
    }
    if (sentenceStart && sentence.end <= leafEnd) {
      return { anchor: sentenceStart, focus: { path: leafPath, offset: sentence.end - leafStart } };
    }
    leafStart = leafEnd;
  }
}

export function transformAnnotations(
  notes: ChapterAnnotation[],
  operation: Operation,
) {
  if (operation.type === "set_selection") return notes;
  return notes.map(note => {
    if (!note.anchor) return note;
    const anchor = Range.transform(note.anchor, operation, {
      affinity: Range.isCollapsed(note.anchor) ? "backward" : "inward",
    });
    // Preserve the note, but never silently reattach deleted text to its neighbor.
    return {
      ...note,
      anchor:
        anchor && !(Range.isExpanded(note.anchor) && Range.isCollapsed(anchor))
          ? anchor
          : null,
    };
  });
}
/** Compact cards flow down the margin; only the active card expands. */
export function layoutAnnotations(
  notes: { id: string; top: number; height?: number }[],
  active: string | null,
  expandedHeight: number,
) {
  let bottom = -Infinity;
  const selected = notes.find(note => note.id === active);
  return [...notes]
    .sort((a, b) => a.top - b.top)
    .map(note => {
      if (note.id === active) return note;
      let top = Math.max(note.top, bottom);
      if (
        selected &&
        top + (note.height || 32) + 8 > selected.top &&
        top < selected.top + expandedHeight + 8
      )
        top = selected.top + expandedHeight + 8;
      bottom = top + (note.id === active ? expandedHeight : (note.height || 32)) + 8;
      return { ...note, top };
    })
    .sort((a, b) => a.top - b.top);
}
