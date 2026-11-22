import { createHash, randomUUID } from "node:crypto";
import type {
  ChapterAnnotation,
  EntityKind,
  LiveCopy,
  SlateElement,
  StagedChange,
  StagedTask,
} from "../../../shared/types/stagingRoom";
import type { ConnectorDb } from "./connectorDb";
import { ConnectorError } from "./connectorError";
import { markdownToSlate, slateToMarkdown } from "./slateMarkdown";
import { changeTitle, elementHash } from "../services/stagingRoom/changes";
import { isV2, ProjectRow } from "../services/stagingRoom/project";
import { checkSlate, countWords } from "../services/stagingRoom/slate";

// Staging Room access for the Claude connector (Staging Room v2, docs/staging-room-prd.md).
//
// Claude only ADDS pending changes to a staged book: new drafts (the default for chapter
// text), Main edits when the author asks, new chapters, story elements, notes and tasks.
// It never deletes anything and never writes the live books. The author approves each
// change in the Staging Room.
//
// The connector's database user cannot read the live books. It reads the copy of the
// live book that the ROZA backend keeps on each staging row (row.live).

const projectKey = (owner: string, slug: string) => createHash("sha256").update(JSON.stringify([owner, slug])).digest("hex");

function checkSlug(value: string) {
  if (!value.trim() || value.length > 200 || value === "." || value === ".." || /[/\\\x00-\x1f]/.test(value))
    throw new ConnectorError(`"${value}" is not a valid project name.`);
  return value;
}

type Text = string | SlateElement[];
type NoteInput = { quote?: string; content: string };

