import { createHash, randomBytes } from "node:crypto";
import { mongo } from "mongoose";
const { ObjectId } = mongo;
import type { LocalBookFile, LocalChapterFile, PublishState, RichText, SlateElement } from "../../../shared/types/stagingRoom";
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

// Every field of a staged book. userId is the owner of the live book that Push
// writes to; it is kept as staged and never reset to the connector's account.
export const EDITABLE_BOOK_FIELDS = [
  "bookName",
  "userId",
  "language",
  "wordGoal",
  "taskBoard",
  "publishing",
  "audiobookNarrator",
  "characters",
  "themes",
  "plotlines",
  "notes",
  "replaceText",
  "archiveInProd",
  "syncChapterOrder",
] as const;
type EditableBookField = (typeof EDITABLE_BOOK_FIELDS)[number];
export type BookChanges = { [K in EditableBookField]?: LocalBookFile[K] | null };
// For these, null is stored: it tells Push to remove the field from the live book.
// For the other optional fields, null removes the field from the staged book.
const NULL_MEANS_REMOVE_LIVE = new Set<string>(["wordGoal", "publishing", "audiobookNarrator"]);
const REQUIRED_BOOK_FIELDS = new Set<string>(["bookName", "userId"]);

// Every field of a staged chapter except its number (use staging_set_chapter_order)
// and text (use staging_save_chapter). null removes an optional field from the
// staged chapter, so Push leaves the live chapter's version alone.
export type ChapterChanges = {
  title?: string;
  description?: string | SlateElement[] | null;
  format?: "prose" | "screenplay";
  planning?: LocalChapterFile["planning"] | null;
  annotations?: LocalChapterFile["annotations"] | null;
  drafts?: LocalChapterFile["drafts"] | null;
  taskBoard?: LocalChapterFile["taskBoard"] | null;
  mainSourceDraftId?: string | null;
};
const CHAPTER_FIELDS = ["planning", "annotations", "drafts", "taskBoard", "mainSourceDraftId"] as const;

