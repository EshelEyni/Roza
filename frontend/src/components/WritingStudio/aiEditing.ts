import { Editor, Node, Range, Point, Text, Transforms } from "slate";
import { HistoryEditor, MERGING } from "slate-history";

export type Difference = { type: "same" | "remove" | "add"; text: string };
// Bounded word LCS: very long replacements use a linear prefix/suffix fallback.
export function wordDiff(before: string, after: string): Difference[] {
  const a = before.match(/\s+|[^\s]+/gu) || [],
    b = after.match(/\s+|[^\s]+/gu) || [];
  const result: Difference[] = [];
  const push = (type: Difference["type"], text: string) => {
    if (!text) return;
    if (result[result.length - 1]?.type === type)
      result[result.length - 1].text += text;
    else result.push({ type, text });
  };
  if (a.length * b.length > 250000) {
    let first = 0,
      last = 0;
    while (first < a.length && first < b.length && a[first] === b[first])
      first++;
    while (
      last < a.length - first &&
      last < b.length - first &&
      a[a.length - 1 - last] === b[b.length - 1 - last]
    )
      last++;
    push("same", a.slice(0, first).join(""));
    push("remove", a.slice(first, a.length - last).join(""));
    push("add", b.slice(first, b.length - last).join(""));
    push("same", a.slice(a.length - last).join(""));
    return result;
  }
  const rows = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      rows[i][j] =
        a[i] === b[j]
          ? rows[i + 1][j + 1] + 1
          : Math.max(rows[i + 1][j], rows[i][j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push("same", a[i++]);
      j++;
    } else if (
      i < a.length &&
      (j === b.length || rows[i + 1][j] >= rows[i][j + 1])
    )
      push("remove", a[i++]);
    else push("add", b[j++]);
  }
  return result;
}

// Every UTF-16 boundary maps back to a Slate point, including block separators.
export function rangeText(editor: Editor, range: Range) {
  let text = "",
    previousBlock = "";
  const points: Point[] = [];
  for (const [node, path] of Node.texts(editor)) {
    if (!Text.isText(node)) continue;
    const intersection = Range.intersection(range, Editor.range(editor, path));
    if (!intersection) continue;
    const [start, end] = Range.edges(intersection);
    const block = Editor.above(editor, {
      at: path,
      match: (n) =>
        !Editor.isEditor(n) && !Text.isText(n) && Editor.isBlock(editor, n),
      mode: "lowest",
    });
    const blockKey = block?.[1].join(".") || "";
    if (points.length && blockKey !== previousBlock) {
      text += "\n";
      points.push(start);
    }
    if (!points.length) points.push(start);
    // At a mark boundary, prefer the next leaf's start for insertions.
    points[points.length - 1] = start;
    for (let offset = start.offset; offset < end.offset; offset++) {
      text += node.text[offset];
      points.push({ path, offset: offset + 1 });
    }
    previousBlock = blockKey;
  }
  return { text, points };
}
export type EditSnapshot = { range: Range; original: string; document: string };
export function captureEdit(editor: Editor, range: Range): EditSnapshot {
  return {
    range: structuredClone(range),
    original: rangeText(editor, range).text,
    document: JSON.stringify(editor.children),
  };
}
export const isCurrentEdit = (editor: Editor, snapshot: EditSnapshot) =>
  JSON.stringify(editor.children) === snapshot.document;

export function replaceEditedText(
  editor: Editor,
  snapshot: EditSnapshot,
  revision: string,
): boolean {
  if (!isCurrentEdit(editor, snapshot)) return false;
  const { points } = rangeText(editor, snapshot.range);
  const edits: { start: number; end: number; text: string }[] = [];
  let offset = 0;
  for (const part of wordDiff(snapshot.original, revision)) {
    if (part.type === "same") {
      offset += part.text.length;
      continue;
    }
    let edit = edits[edits.length - 1];
    if (!edit || edit.end !== offset) {
      edit = { start: offset, end: offset, text: "" };
      edits.push(edit);
    }
    if (part.type === "remove") {
      offset += part.text.length;
      edit.end = offset;
    } else edit.text += part.text;
  }
  const apply = () =>
    Editor.withoutNormalizing(editor, () => {
      for (const edit of edits.reverse()) {
        Transforms.select(editor, {
          anchor: points[edit.start],
          focus: points[edit.end],
        });
        if (edit.end > edit.start) Transforms.delete(editor);
        const lines = edit.text.split("\n");
        lines.forEach((line, index) => {
          if (index) editor.insertBreak();
          if (line) editor.insertText(line);
        });
      }
    });
  if (HistoryEditor.isHistoryEditor(editor)) {
    const previous = MERGING.get(editor),
      originalApply = editor.apply;
    MERGING.set(editor, false);
    editor.apply = (op) => {
      originalApply(op);
      if (op.type !== "set_selection") MERGING.set(editor, true);
    };
    try {
      apply();
    } finally {
      editor.apply = originalApply;
      MERGING.set(editor, previous);
    }
  } else apply();
  return true;
}
