import type { ChapterAnnotation, SlateElement } from "../../../shared/types/stagingRoom";
import { ConnectorError } from "./connectorError";
import { markdownToSlate, slateToMarkdown } from "./slateMarkdown";
import { findQuote, reattachNotes } from "../services/stagingRoom/fullData";

// Small text edits for the Claude connector (staging_edit_text).
//
// Each edit is a find/replace on the chapter's Markdown, where paragraphs are joined
// by a blank line ("\n\n"). Only the paragraphs an edit touches are rebuilt. Every
// other paragraph keeps its exact Slate node (alignment, screenplay types, ...).

export type TextEdit = { find: string; replace: string };
export type EditPreview = { edit: number; before: string; after: string };

export const MAX_EDITS = 50;
const SEP = "\n\n";
const PREVIEW_CHARS = 3000;

const LIST_TYPES = new Set(["bulleted-list", "numbered-list"]);
const MARKDOWN_TYPES = new Set(["heading-one", "heading-two", "block-quote"]);

/** The block type a block becomes after a trip through Markdown. */
const markdownType = (type: string) => (MARKDOWN_TYPES.has(type) || LIST_TYPES.has(type) ? type : "paragraph");

const blockMarkdown = (block: SlateElement) => slateToMarkdown([block]);
const short = (text: string, max = 80) => {
  const flat = text.replace(/\n/g, "\\n");
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};
const cap = (text: string) => (text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text);

/** Up to `limit` start positions of `find` in `text`, overlaps included. */
function positions(text: string, find: string, limit = 2): number[] {
  const out: number[] = [];
  for (let at = text.indexOf(find); at >= 0 && out.length < limit; at = text.indexOf(find, at + 1)) out.push(at);
  return out;
}

/**
 * A rebuilt block keeps the original block's type, alignment and other fields, unless
 * the edit changed what kind of block it is (for example a paragraph into a heading).
 */
function adopt(template: SlateElement, parsed: SlateElement): SlateElement {
  if (LIST_TYPES.has(template.type) || LIST_TYPES.has(parsed.type)) return parsed;
  if (parsed.type !== markdownType(template.type)) return parsed;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children: _old, ...fields } = template;
  return { ...fields, ...(parsed.align && !fields.align ? { align: parsed.align } : {}), children: parsed.children };
}

/** Applies one edit. Throws (and changes nothing) when `find` is missing or not unique. */
function applyOne(blocks: SlateElement[], edit: TextEdit, number: number, total: number) {
  const label = total > 1 ? `Edit ${number} of ${total}` : "The edit";
  const md = blocks.map(blockMarkdown);
  const starts: number[] = [];
  let pos = 0;
  for (const text of md) {
    starts.push(pos);
    pos += text.length + SEP.length;
  }
  const doc = md.join(SEP);
  const hits = positions(doc, edit.find);
  if (!hits.length)
    throw new ConnectorError(
      `${label}: "${short(edit.find)}" was not found. Match the Markdown exactly as staging_get_chapter shows it ` +
        "(including **bold**, *italic* and escaped characters like \\*). Nothing was saved.",
    );
  if (hits.length > 1)
    throw new ConnectorError(`${label}: "${short(edit.find)}" appears more than once. Add nearby words so it matches once. Nothing was saved.`);

  const at = hits[0];
  const end = at + edit.find.length;
  let first = 0;
  while (first + 1 < blocks.length && starts[first + 1] <= at) first++;
  let last = first;
  while (last + 1 < blocks.length && starts[last + 1] < end) last++;
  const segStart = starts[first];
  const segEnd = Math.max(starts[last] + md[last].length, end);
  const before = doc.slice(segStart, segEnd);
  const after = before.slice(0, at - segStart) + edit.replace + before.slice(end - segStart);

  const templates = blocks.slice(first, last + 1);
  const templateText = md.slice(first, last + 1);
  const pieces = after
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim());
  const rebuilt: SlateElement[] = [];
  let next = 0; // the first template not used yet
  for (const piece of pieces) {
    const same = templateText.indexOf(piece, next);
    if (same >= 0) {
      // An untouched paragraph inside the edited range: keep its node as it is.
      rebuilt.push(templates[same]);
      next = same + 1;
      continue;
    }
    const template = templates[Math.min(next, templates.length - 1)];
    for (const parsed of markdownToSlate(piece) as unknown as SlateElement[]) rebuilt.push(adopt(template, parsed));
    if (next < templates.length - 1) next++;
  }

  const text = [...blocks.slice(0, first), ...rebuilt, ...blocks.slice(last + 1)];
  return { text, preview: { edit: number, before: cap(before), after: cap(rebuilt.map(blockMarkdown).join(SEP)) } };
}

/** Applies the edits in order. All or nothing: any failing edit throws before anything is saved. */
export function applyEdits(text: SlateElement[], edits: TextEdit[]): { text: SlateElement[]; previews: EditPreview[] } {
  if (!edits.length) throw new ConnectorError("edits is empty.");
  if (edits.length > MAX_EDITS) throw new ConnectorError(`Send at most ${MAX_EDITS} edits per call.`);
  let blocks = text;
  const previews: EditPreview[] = [];
  edits.forEach((edit, i) => {
    if (!edit.find) throw new ConnectorError(`Edit ${i + 1}: find is empty. Nothing was saved.`);
    const done = applyOne(blocks, edit, i + 1, edits.length);
    blocks = done.text;
    previews.push(done.preview);
  });
  if (!blocks.length) throw new ConnectorError("These edits would leave the chapter empty. Nothing was saved.");
  return { text: blocks, previews };
}

export type LostNote = { content: string; quote: string };

/**
 * Keeps notes on the same sentence after the text changed. Each note is found again by
 * its quote, not by its old position. A note whose quote is gone becomes a general note
 * on the chapter. It is never removed.
 */
export function followNotes(text: SlateElement[], notes: ChapterAnnotation[] | undefined): { notes: ChapterAnnotation[] | undefined; lost: LostNote[] } {
  if (!notes) return { notes, lost: [] };
  const lost: LostNote[] = [];
  const out = notes.map((n) => {
    if (n.general || !n.quote) return n;
    if (n.anchor) {
      const [moved] = reattachNotes(text, [n]).notes!;
      if (moved.anchor) return moved;
    } else if (findQuote(text, n.quote)) return n; // anchored on approval
    lost.push({ content: short(n.content, 120), quote: short(n.quote, 120) });
    return { ...n, anchor: null, general: true };
  });
  return { notes: out, lost };
}

/** Adds new notes to the existing ones. Notes already there (same quote and content) are not added twice. */
export function mergeNotes(existing: ChapterAnnotation[] | undefined, added: ChapterAnnotation[] | undefined): ChapterAnnotation[] | undefined {
  if (!added?.length) return existing;
  const have = existing ?? [];
  const fresh = added.filter((a) => !have.some((e) => e.content === a.content && (e.quote ?? "") === (a.quote ?? "")));
  return [...have, ...fresh];
}
