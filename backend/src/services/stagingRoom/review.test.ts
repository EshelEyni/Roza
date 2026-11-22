import type { LocalChapterFile } from "../../../../shared/types/stagingRoom";
import { validateBook } from "./bookFiles";
import type { LoadedBook } from "./bookFiles";
import { addEvent, changedKeys, sourceOf } from "./history";
import { revertWith } from "./revert";
import { changeRuns, chapterParts, diffBlocks } from "./review";

const userId = "6a5e5e65ac5019850b04a505";
const para = (text: string) => ({ type: "paragraph", children: [{ text }] });
const noLog = () => undefined;
const backup = async () => "backup-1";
const cfg = { dbName: "test", host: "test" };

describe("review diff blocks", () => {
  it("finds one change between equal paragraphs and folds far context", () => {
    const studio = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const staging = ["a", "b", "c", "d", "e", "F!", "g", "h"];
    const blocks = diffBlocks(staging, studio, 1);
    expect(blocks[0]).toEqual({ kind: "skip", count: 4 });
    const change = blocks.find(b => b.kind === "change");
    expect(change).toEqual({ kind: "change", hunk: 0, staging: [{ n: 6, text: "F!" }], studio: [{ n: 6, text: "f" }] });
  });

  it("ignores changes that only add or remove blank paragraphs", () => {
    expect(diffBlocks(["a", "", "b"], ["a", "b"]).some(b => b.kind === "change")).toBe(false);
  });

  it("numbers changes the same way for display and for reject", () => {
    const staging = ["x", "same", "y", "same2", "z"];
    const studio = ["X", "same", "same2", "Z"];
    const ids = diffBlocks(staging, studio).flatMap(b => (b.kind === "change" ? [b.hunk] : []));
    expect(ids).toEqual([0, 1, 2]);
    expect(changeRuns(staging, studio)).toEqual([
      { a0: 0, a1: 1, b0: 0, b1: 1 },
      { a0: 2, a1: 3, b0: 2, b1: 2 },
      { a0: 4, a1: 5, b0: 3, b1: 4 },
    ]);
  });

  it("splits a chapter into text, notes and drafts parts", () => {
    const base = { name: "One", format: "prose", planning: {} };
    const parts = chapterParts(
      { ...base, text: [para("Hi."), para("New line.")], annotations: [{ id: "n1", content: "added", quote: "Hi.", anchor: null }], drafts: [] },
      { ...base, text: [para("Hi.")], annotations: [], drafts: [{ id: "d1", chapterId: "c", name: "Version 2", text: [para("Old")], createdAt: "", updatedAt: "" }] },
    );
    expect(parts.map(p => [p.id, p.changes])).toEqual([["text", 1], ["notes", 1], ["drafts", 1]]);
    expect(parts[1].items?.[0].change).toBe("added");
    expect(parts[2].items?.[0].change).toBe("removed");
  });

  it("names the promoted draft instead of showing its id", () => {
    const draft = (id: string, name: string) => ({ id, chapterId: "c", name, text: [], createdAt: "", updatedAt: "" });
    const base = { name: "One", format: "prose", planning: {}, text: [para("Hi.")] };
    const parts = chapterParts(
      { ...base, mainSourceDraftId: "d2", drafts: [draft("d2", "Version 2")] },
      { ...base, mainSourceDraftId: "gone", drafts: [] },
    );
    const info = parts.find(p => p.id === "details");
    expect(info?.label).toBe("Chapter info");
    const lines = info?.blocks?.flatMap(b => (b.kind === "change" ? [...b.staging, ...b.studio].map(l => l.text) : []));
    expect(lines).toEqual(["Promoted to Main from draft “Version 2”", "Promoted to Main from a draft that is no longer in this chapter"]);
  });
});

function project(text: string[], annotations: LocalChapterFile["annotations"]): LoadedBook {
  const book = { bookName: "Ann", userId, language: "en" };
  const chapters = [{ file: "01.json", data: { number: 1, name: "One", format: "prose" as const, text: text.map(para), annotations } }];
  return { slug: "ann", book, chapters, state: { chapters: { "01.json": "6a5e5e65ac5019850b04a5aa" } }, errors: validateBook(book, chapters) };
}

const prod = (text: string[]) => ({
  _id: "6a5e5e65ac5019850b04a5bb",
  name: "Ann",
  userId,
  chapters: [{ _id: "6a5e5e65ac5019850b04a5aa", name: "One", format: "prose", text: text.map(para), annotations: [] }],
});

describe("reject", () => {
  it("puts back only the chosen text change and keeps notes on their text", async () => {
    const note = { id: "n1", content: "keep", quote: "end", anchor: { anchor: { path: [3, 0], offset: 0 }, focus: { path: [3, 0], offset: 3 } } };
    const loaded = project(["one", "TWO A", "TWO B", "end"], [note]);
    const live = prod(["one", "two", "end"]);
    const result = await revertWith(cfg, loaded, [{ key: "01.json", part: "text", hunk: 0 }], backup, live, noLog);
    expect(result.reverted).toBe(1);
    const data = loaded.chapters[0].data;
    expect(data.text.map(n => (n.children[0] as { text: string }).text)).toEqual(["one", "two", "end"]);
    expect(data.annotations?.[0].anchor?.anchor.path).toEqual([2, 0]);
  });

  it("removes a chapter that only Staging has", async () => {
    const loaded = project(["one"], undefined);
    loaded.chapters.push({ file: "02.json", data: { number: 2, name: "Two", format: "prose", text: [para("new")] } });
    await revertWith(cfg, loaded, [{ key: "02.json" }], backup, prod(["one"]), noLog);
    expect(loaded.chapters.map(c => c.file)).toEqual(["01.json"]);
  });

  it("puts back one note by id", async () => {
    const loaded = project(["one"], [{ id: "x", content: "from Claude", quote: "one", anchor: null }]);
    await revertWith(cfg, loaded, [{ key: "01.json", part: "notes", itemId: "x" }], backup, prod(["one"]), noLog);
    expect(loaded.chapters[0].data.annotations).toEqual([]);
  });
});

describe("history", () => {
  it("records which items a step changed, and the source of each item", () => {
    const before = { book: { bookName: "Ann", userId, characters: { Ann: "a" } }, chapters: [{ file: "01.json", data: { number: 1, name: "One", text: [para("a")] } }], state: { chapters: { "01.json": "id1" } } };
    const after = { book: { bookName: "Ann", userId, wordGoal: 5, characters: { Ann: "b" } }, chapters: [] };
    expect(changedKeys(before, after).sort()).toEqual(["01.json", "book:settings", "characters:Ann", "prod:id1"]);

    let history = addEvent([], { source: "import", summary: "Imported", keys: [] });
    history = addEvent(history, { source: "connector", clientId: "c1", summary: "Edited", keys: ["characters:Ann"] });
    const names = new Map([["c1", "Claude"]]);
    expect(sourceOf(history, "characters:Ann", names)?.name).toBe("Claude");
    expect(sourceOf(history, "01.json", names)?.name).toBe("Folder import");
  });

  it("joins editor saves made close together into one step", () => {
    let history = addEvent([], { source: "editor", summary: "Edited One", keys: ["01.json"] });
    history = addEvent(history, { source: "editor", summary: "Edited Two", keys: ["02.json"] });
    expect(history).toHaveLength(1);
    expect(history[0].keys).toEqual(["01.json", "02.json"]);
  });
});
