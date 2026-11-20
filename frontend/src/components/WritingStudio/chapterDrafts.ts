import {
  Chapter,
  ChapterDraft,
  SlateCustomElement,
} from "../../../../shared/types/books";

const previousMainName = "Previous Main";
const draftTimestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "medium",
});

export function draftDisplayName(draft: ChapterDraft): string {
  // Older backups stored the timestamp in the name as well as createdAt.
  return /^Previous Main · (?=.*\p{N})/u.test(draft.name) ? previousMainName : draft.name;
}

export function draftTimestamp(draft: ChapterDraft): string {
  const created = Date.parse(draft.createdAt);
  if (Number.isFinite(created)) return draftTimestampFormat.format(created);
  const updated = Date.parse(draft.updatedAt);
  return Number.isFinite(updated) ? draftTimestampFormat.format(updated) : "";
}

export function createChapterDraft(
  chapter: Chapter,
  name: string,
  blank = false,
): ChapterDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    chapterId: chapter.id,
    name: name.trim().slice(0, 200) || "Untitled draft",
    text: blank
      ? [{ type: "paragraph", children: [{ text: "" }] }]
      : structuredClone(chapter.text),
    annotations: blank ? [] : structuredClone(chapter.annotations || []),
    format: chapter.format || "prose",
    createdAt: now,
    updatedAt: now,
  };
}
export function promoteChapterDraft(chapter: Chapter, id: string): Chapter {
  const draft = chapter.drafts?.find((d) => d.id === id);
  if (!draft) throw new Error("Draft no longer exists.");
  const backup = createChapterDraft(chapter, previousMainName);
  return {
    ...chapter,
    text: structuredClone(draft.text),
    format: draft.format || chapter.format,
    annotations: structuredClone(draft.annotations || []),
    mainSourceDraftId: draft.id,
    drafts: [...(chapter.drafts || []), backup],
  };
}
export function changeChapterDraft(
  chapter: Chapter,
  id: string,
  change: {
    name?: string;
    text?: SlateCustomElement[];
    annotations?: ChapterDraft["annotations"];
  },
): Chapter {
  return {
    ...chapter,
    drafts: chapter.drafts?.map((d) =>
      d.id === id
        ? { ...d, ...change, updatedAt: new Date().toISOString() }
        : d,
    ),
  };
}
