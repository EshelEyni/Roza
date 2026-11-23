import { Types } from "mongoose";
import type { StagedChange } from "../../../../shared/types/stagingRoom";
import { browseOutline, chapterVersion, elementView, isElementKind } from "./browse";
import { liveCopyOf } from "./changes";

const para = (text: string) => ({ type: "paragraph", children: [{ text }] });
const at = "2026-11-22T10:00:00.000Z";
const ch1 = new Types.ObjectId();
const ch2 = new Types.ObjectId();

function liveBook() {
  return {
    _id: new Types.ObjectId(),
    name: "Ann",
    chapters: [
      {
        _id: ch1,
        name: "One",
        text: [para("Ann walks home.")],
        drafts: [
          { id: "d1", name: "Rewrite", kind: "draft", text: [para("Ann runs.")] },
          { id: "b1", name: "Backup", kind: "main-backup", text: [para("Old")] },
        ],
      },
      { _id: ch2, name: "Two", text: [para("Allan waits.")], isArchived: false },
    ],
    characters: [{ name: "Ann", description: [para("The lead")] }],
    themes: [{ name: "Loneliness", color: "#123456", description: [para("Alone")] }],
    plotlines: [],
    notes: [],
    updatedAt: new Date(at),
  };
}

const draft = (chapterId: string): StagedChange => ({
  id: "c1", kind: "draft", chapterId, name: "Claude", text: [], baseHash: "x", by: "connector", createdAt: at, updatedAt: at,
});

describe("browse", () => {
  it("lists chapters with waiting counts and drafts, and elements", () => {
    const book = liveBook();
    const outline = browseOutline(liveCopyOf(book), [draft(String(ch1))]);
    expect(outline.linked).toBe(true);
    expect(outline.chapters.map((c) => [c.name, c.words, c.waiting])).toEqual([["One", 3, 1], ["Two", 2, 0]]);
    expect(outline.chapters[0].drafts).toEqual([{ id: "d1", name: "Rewrite", words: 2 }]);
    expect(outline.elements.characters).toEqual([{ name: "Ann", words: 2 }]);
  });

  it("reports an unlinked book as empty", () => {
    expect(browseOutline(undefined, [])).toMatchObject({ linked: false, chapters: [] });
  });

  it("reads Main and drafts, but not backups", () => {
    const book = liveBook();
    const live = liveCopyOf(book);
    expect(chapterVersion(live, null, String(ch1), "main")?.paragraphs).toEqual([{ text: "Ann walks home." }]);
    expect(chapterVersion(live, book, String(ch1), "d1")).toMatchObject({ subtitle: "Draft “Rewrite”", words: 2 });
    expect(chapterVersion(live, book, String(ch1), "b1")).toBeNull();
    expect(chapterVersion(live, book, "missing", "main")).toBeNull();
  });

  it("reads story elements by index", () => {
    const live = liveCopyOf(liveBook());
    expect(elementView(live, "themes", 0)?.paragraphs.map((p) => p.text)).toEqual(["Colour: #123456", "Alone"]);
    expect(elementView(live, "characters", 5)).toBeNull();
    expect(isElementKind("themes")).toBe(true);
    expect(isElementKind("chapters")).toBe(false);
  });
});
