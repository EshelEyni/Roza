import type { SlateElement, StagedChange } from "../../../shared/types/stagingRoom";
import type { ConnectorDb } from "./connectorDb";
import type { ProjectRow } from "../services/stagingRoom/project";
import { createStagingStore } from "./stagingStore";

// The store against a tiny in-memory stand-in for the staging_room_projects collection.
// It supports only what the store uses: findOne by _id, and updateOne with $push or "changes.$".

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeDb(row: ProjectRow) {
  const coll = {
    findOne: async (q: any) => (q._id === row._id && q.owner === row.owner ? JSON.parse(JSON.stringify(row)) : null),
    updateOne: async (filter: any, update: any) => {
      const match = filter.changes?.$elemMatch;
      const at = match ? row.changes.findIndex((c) => c.id === match.id && c.updatedAt === match.updatedAt) : -1;
      if (filter._id !== row._id || (match && at < 0)) return { matchedCount: 0 };
      if (update.$push) row.changes.push(update.$push.changes);
      else row.changes[at] = update.$set["changes.$"];
      row.revision += update.$inc.revision;
      return { matchedCount: 1 };
    },
  };
  return { stagingProjects: () => coll } as unknown as ConnectorDb;
}

const p = (text: string, extra: Partial<SlateElement> = {}): SlateElement => ({ type: "paragraph", ...extra, children: [{ text }] });

function setup() {
  const owner = "owner-1";
  const main = [p("Chapter start."), p("* * *", { align: "center" }), p("She said no."), p("The end.")];
  const row = {
    _id: "",
    owner,
    slug: "book",
    version: 2,
    bookName: "Book",
    userId: owner,
    language: "en",
    liveBookId: "b1",
    changes: [] as StagedChange[],
    revision: 0,
    live: {
      bookId: "b1",
      name: "Book",
      updatedAt: "",
      copiedAt: "",
      chapters: [
        {
          id: "c1",
          name: "One",
          format: "prose",
          text: main,
          mainHash: "h1",
          annotations: [{ id: "n1", content: "Main note", quote: "said no", anchor: { anchor: { path: [2, 0], offset: 4 }, focus: { path: [2, 0], offset: 11 } } }],
          drafts: [{ id: "d1", name: "Old studio draft", words: 3 }],
        },
      ],
      characters: [],
      themes: [],
      plotlines: [],
      notes: [],
    },
  } as ProjectRow;
  const { createHash } = jest.requireActual("node:crypto");
  row._id = createHash("sha256").update(JSON.stringify([owner, "book"])).digest("hex");
  return { row, store: createStagingStore(fakeDb(row), owner, "claude") };
}

test("copy Main into a draft, then edit it with small find/replace edits", async () => {
  const { row, store } = setup();
  const copy = await store.copyDraft({ slug: "book", number: 1, from: "main", name: "Tightened", withNotes: true });
  expect(copy).toMatchObject({ name: "Tightened", words: 10, notes: 1 });
  expect(row.changes[0]).toMatchObject({ kind: "draft", chapterId: "c1", baseHash: "h1", by: "connector" });

  const edited = await store.editText({ slug: "book", number: 1, edits: [{ find: "said no.", replace: "said yes." }] });
  expect(edited).toMatchObject({ changeId: copy.changeId, target: "draft “Tightened”", summary: "applied 1 edit; words 10 → 10", saved: "updated" });
  expect(edited).toMatchObject({ notesMovedToGeneral: [{ quote: "said no" }] });
  const draft = row.changes[0] as Extract<StagedChange, { kind: "draft" }>;
  expect(draft.text[2]).toEqual(p("She said yes."));
  expect(draft.text[1]).toEqual(p("* * *", { align: "center" }));
  expect(draft.notes).toHaveLength(1);
  expect(draft.notes![0]).toMatchObject({ general: true, anchor: null, content: "Main note" });
});

