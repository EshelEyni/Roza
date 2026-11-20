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

export function isMainBackup(draft: ChapterDraft): boolean {
  return draft.kind === "main-backup" || draft.name === previousMainName ||
    /^Previous Main · (?=.*\p{N})/u.test(draft.name);
}

export function draftDisplayName(draft: ChapterDraft): string {
  return isMainBackup(draft) ? "Main backup" : draft.name;
}

export function matchingMainDraft(chapter: Chapter, drafts: ChapterDraft[]): ChapterDraft | undefined {
  if (!chapter.text.length || drafts.length === 0) return;
  const text = JSON.stringify(chapter.text);
  const annotations = JSON.stringify(chapter.annotations ?? []);
  const format = chapter.format ?? "prose";
  const matches = drafts.filter(draft =>
    (draft.format ?? format) === format &&
    JSON.stringify(draft.text) === text &&
    JSON.stringify(draft.annotations ?? []) === annotations,
  );
  return matches.length === 1 ? matches[0] : undefined;
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
  const backup: ChapterDraft = { ...createChapterDraft(chapter, "Main backup"), kind: "main-backup" };
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