/** clientId is the connector app (Claude, ChatGPT, ...). The Staging Room shows changes by it as from Claude. */
export function createStagingStore(db: ConnectorDb, owner: string, clientId?: string) {
  const projects = () => db.stagingProjects();

  async function load(slug: string): Promise<ProjectRow> {
    checkSlug(slug);
    const row = (await projects().findOne({ _id: projectKey(owner, slug), owner } as never)) as { version?: unknown } | null;
    if (!row) throw new ConnectorError(`No staged book "${slug}". Call staging_list_projects.`);
    if (!isV2(row))
      throw new ConnectorError(`"${slug}" needs a one-time upgrade. Ask the author to open Staging Room once, then try again.`);
    return row;
  }

  function liveOf(row: ProjectRow): LiveCopy {
    if (!row.live) throw new ConnectorError(`"${row.slug}" is not in Writing Studio yet. Add chapters with staging_add_chapter.`);
    return row.live;
  }

  /** Chapters are numbered 1..n in the live order. */
  function chapterAt(row: ProjectRow, number: number) {
    const live = liveOf(row);
    const chapter = live.chapters[number - 1];
    if (!chapter) throw new ConnectorError(`"${row.slug}" has no chapter ${number}. It has ${live.chapters.length} chapter(s).`);
    return chapter;
  }

  function toSlate(text: Text, screenplay = false): SlateElement[] {
    if (typeof text === "string") {
      if (screenplay) throw new ConnectorError("This chapter is a screenplay. Markdown can't keep its layout. Send Slate nodes.");
      return markdownToSlate(text) as SlateElement[];
    }
    const errors = checkSlate(text, "Text");
    if (errors.length) throw new ConnectorError(errors[0]);
    return text;
  }

  const notesOf = (notes: NoteInput[] | undefined): ChapterAnnotation[] | undefined =>
    notes?.length
      ? notes.map((n) => ({ id: randomUUID(), content: n.content, quote: n.quote ?? "", anchor: null, ...(n.quote ? {} : { general: true }) }))
      : undefined;

  const stamp = () => {
    const now = new Date().toISOString();
    return { id: randomUUID(), createdAt: now, updatedAt: now, by: "connector" as const, ...(clientId ? { clientId } : {}) };
  };

  /** Adds a change, or replaces the one with the same id. Refused while an approval is writing. */
  async function save(row: ProjectRow, change: StagedChange, replaces?: StagedChange) {
    const filter = {
      _id: row._id,
      owner,
      $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }],
      ...(replaces ? { changes: { $elemMatch: { id: replaces.id, updatedAt: replaces.updatedAt } } } : {}),
    };
    const update = replaces
      ? { $set: { "changes.$": change }, $inc: { revision: 1 } }
      : { $push: { changes: change }, $inc: { revision: 1 } };
    const r = await projects().updateOne(filter as never, update as never);
    if (!r.matchedCount)
      throw new ConnectorError(`"${row.slug}" changed while saving (the author may be approving or editing). Nothing was saved. Read it again and retry.`);
    return { slug: row.slug, changeId: change.id, pending: change.kind, title: changeTitle(change, row.live), saved: replaces ? "updated" : "added" };
  }

  async function listProjects() {
    const rows = (await projects().find({ owner }).sort({ slug: 1 }).toArray()) as unknown as (ProjectRow | { slug: string; version?: number })[];
    return {
      projects: rows.map((row) =>
        isV2(row)
          ? {
              slug: row.slug,
              bookName: row.live?.name ?? row.bookName,
              inWritingStudio: !!row.liveBookId,
              chapters: row.live?.chapters.length ?? 0,
              pendingChanges: row.changes.length,
            }
          : { slug: row.slug, needsUpgrade: "Ask the author to open Staging Room once." },
      ),
    };
  }

  async function getProject(slug: string) {
    const row = await load(slug);
    const live = row.live;
    return {
      slug: row.slug,
      bookName: live?.name ?? row.bookName,
      inWritingStudio: !!row.liveBookId,
      liveCopiedAt: live?.copiedAt ?? null,
      chapters: (live?.chapters ?? []).map((c, i) => ({
        number: i + 1,
        title: c.name,
        format: c.format,
        words: countWords(c.text),
        drafts: c.drafts.map((d) => d.name),
      })),
      characters: (live?.characters ?? []).map((x) => x.name),
      themes: (live?.themes ?? []).map((x) => x.name),
      plotlines: (live?.plotlines ?? []).map((x) => x.name),
      notes: (live?.notes ?? []).map((x) => x.name),
      pendingChanges: row.changes.map((c) => ({ changeId: c.id, kind: c.kind, title: changeTitle(c, live), updatedAt: c.updatedAt })),
    };
  }

  /** The live chapter, plus your pending draft or Main edit for it. */
  async function getChapter(slug: string, number: number, view: "markdown" | "full" = "markdown") {
    const row = await load(slug);
    const chapter = chapterAt(row, number);
    const pending = row.changes.filter(
      (c): c is Extract<StagedChange, { kind: "draft" | "main" }> => (c.kind === "draft" || c.kind === "main") && c.chapterId === chapter.id,
    );
    const show = (text: SlateElement[]) => (view === "full" ? text : slateToMarkdown(text));
    return {
      slug,
      number,
      title: chapter.name,
      format: chapter.format,
      words: countWords(chapter.text),
      drafts: chapter.drafts.map((d) => d.name),
      main: show(chapter.text),
      pending: pending.map((c) => ({
        changeId: c.id,
        kind: c.kind,
        ...(c.kind === "draft" ? { name: c.name } : {}),
        words: countWords(c.text),
        text: show(c.text),
      })),
    };
  }

  async function createProject(slug: string, bookName: string, language: "he" | "en") {
    checkSlug(slug);
    if (!bookName.trim()) throw new ConnectorError("bookName is required.");
    const row: ProjectRow = {
      _id: projectKey(owner, slug),
      owner,
      slug,
      version: 2,
      bookName: bookName.trim(),
      userId: owner,
      language,
      changes: [],
      revision: 0,
    };
    try {
      await projects().insertOne(row as never);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConnectorError(`A staged book named "${slug}" already exists.`);
      throw error;
    }
    return { slug, bookName: row.bookName, note: "The book is created in Writing Studio when the author approves its first change." };
  }

  async function writeDraft(input: { slug: string; number: number; text: Text; name?: string; newDraft?: boolean; notes?: NoteInput[] }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    const text = toSlate(input.text, chapter.format === "screenplay");
    const existing = input.newDraft
      ? undefined
      : row.changes.find(
          (c): c is Extract<StagedChange, { kind: "draft" }> => c.kind === "draft" && c.chapterId === chapter.id && c.by === "connector",
        );
    const name = input.name?.trim() || existing?.name || `Claude · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    if (existing) {
      const notes = input.notes ? notesOf(input.notes) : existing.notes;
      return save(row, { ...existing, name, text, ...(notes ? { notes } : {}), updatedAt: new Date().toISOString() }, existing);
    }
    return save(row, { ...stamp(), kind: "draft", chapterId: chapter.id, name, text, baseHash: chapter.mainHash, notes: notesOf(input.notes) });
  }

  async function editMain(input: { slug: string; number: number; text: Text; notes?: NoteInput[] }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    const text = toSlate(input.text, chapter.format === "screenplay");
    const existing = row.changes.find(
      (c): c is Extract<StagedChange, { kind: "main" }> => c.kind === "main" && c.chapterId === chapter.id && c.by === "connector",
    );
    if (existing) return save(row, { ...existing, text, ...(input.notes ? { notes: notesOf(input.notes) } : {}), updatedAt: new Date().toISOString() }, existing);
    return save(row, { ...stamp(), kind: "main", chapterId: chapter.id, text, baseHash: chapter.mainHash, notes: notesOf(input.notes) });
  }

  async function addChapter(input: { slug: string; title: string; text: Text; after?: number; changeId?: string; notes?: NoteInput[] }) {
    const row = await load(input.slug);
    if (!input.title.trim()) throw new ConnectorError("title is required.");
    const text = toSlate(input.text);
    if (input.changeId) {
      const existing = row.changes.find((c): c is Extract<StagedChange, { kind: "chapter" }> => c.kind === "chapter" && c.id === input.changeId);
      if (!existing) throw new ConnectorError(`No pending new chapter with changeId ${input.changeId}.`);
      return save(row, { ...existing, name: input.title.trim(), text, ...(input.notes ? { notes: notesOf(input.notes) } : {}), updatedAt: new Date().toISOString() }, existing);
    }
    const afterId = input.after === undefined ? null : input.after === 0 ? null : chapterAt(row, input.after).id;
    return save(row, { ...stamp(), kind: "chapter", name: input.title.trim(), afterId, text, notes: notesOf(input.notes) });
  }

  async function setElement(input: { slug: string; kind: EntityKind; name: string; text: Text; color?: string }) {
    const row = await load(input.slug);
    const name = input.name.trim();
    if (!name) throw new ConnectorError("name is required.");
    const text = typeof input.text === "string" ? (markdownToSlate(input.text) as SlateElement[]) : toSlate(input.text);
    const withColor = input.kind === "themes" || input.kind === "plotlines";
    if (input.color && !withColor) throw new ConnectorError("Only themes and plotlines have a colour.");
    const current = row.live?.[input.kind].find((x) => x.name === name);
    const color = withColor ? input.color || current?.color || "#937e6e" : undefined;
    if (current && current.hash === elementHash(color, text)) return { slug: row.slug, unchanged: true, note: "It already reads like this in Writing Studio." };
    const existing = row.changes.find(
      (c): c is Extract<StagedChange, { kind: "element" }> => c.kind === "element" && c.element === input.kind && c.name === name,
    );
    if (existing) return save(row, { ...existing, text, ...(color ? { color } : {}), updatedAt: new Date().toISOString() }, existing);
    return save(row, { ...stamp(), kind: "element", element: input.kind, name, ...(color ? { color } : {}), text, baseHash: current?.hash ?? null });
  }

  async function addNotes(input: { slug: string; number: number; notes: NoteInput[] }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    if (!input.notes.length) throw new ConnectorError("notes is empty.");
    return save(row, { ...stamp(), kind: "notes", chapterId: chapter.id, notes: notesOf(input.notes)! });
  }

  async function addTasks(input: { slug: string; tasks: { title: string; description?: string; chapter?: number }[] }) {
    const row = await load(input.slug);
    if (!input.tasks.length) throw new ConnectorError("tasks is empty.");
    const tasks: StagedTask[] = input.tasks.map((t) => ({
      title: t.title.trim(),
      ...(t.description ? { description: t.description } : {}),
      ...(t.chapter ? { chapterId: chapterAt(row, t.chapter).id } : {}),
    }));
    if (tasks.some((t) => !t.title)) throw new ConnectorError("Every task needs a title.");
    return save(row, { ...stamp(), kind: "tasks", tasks });
  }

  return { listProjects, getProject, getChapter, createProject, writeDraft, editMain, addChapter, setElement, addNotes, addTasks };
}