test("a failing edit saves nothing, and dryRun saves nothing", async () => {
  const { row, store } = setup();
  await store.copyDraft({ slug: "book", number: 1, from: "main", name: "A" });
  const before = JSON.stringify(row.changes);
  await expect(store.editText({ slug: "book", number: 1, edits: [{ find: "The end.", replace: "x" }, { find: "missing", replace: "y" }] })).rejects.toThrow(
    /Edit 2 of 2/,
  );
  const preview = await store.editText({ slug: "book", number: 1, dryRun: true, edits: [{ find: "The end.", replace: "The real end." }] });
  expect(preview).toMatchObject({ dryRun: true, edits: [{ before: "The end.", after: "The real end." }] });
  expect(JSON.stringify(row.changes)).toBe(before);
});

test('target "main" starts a pending Main edit and reports Main notes that will lose their place', async () => {
  const { row, store } = setup();
  const result = await store.editText({ slug: "book", number: 1, target: "main", edits: [{ find: "She said no.", replace: "She left." }] });
  expect(result).toMatchObject({ target: "Main", saved: "added", mainNotesThatWillLoseTheirPlace: [{ quote: "said no" }] });
  expect(row.changes[0]).toMatchObject({ kind: "main", baseHash: "h1" });
  // A second edit updates the same pending Main edit.
  await store.editText({ slug: "book", number: 1, target: "main", edits: [{ find: "left", replace: "ran" }] });
  expect(row.changes).toHaveLength(1);
  expect((row.changes[0] as any).text[2]).toEqual(p("She ran."));
});

test("names the problem when the target is unclear", async () => {
  const { store } = setup();
  await expect(store.editText({ slug: "book", number: 1, edits: [{ find: "x", replace: "y" }] })).rejects.toThrow(/no pending draft/);
  await store.copyDraft({ slug: "book", number: 1, from: "main", name: "A" });
  await store.copyDraft({ slug: "book", number: 1, from: "A", name: "B" });
  await expect(store.editText({ slug: "book", number: 1, edits: [{ find: "x", replace: "y" }] })).rejects.toThrow(/2 pending drafts: "A", "B"/);
  await expect(store.copyDraft({ slug: "book", number: 1, from: "main", name: "a" })).rejects.toThrow(/already has a pending draft/);
  // A copy made before draft texts were kept can't copy a Writing Studio draft until it is refreshed.
  await expect(store.copyDraft({ slug: "book", number: 1, from: "Old studio draft", name: "C" })).rejects.toThrow(/open Staging Room once/);
});

test("writing the whole draft again keeps its notes", async () => {
  const { row, store } = setup();
  await store.writeDraft({ slug: "book", number: 1, text: "Chapter start.\n\nShe said no.", notes: [{ quote: "said no", content: "First" }] });
  await store.writeDraft({ slug: "book", number: 1, text: "Chapter start.\n\nShe said no!", notes: [{ quote: "start", content: "Second" }] });
  const notes = (row.changes[0] as any).notes;
  expect(notes.map((n: any) => n.content)).toEqual(["First", "Second"]);
});

test("small reads: one version, a paragraph range, or a search", async () => {
  const { store } = setup();
  await store.copyDraft({ slug: "book", number: 1, from: "main", name: "A" });
  const full: any = await store.getChapter("book", 1, "full");
  expect(full.pending[0]).not.toHaveProperty("text");
  const one: any = await store.getChapter("book", 1, "markdown", { version: "A" });
  expect(one.version).toMatchObject({ name: "A" });
  expect(one.text).toContain("She said no.");
  expect(one).not.toHaveProperty("main");
  const range: any = await store.getChapter("book", 1, "markdown", { paragraphs: { from: 2, to: 3 } });
  expect(range.main).toEqual({ totalParagraphs: 4, paragraphs: [{ index: 2, text: "She said no." }, { index: 3, text: "The end." }] });
  const found: any = await store.getChapter("book", 1, "markdown", { version: "main", search: "SAID" });
  expect(found.paragraphs).toEqual([{ index: 2, text: "She said no." }]);
  expect(found.notes).toEqual([{ content: "Main note", quote: "said no" }]);
});
