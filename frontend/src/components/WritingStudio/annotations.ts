import { Editor, Operation, Range, Text } from "slate";
import { ChapterAnnotation } from "../../../../shared/types/books";

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
