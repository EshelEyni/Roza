/**
 * Browse book: lets the author read the live book inside Staging Room, so they can
 * find the text they want Claude to change. Read only.
 */
import type { BrowseOutline, BrowseText, EntityKind, LiveCopy, SlateElement, StagedChange } from "../../../../shared/types/stagingRoom";
import { ELEMENT_KINDS } from "./changes";
import { countWords, elementText } from "./slate";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const isElementKind = (value: unknown): value is EntityKind => ELEMENT_KINDS.includes(value as EntityKind);

export function browseOutline(live: LiveCopy | undefined, changes: StagedChange[]): BrowseOutline {
  const waiting = new Map<string, number>();
  for (const c of changes) if ("chapterId" in c) waiting.set(c.chapterId, (waiting.get(c.chapterId) ?? 0) + 1);
  return {
    linked: !!live,
    chapters: (live?.chapters ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      words: countWords(c.text),
      waiting: waiting.get(c.id) ?? 0,
      drafts: c.drafts,
    })),
    elements: Object.fromEntries(
      ELEMENT_KINDS.map((k) => [k, (live?.[k] ?? []).map((x) => ({ name: x.name, words: countWords(x.text) }))]),
    ) as BrowseOutline["elements"],
  };
}

const paragraphs = (text: SlateElement[] | undefined) =>
  (text ?? []).map((n) => ({ ...(n.align ? { align: n.align } : {}), text: elementText(n) }));

/**
 * One chapter version. "main" reads the live copy. A draft is read from the live book,
 * because the live copy keeps only draft names.
 */
export function chapterVersion(live: LiveCopy, liveBook: Raw | null, chapterId: string, version: string): BrowseText | null {
  const chapter = live.chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  if (version === "main") {
    return { title: chapter.name, subtitle: "Main", words: countWords(chapter.text), paragraphs: paragraphs(chapter.text) };
  }
  const raw = (liveBook?.chapters ?? []).find((c: Raw) => String(c._id) === chapterId);
  const draft = (raw?.drafts ?? []).find((d: Raw) => String(d.id) === version && d.kind !== "main-backup");
  if (!draft) return null;
  const text = Array.isArray(draft.text) ? (draft.text as SlateElement[]) : [];
  return { title: chapter.name, subtitle: `Draft “${String(draft.name ?? "")}”`, words: countWords(text), paragraphs: paragraphs(text) };
}

const SINGULAR: Record<EntityKind, string> = { characters: "Character", themes: "Theme", plotlines: "Plotline", notes: "Note" };

export function elementView(live: LiveCopy, kind: EntityKind, index: number): BrowseText | null {
  const item = live[kind][index];
  if (!item) return null;
  const colour = item.color ? [{ text: `Colour: ${item.color}` }] : [];
  return { title: item.name, subtitle: SINGULAR[kind], words: countWords(item.text), paragraphs: [...colour, ...paragraphs(item.text)] };
}
