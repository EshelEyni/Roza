import mongoose, { Types } from "mongoose";
import type { StagedChange } from "../../../../shared/types/stagingRoom";
import { approveChanges, changeViews, liveCopyOf, readView, textHash } from "./changes";
import { changesFromCopy } from "./project";
import { markNew } from "./textDiff";

const para = (text: string) => ({ type: "paragraph", children: [{ text }] });
const userId = new Types.ObjectId();
const bookId = new Types.ObjectId();
const ch1 = new Types.ObjectId();
const ch2 = new Types.ObjectId();
const at = "2026-11-22T10:00:00.000Z";

function liveBook() {
  const chapter = (id: Types.ObjectId, name: string, text: string) => ({
    _id: id, bookId, type: "chapters", name, format: "prose", description: [para("")], text: [para(text)],
    createdAt: new Date(at), updatedAt: new Date(at),
  });
  return {
    _id: bookId, userId, name: "Ann", filterBy: "chapters",
    chapters: [chapter(ch1, "One", "Ann walks."), chapter(ch2, "Two", "Allan waits.")],
    characters: [{ _id: new Types.ObjectId(), bookId, type: "characters", name: "Ann", description: [para("Lead")], createdAt: new Date(at), updatedAt: new Date(at) }],
    themes: [], plotlines: [], notes: [],
    createdAt: new Date(at), updatedAt: new Date(at),
  };
}

/** A deep copy that keeps ObjectIds and Dates, like the MongoDB driver returns them. */
function copy<T>(value: T): T {
  if (value instanceof Types.ObjectId || value instanceof Date || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copy) as T;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v)])) as T;
}

/** A connection with one book and no database. Records the last update. */
function fakeConn(book: Record<string, unknown>) {
  const writes: { filter: unknown; update: Record<string, Record<string, unknown>> }[] = [];
  const conn = {
    models: {} as Record<string, unknown>,
    model: (name: string, schema: mongoose.Schema, coll: string) => mongoose.models[name] || mongoose.model(name, schema, coll),
    collection: () => ({
      findOne: async () => copy(book),
      updateOne: async (filter: unknown, update: Record<string, Record<string, unknown>>) => {
        writes.push({ filter, update });
        return { matchedCount: 1 };
      },
    }),
  };
  return { conn: conn as unknown as mongoose.Connection, writes };
}

const base = (id: string) => ({ id, createdAt: at, updatedAt: at, by: "connector" as const });
const project = { userId: String(userId), bookName: "Ann", liveBookId: String(bookId) };
const noBackup = async () => undefined;

describe("reading view", () => {
  it("marks only new words and never shows removed text", () => {
    const segs = markNew(["Ann walks home slowly.", "New line."], ["Ann walks fast."]);
    expect(segs[0].filter((s) => s.isNew).map((s) => s.text.trim())).toEqual(["home slowly."]);
    expect(segs[0].map((s) => s.text).join("")).toBe("Ann walks home slowly.");
    expect(segs[1]).toEqual([{ text: "New line.", isNew: true }]);
  });

  it("reads a draft against the live Main", () => {
    const live = liveCopyOf(liveBook());
    const draft: StagedChange = { ...base("d"), kind: "draft", chapterId: String(ch1), name: "Claude", text: [para("Ann walks away.")], baseHash: live.chapters[0].mainHash };
    const view = readView(draft, live);
    expect(view.title).toBe("One");
    expect(view.paragraphs[0].segments.some((s) => s.isNew && s.text.includes("away"))).toBe(true);
    expect(changeViews([draft], live)[0]).toMatchObject({ tag: "NEW DRAFT", group: { type: "chapter", name: "One" } });
  });
});