export type ProjectImport = {
  slug: string;
  book: LocalBookFile;
  chapters?: { file: string; data: LocalChapterFile }[];
  state?: PublishState;
};

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
    return {
      slug: row.slug,
      revision: row.revision ?? 0,
      book: row.book,
      link: {
        prodBookId: row.state?.prodBookId ?? null,
        dbName: row.state?.dbName ?? null,
        lastSyncAt: row.state?.lastSyncAt ?? null,
      },
      chapters: row.chapters.map(({ file, data }) => ({
        number: data.number,
        file,
        title: data.name,
        format: data.format || "prose",
        words: countWords(data.text),
        notes: (data.annotations || []).length,
        drafts: (data.drafts || []).length,
        planningLinks: Object.values(data.planning || {}).reduce((n, links) => n + Object.keys(links || {}).length, 0),
        taskBoard: data.taskBoard !== undefined,
        liveChapterId: row.state?.chapters?.[file] ?? null,
      })),
      errors: (await validateProject(loaded(row))).slice(0, 5),
    };
  }

  // "markdown" is easy to read and edit. "full" returns the stored chapter exactly:
  // Slate text and description, planning, notes, drafts, task board and the rest.
  async function getChapter(slug: string, number: number, view: "markdown" | "full" = "markdown") {
    const row = await load(slug);
    const { file, data } = findChapter(row, number);
    if (view === "full") return { slug, number, file, liveChapterId: row.state?.chapters?.[file] ?? null, data };
    return {
      slug,
      number,
      file,
      title: data.name,
      format: data.format || "prose",
      words: countWords(data.text),
      description: slateToMarkdown(data.description),
      planning: data.planning ?? {},
      notes: (data.annotations || []).map(note => ({ id: note.id, general: !!note.general, quote: note.quote, content: note.content })),
      drafts: (data.drafts || []).map(draft => ({ id: draft.id, name: draft.name, kind: draft.kind, words: countWords(draft.text) })),
      mainSourceDraftId: data.mainSourceDraftId ?? null,
      text: slateToMarkdown(data.text),
    };
  }

  async function insertProject(row: Project, what: string) {
    const errors = await validateProject(loaded(row));
    if (errors.length) throw new ConnectorError(`Not ${what}: ${errors[0]}`);
    try {
      await projects().insertOne(row as never);
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConnectorError(`A staged project named "${row.slug}" already exists.`);
      throw error;
    }
  }

  async function createProject(slug: string, bookName: string, language: "he" | "en", userId?: string) {
    checkSlug(slug);
    if (!bookName.trim()) throw new ConnectorError("bookName is required.");
    const now = Date.now();
    const row: Project = {
      _id: projectKey(owner, slug),
      owner,
      slug,
      book: { bookName: bookName.trim(), userId: userId || owner, language },
      chapters: [],
      revision: 0,
      bookMtimeMs: now,
      state: {},
    };
    await insertProject(row, "created");
    return { slug, bookName: row.book.bookName, userId: row.book.userId, revision: 0 };
  }

  // Same rules as the Staging Room's Import folder (routers/stagingRoom/stagingRoomRouter.ts):
  // the book, chapter files and sync state are stored as given, after validation.
  async function importProject(input: ProjectImport) {
    checkSlug(input.slug);
    const now = Date.now();
    const chapters = (input.chapters || []).map(chapter => {
      if (!/^[^/\\\x00-\x1f]+\.json$/i.test(chapter.file))
        throw new ConnectorError(`"${chapter.file}" is not a valid chapter file name, e.g. 01.json.`);
      return { file: chapter.file, data: chapter.data, mtimeMs: now };
    }).sort((a, b) => a.data.number - b.data.number || a.file.localeCompare(b.file));
    if (new Set(chapters.map(c => c.file)).size !== chapters.length) throw new ConnectorError("Duplicate chapter file names.");
    const row: Project = {
      _id: projectKey(owner, input.slug),
      owner,
      slug: input.slug,
      book: input.book,
      chapters,
      revision: 0,
      bookMtimeMs: now,
      state: input.state ?? {},
    };
    await insertProject(row, "imported");
    return {
      slug: row.slug,
      bookName: row.book.bookName,
      userId: row.book.userId,
      chapters: chapters.length,
      linkedToLiveBook: row.state.prodBookId ?? null,
      revision: 0,
    };
  }

  async function saveChapter(input: {
    slug: string;
    number: number;
    title?: string;
    text: string | SlateElement[];
    mode: "create" | "replace";
    file?: string;
  }) {
    const fromMarkdown = typeof input.text === "string";
    const slate = (fromMarkdown ? markdownToSlate(input.text as string) : input.text) as LocalChapterFile["text"];
    if (input.file !== undefined && (input.mode !== "create" || !/^[^/\\\x00-\x1f]+\.json$/i.test(input.file)))
      throw new ConnectorError('file is only for mode "create" and must look like 01.json.');
    return mutate(input.slug, (row, backups) => {
      const now = Date.now();
      const existing = row.chapters.filter(chapter => chapter.data.number === input.number);
      if (input.mode === "create") {
        if (existing.length)
          throw new ConnectorError(
            `Chapter ${input.number} already exists in "${row.slug}" ("${existing[0].data.name}"). ` +
              'Nothing was saved. Ask the author to confirm, then use mode "replace".',
          );
        if (input.file !== undefined && row.chapters.some(chapter => chapter.file === input.file))
          throw new ConnectorError(`"${input.file}" is already used by another chapter.`);
        let file = input.file ?? `${pad(input.number)}.json`;
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
      if (fromMarkdown && chapter.data.format === "screenplay")
        throw new ConnectorError(`Chapter ${input.number} is a screenplay. Markdown can't keep its layout. Send the text as Slate nodes.`);
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

  async function updateChapter(input: { slug: string; number: number } & ChapterChanges) {
    const { slug, number, ...changes } = input;
    const keys = Object.keys(changes).filter(key => (changes as Record<string, unknown>)[key] !== undefined);
    if (!keys.length) throw new ConnectorError("Nothing to change.");
    return mutate(slug, (row, backups) => {
      const chapter = findChapter(row, number);
      backups.push({
        reason: `Before Claude edited chapter ${number} details`,
        snapshot: { source: "claude", reason: "edit chapter details", file: chapter.file, chapter: clone(chapter.data) },
      });
      const data = chapter.data as unknown as Record<string, unknown>;
      if (changes.title !== undefined) {
        if (!changes.title.trim()) throw new ConnectorError("title cannot be empty.");
        chapter.data.name = changes.title.trim();
      }
      if (changes.description === null) delete chapter.data.description;
      else if (changes.description !== undefined)
        chapter.data.description = (typeof changes.description === "string"
          ? markdownToSlate(changes.description)
          : changes.description) as LocalChapterFile["text"];
      if (changes.format !== undefined) chapter.data.format = changes.format;
      for (const field of CHAPTER_FIELDS) {
        const value = changes[field];
        if (value === null) delete data[field];
        else if (value !== undefined) data[field] = value;
      }
      chapter.mtimeMs = Date.now();
      return { slug: row.slug, number, file: chapter.file, changed: keys };
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
      const book = row.book as unknown as Record<string, unknown>;
      for (const key of keys) {
        const value = (changes as Record<string, unknown>)[key];
        if (value === null && REQUIRED_BOOK_FIELDS.has(key)) throw new ConnectorError(`${key} cannot be removed.`);
        if (value === null && !NULL_MEANS_REMOVE_LIVE.has(key)) delete book[key];
        else book[key] = value;
      }
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
        draft.book = clone(snapshot.book);
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
    importProject,
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
