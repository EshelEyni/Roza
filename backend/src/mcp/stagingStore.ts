import { createHash, randomBytes } from "node:crypto";
import { mongo } from "mongoose";
const { ObjectId } = mongo;
import type { LocalBookFile, LocalChapterFile, RichText } from "../../../shared/types/stagingRoom";
import type { ConnectorDb } from "./connectorDb";
import { ConnectorError } from "./connectorError";
import { markdownToSlate, slateToMarkdown } from "./slateMarkdown";
import { LoadedBook, LoadedChapter, validateBook } from "../services/stagingRoom/bookFiles";
import { validateProject } from "../services/stagingRoom/sync";
import { countWords } from "../services/stagingRoom/slate";

// Staging Room access for the Claude connector. It changes staged projects only.
// It never reads or writes the live books: Compare, Push and Pull stay in the
// Staging Room UI. Storage rules mirror routers/stagingRoom/stagingRoomRouter.ts.
//
// Before anything is replaced or removed, the old version is copied to
// staging_room_backups. Backups are only ever added, never changed or deleted.

type Project = {
  _id: string;
  owner: string;
  slug: string;
  book: LocalBookFile;
  chapters: LoadedChapter[];
  revision?: number;
  bookMtimeMs?: number;
  state: LoadedBook["state"];
  lease?: { id: string; until: Date };
};
type Snapshot = { source: "claude"; reason: string; file?: string; chapter?: LocalChapterFile; book?: LocalBookFile };
type Backup = { reason: string; snapshot: Snapshot };

// Book fields Claude may edit. userId stays tied to the owner. The prod-edit
// directives (replaceText, archiveInProd, syncChapterOrder) are left to the UI.
export const EDITABLE_BOOK_FIELDS = [
  "bookName",
  "language",
  "wordGoal",
  "taskBoard",
  "characters",
  "themes",
  "plotlines",
  "notes",
] as const;
export type BookChanges = Partial<Pick<LocalBookFile, (typeof EDITABLE_BOOK_FIELDS)[number]>>;

const projectKey = (owner: string, slug: string) =>
  createHash("sha256").update(JSON.stringify([owner, slug])).digest("hex");
const pad = (n: number) => String(n).padStart(2, "0");
const clone = <T>(value: T): T => structuredClone(value);

function checkSlug(value: string) {
  if (!value.trim() || value.length > 200 || value === "." || value === ".." || /[/\\\x00-\x1f]/.test(value))
    throw new ConnectorError(`"${value}" is not a valid project name.`);
  return value;
}

