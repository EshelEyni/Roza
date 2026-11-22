import { mongo } from "mongoose";
import type { ConnectorDb } from "./connectorDb";
import { createStagingStore } from "./stagingStore";

// A small in-memory stand-in for the three Staging Room collections. It
// matches rows by _id only; the store's other filters guard against races.
function fakeCollection() {
  const rows = new Map<string, any>();
  const copy = <T>(v: T): T => structuredClone(v);
  return {
    rows,
    findOne: async (q: any) => (rows.has(String(q._id)) ? copy(rows.get(String(q._id))) : null),
    insertOne: async (doc: any) => {
      const _id = doc._id ?? new mongo.ObjectId();
      if (rows.has(String(_id))) throw Object.assign(new Error("duplicate"), { code: 11000 });
      rows.set(String(_id), copy({ ...doc, _id }));
      return { insertedId: _id };
    },
    updateOne: async (q: any, update: any, options?: any) => {
      const key = String(q._id);
      if (!rows.has(key) && !options?.upsert) return { matchedCount: 0 };
      const row = rows.get(key) ?? { _id: q._id };
      Object.assign(row, copy(update.$set || {}));
      for (const [k, v] of Object.entries(update.$inc || {})) row[k] = (row[k] ?? 0) + (v as number);
      rows.set(key, row);
      return { matchedCount: 1 };
    },
    find: (q: any) => ({
      sort: () => ({ toArray: async () => [...rows.values()].filter(r => !q.owner || r.owner === q.owner).map(copy) }),
    }),
  };
}

const owner = "6adb19f461dba7b720c0aa59";
const bookOwner = "6a5e5e65ac5019850b04a505";
const para = (text: string, align?: "center") => ({ type: "paragraph", ...(align ? { align } : {}), children: [{ text }] });

function store() {
  const db = {
    stagingProjects: fakeCollection(),
    stagingBackups: fakeCollection(),
    stagingPreferences: fakeCollection(),
  };
  const connectorDb = {
    stagingProjects: () => db.stagingProjects,
    stagingBackups: () => db.stagingBackups,
    stagingPreferences: () => db.stagingPreferences,
    dbName: () => "prod_roza_db",
  } as unknown as ConnectorDb;
  return { staging: createStagingStore(connectorDb, owner), db };
}

const importInput = () => ({
  slug: "ann-and-allan",
  book: {
    bookName: "Ann and Allan",
    userId: bookOwner,
    language: "en",
    characters: { Ann: "The lead." },
    themes: { Love: ["#c4573f", "Slow."] as [string, string] },
  },
  chapters: [{ file: "01.json", data: { number: 1, name: "One", text: [para("Hello.")] } }],
  state: { prodBookId: "6afcdaf9b5a6d0bfaf8a9b89", dbName: "prod_roza_db", chapters: { "01.json": "6afcdaf9b5a6d0bfaf8a9b90" } },
});

