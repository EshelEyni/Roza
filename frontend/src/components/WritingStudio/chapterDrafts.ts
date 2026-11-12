import {
  Chapter,
  ChapterDraft,
  SlateCustomElement,
} from "../../../../shared/types/books";

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
  const backup = createChapterDraft(
    chapter,
    `Previous Main · ${new Date().toLocaleString()}`,
  );
  return {
    ...chapter,
    text: structuredClone(draft.text),
    format: draft.format || chapter.format,
    annotations: structuredClone(draft.annotations || []),
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