export function createStagingStore(db: ConnectorDb, owner: string) {
  const projects = () => db.stagingProjects();

  async function load(slug: string): Promise<Project> {
    checkSlug(slug);
    const row = (await projects().findOne({ _id: projectKey(owner, slug), owner } as never)) as Project | null;
    if (!row) throw new ConnectorError(`No staged project "${slug}". Call staging_list_projects.`);
    return row;
  }

  function loaded(row: Pick<Project, "slug" | "book" | "chapters" | "state" | "bookMtimeMs">): LoadedBook {
    const state = row.state?.dbName && row.state.dbName !== db.dbName() ? {} : row.state || {};
    return {
      slug: row.slug,
      book: row.book,
      chapters: row.chapters,
      state,
      bookMtimeMs: row.bookMtimeMs,
      errors: validateBook(row.book, row.chapters),
    };
  }

  function findChapter(row: Project, number: number) {
    const matches = row.chapters.filter(chapter => chapter.data.number === number);
    if (!matches.length)
      throw new ConnectorError(
        `"${row.slug}" has no chapter ${number}. Chapters: ${row.chapters.map(c => c.data.number).join(", ") || "none"}.`,
      );
    if (matches.length > 1)
      throw new ConnectorError(`"${row.slug}" has ${matches.length} chapters numbered ${number}. Fix the numbering first.`);
    return matches[0];
  }

  // Applies a change to a copy of the project, validates it like the Staging
  // Room does, saves backups, then writes it only if nobody changed the project
  // in the meantime and it is not syncing.
  async function mutate<T>(slug: string, change: (row: Project, backups: Backup[]) => T) {
    const row = await load(slug);
    if (row.lease && new Date(row.lease.until) > new Date())
      throw new ConnectorError(`"${slug}" is syncing right now. Try again in a few minutes.`);
    const draft = clone(row);
    const backups: Backup[] = [];
    const result = change(draft, backups);
    draft.chapters.sort((a, b) => a.data.number - b.data.number || a.file.localeCompare(b.file));
    const errors = await validateProject(loaded(draft));
    if (errors.length) throw new ConnectorError(`Not saved. The project would be invalid: ${errors[0]}`);

    const backupIds: string[] = [];
    for (const backup of backups) {
      const inserted = await db.stagingBackups().insertOne({
        owner,
        projectId: row._id,
        slug: row.slug,
        kind: "staged",
        snapshot: backup.snapshot,
        createdAt: new Date(),
      });
      backupIds.push(String(inserted.insertedId));
    }
    const revision = row.revision ?? 0;
    const saved = await projects().updateOne(
      {
        _id: row._id,
        owner,
        $and: [
          { $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }] },
          revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision },
        ],
      } as never,
      { $set: { book: draft.book, chapters: draft.chapters, bookMtimeMs: draft.bookMtimeMs }, $inc: { revision: 1 } },
      { ignoreUndefined: true },
    );
    if (!saved.matchedCount)
      throw new ConnectorError(`"${slug}" changed while saving. Nothing was saved. Read it again and retry.`);
    return { ...result, revision: revision + 1, backupIds };
  }

  async function listProjects() {
    const [rows, prefs] = await Promise.all([
      projects().find({ owner }).sort({ slug: 1 }).toArray() as unknown as Promise<Project[]>,
      db.stagingPreferences().findOne({ _id: owner } as never),
    ]);
    const order: string[] = prefs?.order ?? [];
    const hidden = new Set<string>(prefs?.hidden ?? []);
    const rank = new Map(order.map((slug, i) => [slug, i]));
    rows.sort((a, b) => (rank.get(a.slug) ?? rows.length) - (rank.get(b.slug) ?? rows.length));
    return {
      projects: rows.map(row => ({
        slug: row.slug,
        bookName: row.book.bookName,
        language: row.book.language || "en",
        chapterCount: row.chapters.length,
        words: row.chapters.reduce((sum, c) => sum + countWords(c.data.text), 0),
        hidden: hidden.has(row.slug),
        lastUploadAt: row.state?.lastUploadAt ?? null,
        revision: row.revision ?? 0,
      })),
      preferences: { order, hidden: [...hidden], showHidden: prefs?.showHidden === true },
    };
  }

  async function getProject(slug: string) {
    const row = await load(slug);
    const { userId: _owner, ...book } = row.book;
    return {
      slug: row.slug,
      revision: row.revision ?? 0,
      book,
      chapters: row.chapters.map(({ file, data }) => ({
        number: data.number,
        file,
        title: data.name,
        format: data.format || "prose",
        words: countWords(data.text),
        notes: (data.annotations || []).length,
      })),
      errors: (await validateProject(loaded(row))).slice(0, 5),
    };
  }

  async function getChapter(slug: string, number: number) {
    const row = await load(slug);
    const { file, data } = findChapter(row, number);
    return {
      slug,
      number,
      file,
      title: data.name,
      format: data.format || "prose",
      words: countWords(data.text),
      description: slateToMarkdown(data.description),
      planning: data.planning ?? {},
      notes: (data.annotations || []).map(note => ({ quote: note.quote, content: note.content })),
      text: slateToMarkdown(data.text),
    };
  }

  async function createProject(slug: string, bookName: string, language: "he" | "en") {
    checkSlug(slug);
    if (!bookName.trim()) throw new ConnectorError("bookName is required.");
    const now = Date.now();
    const row: Project = {
      _id: projectKey(owner, slug),
      owner,
      slug,
      book: { bookName: bookName.trim(), userId: owner, language },
      chapters: [],
      revision: 0,
      bookMtimeMs: now,
      state: {},
    };
    const errors = await validateProject(loaded(row));
    if (errors.length) throw new ConnectorError(`Not created: ${errors[0]}`);
    try {
      await projects().insertOne(row as never);
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConnectorError(`A staged project named "${slug}" already exists.`);
      throw error;
    }
    return { slug, bookName: row.book.bookName, revision: 0 };
  }

  async function saveChapter(input: {
    slug: string;
    number: number;
    title?: string;
    text: string;
    mode: "create" | "replace";
  }) {
    const slate = markdownToSlate(input.text) as unknown as LocalChapterFile["text"];
    return mutate(input.slug, (row, backups) => {
      const now = Date.now();
      const existing = row.chapters.filter(chapter => chapter.data.number === input.number);
      if (input.mode === "create") {
        if (existing.length)
          throw new ConnectorError(
            `Chapter ${input.number} already exists in "${row.slug}" ("${existing[0].data.name}"). ` +
              'Nothing was saved. Ask the author to confirm, then use mode "replace".',
          );
        let file = `${pad(input.number)}.json`;
        while (row.chapters.some(chapter => chapter.file === file))
          file = `${pad(input.number)}-${randomBytes(2).toString("hex")}.json`;
        row.chapters.push({
          file,
          mtimeMs: now,
          data: { number: input.number, name: input.title?.trim() || `Chapter ${input.number}`, format: "prose", text: slate },
        });
        return { slug: row.slug, number: input.number, file, mode: "create", words: countWords(slate) };
      }
      const chapter = findChapter(row, input.number);
      if (chapter.data.format === "screenplay")
        throw new ConnectorError(`Chapter ${input.number} is a screenplay. Edit it in ROZA.`);
      backups.push({
        reason: `Before Claude replaced chapter ${input.number}`,
        snapshot: { source: "claude", reason: "replace chapter", file: chapter.file, chapter: clone(chapter.data) },
      });
      chapter.data.text = slate;
      if (input.title?.trim()) chapter.data.name = input.title.trim();
      // Old notes point into the old text. They stay in the backup. Without them,
      // Push keeps ROZA's notes and re-attaches them by quote.
      delete chapter.data.annotations;
      chapter.mtimeMs = now;
      return { slug: row.slug, number: input.number, file: chapter.file, mode: "replace", words: countWords(slate) };
    });
  }

  async function updateChapter(input: { slug: string; number: number; title?: string; description?: string }) {
    return mutate(input.slug, (row, backups) => {
      const chapter = findChapter(row, input.number);
      if (input.title === undefined && input.description === undefined)
        throw new ConnectorError("Nothing to change.");
      backups.push({
        reason: `Before Claude edited chapter ${input.number} details`,
        snapshot: { source: "claude", reason: "edit chapter details", file: chapter.file, chapter: clone(chapter.data) },
      });
      if (input.title !== undefined) {
        if (!input.title.trim()) throw new ConnectorError("title cannot be empty.");
        chapter.data.name = input.title.trim();
      }
      if (input.description !== undefined)
        chapter.data.description = markdownToSlate(input.description) as unknown as LocalChapterFile["text"];
      chapter.mtimeMs = Date.now();
      return { slug: row.slug, number: input.number, file: chapter.file };
    });
  }

  async function removeChapter(slug: string, number: number) {
    return mutate(slug, (row, backups) => {
      const chapter = findChapter(row, number);
      backups.push({
        reason: `Before Claude removed chapter ${number}`,
        snapshot: { source: "claude", reason: "remove chapter", file: chapter.file, chapter: clone(chapter.data) },
      });
      row.chapters = row.chapters.filter(c => c !== chapter);
      return { slug: row.slug, removed: number, title: chapter.data.name };
    });
  }

  async function setChapterOrder(slug: string, order: number[]) {
    return mutate(slug, row => {
      const current = row.chapters.map(c => c.data.number).sort((a, b) => a - b);
      const given = [...order].sort((a, b) => a - b);
      if (new Set(order).size !== order.length || JSON.stringify(current) !== JSON.stringify(given))
        throw new ConnectorError(`order must list every current chapter number once: ${current.join(", ")}.`);
      const now = Date.now();
      const byNumber = new Map(row.chapters.map(c => [c.data.number, c]));
      order.forEach((oldNumber, i) => {
        const chapter = byNumber.get(oldNumber)!;
        if (chapter.data.number !== i + 1) chapter.mtimeMs = now;
        chapter.data.number = i + 1;
      });
      return { slug: row.slug, chapters: order.map((oldNumber, i) => ({ was: oldNumber, now: i + 1 })) };
    });
  }

  async function updateBook(slug: string, changes: BookChanges) {
    return mutate(slug, (row, backups) => {
      const keys = Object.keys(changes).filter(key => (changes as Record<string, unknown>)[key] !== undefined);
      if (!keys.length) throw new ConnectorError("Nothing to change.");
      backups.push({
        reason: "Before Claude edited the book details",
        snapshot: { source: "claude", reason: "edit book", book: clone(row.book) },
      });
      for (const key of keys) (row.book as unknown as Record<string, unknown>)[key] = (changes as Record<string, unknown>)[key];
      row.book.userId = owner;
      row.bookMtimeMs = Date.now();
      return { slug: row.slug, changed: keys };
    });
  }

  async function setPreferences(prefs: { order?: string[]; hidden?: string[]; showHidden?: boolean }) {
    const current = ((await db.stagingPreferences().findOne({ _id: owner } as never)) || {}) as { order?: string[]; hidden?: string[]; showHidden?: boolean };
    const unique = (list: unknown) => [...new Set((list as string[]) || [])];
    const data = {
      order: unique(prefs.order ?? current.order),
      hidden: unique(prefs.hidden ?? current.hidden),
      showHidden: prefs.showHidden ?? current.showHidden === true,
    };
    await db.stagingPreferences().updateOne({ _id: owner } as never, { $set: data }, { upsert: true });
    return data;
  }

  async function listBackups(slug: string) {
    const row = await load(slug);
    const rows = await db.stagingBackups()
      .find({ owner, projectId: row._id }, { projection: { "snapshot.chapter.text": 0, "snapshot.book": 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return rows.map(backup => ({
      backupId: String(backup._id),
      createdAt: backup.createdAt,
      kind: backup.kind,
      reason: backup.snapshot?.source === "claude" ? backup.snapshot.reason : "Staging Room sync",
      chapter: backup.snapshot?.chapter ? { number: backup.snapshot.chapter.number, title: backup.snapshot.chapter.name } : undefined,
      restorable: backup.snapshot?.source === "claude",
    }));
  }

  async function restoreBackup(slug: string, backupId: string) {
    if (!ObjectId.isValid(backupId)) throw new ConnectorError("Invalid backupId.");
    const row = await load(slug);
    const backup = await db.stagingBackups().findOne({ _id: new ObjectId(backupId), owner, projectId: row._id });
    const snapshot = backup?.snapshot as Snapshot | undefined;
    if (!snapshot) throw new ConnectorError("No such backup for this project.");
    if (snapshot.source !== "claude")
      throw new ConnectorError("Only backups made by Claude can be restored here. Use the Staging Room for sync backups.");
    return mutate(slug, (draft, backups) => {
      const now = Date.now();
      if (snapshot.book) {
        backups.push({ reason: "Before Claude restored a backup", snapshot: { source: "claude", reason: "restore", book: clone(draft.book) } });
        draft.book = { ...clone(snapshot.book), userId: owner };
        draft.bookMtimeMs = now;
        return { slug, restored: "book" };
      }
      const chapter = snapshot.chapter as LocalChapterFile;
      const current = draft.chapters.find(c => c.file === snapshot.file);
      if (current) {
        backups.push({
          reason: "Before Claude restored a backup",
          snapshot: { source: "claude", reason: "restore", file: current.file, chapter: clone(current.data) },
        });
        current.data = clone(chapter);
        current.mtimeMs = now;
      } else {
        if (draft.chapters.some(c => c.data.number === chapter.number))
          throw new ConnectorError(`Chapter ${chapter.number} is taken. Renumber chapters first, then restore.`);
        draft.chapters.push({ file: snapshot.file as string, data: clone(chapter), mtimeMs: now });
      }
      return { slug, restored: `chapter ${chapter.number}`, title: chapter.name };
    });
  }

  return {
    listProjects,
    getProject,
    getChapter,
    createProject,
    saveChapter,
    updateChapter,
    removeChapter,
    setChapterOrder,
    updateBook,
    setPreferences,
    listBackups,
    restoreBackup,
  };
}

export type { RichText };