describe("Claude connector: Staging Room fields", () => {
  it("imports a project with its owner and its link to the live book", async () => {
    const { staging } = store();
    const result = await staging.importProject(importInput() as never);
    expect(result).toMatchObject({ userId: bookOwner, chapters: 1, linkedToLiveBook: "6afcdaf9b5a6d0bfaf8a9b89" });
    const project = await staging.getProject("ann-and-allan");
    expect(project.book.userId).toBe(bookOwner);
    expect(project.link.prodBookId).toBe("6afcdaf9b5a6d0bfaf8a9b89");
    expect(project.chapters[0].liveChapterId).toBe("6afcdaf9b5a6d0bfaf8a9b90");
    await expect(staging.importProject(importInput() as never)).rejects.toThrow("already exists");
  });

  it("edits every book field and never resets the owner", async () => {
    const { staging } = store();
    await staging.importProject(importInput() as never);
    const publishing = {
      title: "Ann and Allan", author: "", language: "en", includeTitlePage: false, includeToc: true,
      chapterIds: [], cover: "", identifier: "urn:uuid:1",
    };
    await staging.updateBook("ann-and-allan", {
      wordGoal: 80000,
      publishing: publishing as never,
      audiobookNarrator: { engine: "kokoro", voice: "af_heart", name: "Heart", lang: "en" },
      replaceText: [["Elijah", "Jackie"]],
      archiveInProd: ["Old chapter"],
      syncChapterOrder: true,
    });
    let book = (await staging.getProject("ann-and-allan")).book;
    expect(book).toMatchObject({ userId: bookOwner, wordGoal: 80000, publishing, replaceText: [["Elijah", "Jackie"]], syncChapterOrder: true });

    await staging.updateBook("ann-and-allan", { publishing: null, replaceText: null });
    book = (await staging.getProject("ann-and-allan")).book;
    expect(book.publishing).toBeNull();
    expect("replaceText" in book).toBe(false);
    await expect(staging.updateBook("ann-and-allan", { userId: null })).rejects.toThrow("cannot be removed");
  });

  it("edits every chapter field and reads it back in full", async () => {
    const { staging } = store();
    await staging.importProject(importInput() as never);
    const draft = {
      id: "d1", kind: "main-backup", summary: "Backup", chapterId: "x", name: "Backup",
      text: [para("Old.")], createdAt: "2026-11-20T10:00:00.000Z", updatedAt: "2026-11-20T10:00:00.000Z",
    };
    const note = { id: "n1", content: "Check this", quote: "Hello", anchor: { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } } };
    const taskBoard = { lists: [{ id: "l1", title: "To do", cards: [] }] };
    await staging.updateChapter({
      slug: "ann-and-allan",
      number: 1,
      description: [para("About one.")] as never,
      format: "prose",
      planning: { characters: { Ann: "POV" }, themes: { Love: "" } },
      annotations: [note] as never,
      drafts: [draft] as never,
      taskBoard,
      mainSourceDraftId: "d1",
    });
    const full = (await staging.getChapter("ann-and-allan", 1, "full")) as any;
    expect(full.data).toMatchObject({ planning: { characters: { Ann: "POV" } }, annotations: [note], drafts: [draft], taskBoard, mainSourceDraftId: "d1" });
    expect(full.liveChapterId).toBe("6afcdaf9b5a6d0bfaf8a9b90");

    await staging.updateChapter({ slug: "ann-and-allan", number: 1, drafts: null, mainSourceDraftId: null });
    const after = (await staging.getChapter("ann-and-allan", 1, "full")) as any;
    expect(after.data.drafts).toBeUndefined();
    expect(after.data.mainSourceDraftId).toBeUndefined();
  });

  it("refuses planning links to story elements the book doesn't have", async () => {
    const { staging } = store();
    await staging.importProject(importInput() as never);
    await expect(
      staging.updateChapter({ slug: "ann-and-allan", number: 1, planning: { characters: { Nobody: "" } } }),
    ).rejects.toThrow("Not saved");
  });

  it("saves Slate text exactly, with a chosen file name, and allows Slate for screenplays", async () => {
    const { staging } = store();
    await staging.importProject(importInput() as never);
    const text = [para("Scene."), para("* * *", "center"), { type: "paragraph", align: "right", children: [{ text: "End", bold: true }] }];
    const created = await staging.saveChapter({ slug: "ann-and-allan", number: 2, title: "Two", text: text as never, mode: "create", file: "02.json" });
    expect(created.file).toBe("02.json");
    expect(((await staging.getChapter("ann-and-allan", 2, "full")) as any).data.text).toEqual(text);

    await staging.updateChapter({ slug: "ann-and-allan", number: 2, format: "screenplay" });
    await expect(staging.saveChapter({ slug: "ann-and-allan", number: 2, text: "New", mode: "replace" })).rejects.toThrow("screenplay");
    await staging.saveChapter({ slug: "ann-and-allan", number: 2, text: [para("New")] as never, mode: "replace" });
  });
});