describe("old copies and imported folders", () => {
  it("turn into drafts, new chapters and element changes, never removals", () => {
    const live = liveCopyOf(liveBook());
    const changes = changesFromCopy(
      {
        book: { bookName: "Ann", userId: String(userId), characters: { Ann: "Lead", Dona: "New friend" } },
        chapters: [
          { file: "01.json", data: { number: 1, name: "One", text: [para("Ann walks.")] } },
          { file: "02.json", data: { number: 2, name: "Two", text: [para("Allan waits, then runs.")] } },
          { file: "03.json", data: { number: 3, name: "Three", text: [para("The end.")] } },
        ],
      },
      live,
    );
    expect(changes.map((c) => c.kind)).toEqual(["draft", "chapter", "element"]);
    expect(changes[1]).toMatchObject({ kind: "chapter", afterId: String(ch2) });
    expect(changes[2]).toMatchObject({ kind: "element", name: "Dona", baseHash: null });
  });
});

describe("approve", () => {
  it("adds a draft and keeps Main as it is", async () => {
    const { conn, writes } = fakeConn(liveBook());
    const draft: StagedChange = { ...base("d"), kind: "draft", chapterId: String(ch1), name: "Claude · 22 Nov", text: [para("Ann runs.")], baseHash: "x" };
    const result = await approveChanges(conn, project, [draft], false, noBackup);
    expect(result.applied).toEqual(["d"]);
    const chapters = writes[0].update.$set.chapters as { text: unknown; drafts?: { name: string }[] }[];
    expect(chapters[0].drafts?.map((d) => d.name)).toEqual(["Claude · 22 Nov"]);
    expect(JSON.stringify(chapters[0].text)).toContain("Ann walks.");
    expect(writes[0].filter).toMatchObject({ updatedAt: new Date(at) });
  });

  it("replaces Main only when Main did not change since; otherwise adds a draft", async () => {
    const book = liveBook();
    const fresh: StagedChange = { ...base("m1"), kind: "main", chapterId: String(ch1), text: [para("Ann sprints.")], baseHash: textHash(book.chapters[0].text) };
    const stale: StagedChange = { ...base("m2"), kind: "main", chapterId: String(ch2), text: [para("Allan sleeps.")], baseHash: "old" };
    const { conn, writes } = fakeConn(book);
    const result = await approveChanges(conn, project, [fresh, stale], false, noBackup);
    const chapters = writes[0].update.$set.chapters as { text: unknown; drafts?: unknown[] }[];
    expect(JSON.stringify(chapters[0].text)).toContain("Ann sprints.");
    expect(JSON.stringify(chapters[1].text)).toContain("Allan waits.");
    expect(chapters[1].drafts).toHaveLength(1);
    expect(result.messages.join(" ")).toContain("added as a draft");
  });

  it("places a new chapter, adds tasks, and asks before overwriting a changed element", async () => {
    const book = liveBook();
    const chapter: StagedChange = { ...base("c"), kind: "chapter", name: "One and a half", afterId: String(ch1), text: [para("Between.")] };
    const tasks: StagedChange = { ...base("t"), kind: "tasks", tasks: [{ title: "Check timeline", chapterId: "c" }] };
    const element: StagedChange = { ...base("e"), kind: "element", element: "characters", name: "Ann", text: [para("Lead, older")], baseHash: "stale" };

    const first = fakeConn(book);
    const asked = await approveChanges(first.conn, project, [chapter, tasks, element], false, noBackup);
    expect(asked.conflicts?.map((c) => c.id)).toEqual(["e"]);
    expect(first.writes).toHaveLength(0);

    const second = fakeConn(book);
    const done = await approveChanges(second.conn, project, [chapter, tasks, element], true, noBackup);
    expect(done.applied.sort()).toEqual(["c", "e", "t"]);
    const $set = second.writes[0].update.$set as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect($set.chapters.map((c: { name: string }) => c.name)).toEqual(["One", "One and a half", "Two"]);
    const card = $set.taskBoard.lists[0].cards[0];
    expect(card.title).toBe("Check timeline");
    expect(card.chapterId).toBe(String($set.chapters[1]._id));
    expect(JSON.stringify($set.characters[0].description)).toContain("older");
  });
});
