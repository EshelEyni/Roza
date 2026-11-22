import { createHash, randomUUID } from "node:crypto";
import express, { Request } from "express";
import mongoose from "mongoose";
import type {
  BookListPrefs,
  ChapterAnnotation,
  ChapterDraftView,
  HistoryEvent,
  LocalBookFile,
  LocalChapterFile,
  LogLine,
  ProdStatus,
  PullOptions,
  PullResult,
  ReviewPartId,
  RevertTarget,
  StagingProjectInput,
  UploadOptions,
} from "../../../../shared/types/stagingRoom";
import { editingRequest } from "../../controllers/book/writingAiController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { requireFeature } from "../../middlewares/authGuards/featureAccessMiddleware";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { askReaderAi } from "../../services/reader/readerAiService";
import { getReaderAiSettings } from "../../services/reader/readerAiSettingsService";
import { chapterPreview, detail, summarize, validateBook } from "../../services/stagingRoom/bookFiles";
import type { LoadedBook, LoadedChapter } from "../../services/stagingRoom/bookFiles";
import { addEvent, changedKeys, sourceName, sourceOf, startsEditorStep } from "../../services/stagingRoom/history";
import { computeStatus, findProdBook, uploadWith, validateProject } from "../../services/stagingRoom/sync";
import { pullWith } from "../../services/stagingRoom/pull";
import { RevertError, revertWith } from "../../services/stagingRoom/revert";
import { checkSlate } from "../../services/stagingRoom/slate";
import type { Backup } from "../../services/stagingRoom/storageTypes";

type Project = Omit<LoadedBook, "errors"> & {
  _id: string;
  owner: string;
  revision: number;
  lease?: { id: string; until: Date };
  /** every step that changed the project, newest last */
  history?: HistoryEvent[];
  /** accepted changes: item key and the fingerprint of the change that was accepted */
  review?: { key: string; print: string }[];
};
type Step = { source: HistoryEvent["source"]; summary: string; keys?: string[] };
const PARTS: ReviewPartId[] = ["text", "notes", "drafts", "details", "planning", "tasks", "content"];

const router = express.Router();
const conn = () => mongoose.connection;
const projects = () => conn().db!.collection<Project>("staging_room_projects");
const prefs = () => conn().db!.collection<BookListPrefs & { _id: string }>("staging_room_preferences");
const backups = () => conn().db!.collection("staging_room_backups");
const cfg = () => ({ dbName: conn().name, host: "ROZA server" });
const key = (owner: string, slug: string) =>
  createHash("sha256").update(JSON.stringify([owner, slug])).digest("hex");

function owner() {
  const id = getLoggedInUserIdFromReq();
  if (!id) throw new AppError("Sign in to open Staging Room.", 401);
  return id;
}

function slugOf(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200 ||
      value === "." || value === ".." || /[/\\\x00-\x1f]/.test(value)) {
    throw new AppError("Invalid project name.", 400);
  }
  return value;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) {
    throw new AppError("Expected a list of strings.", 400);
  }
  return [...new Set(value)];
}

type LiveBook = Awaited<ReturnType<typeof findProdBook>>;

function reviewToken(row: Project, live: LiveBook): string {
  return key(row._id, JSON.stringify([row.revision ?? 0, live?._id, live?.updatedAt]));
}

function loaded(project: Project): LoadedBook {
  const { slug, book, chapters, bookMtimeMs } = project;
  const state = project.state.dbName && project.state.dbName !== conn().name ? {} : project.state;
  return { slug, book, chapters, state, bookMtimeMs, errors: validateBook(book, chapters) };
}

async function findRow(req: Request) {
  const account = owner();
  const row = await projects().findOne({ _id: key(account, slugOf(req.params.slug)), owner: account });
  if (!row) throw new AppError("Staging Room project could not be found.", 404);
  return row;
}

async function find(req: Request) {
  return loaded(await findRow(req));
}

function readProjectJson(body: unknown): unknown {
  try {
    if (!object(body) || typeof body.project !== "string") throw new Error();
    return JSON.parse(body.project);
  } catch {
    throw new AppError("Expected a project JSON string.", 400);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function projectInput(value: unknown, account: string): Promise<Project> {
  if (!object(value)) throw new AppError("Expected a staged project.", 400);
  const slug = slugOf(value.slug);
  if (!object(value.book) || typeof value.book.bookName !== "string" ||
      typeof value.book.userId !== "string" || !Array.isArray(value.chapters) ||
      (value.state !== undefined && !object(value.state))) {
    throw new AppError("Invalid staged book, chapter list, or sync state.", 400);
  }
  const input = value as unknown as StagingProjectInput;
  const now = Date.now();
  const chapters = input.chapters.map(chapter => {
    if (!object(chapter) || typeof chapter.file !== "string" ||
        !/^[^/\\\x00-\x1f]+\.json$/i.test(chapter.file) || !object(chapter.data) ||
        typeof chapter.data.name !== "string" ||
        ("planning" in chapter.data && !object(chapter.data.planning))) {
      throw new AppError("Invalid staged chapter.", 400);
    }
    return { file: chapter.file, data: chapter.data, mtimeMs: Number.isFinite(chapter.mtimeMs) ? chapter.mtimeMs : now };
  }).sort((a, b) => a.data.number - b.data.number || a.file.localeCompare(b.file));
  if (new Set(chapters.map(chapter => chapter.file)).size !== chapters.length) {
    throw new AppError("Duplicate chapter filenames.", 400);
  }
  const row: Project = {
    _id: key(account, slug), owner: account, slug, book: input.book, chapters, revision: 0,
    bookMtimeMs: Number.isFinite(input.bookMtimeMs) ? input.bookMtimeMs : now,
    state: input.state ?? {},
  };
  let errors: string[];
  try { errors = await validateProject(loaded(row)); }
  catch { throw new AppError("Invalid staged project data.", 400); }
  if (errors.length) throw new AppError(errors[0], 400);
  return row;
}

async function withProject<T>(
  req: Request,
  step: (result: T) => Step,
  run: (draft: LoadedBook, backup: Backup, live: LiveBook, log: (level: LogLine["level"], text: string) => void) => Promise<T>,
) {
  const account = owner();
  const _id = key(account, slugOf(req.params.slug));
  const id = randomUUID();
  const date = new Date();
  const filter = { _id, owner: account };
  const row = await projects().findOneAndUpdate(
    { ...filter, $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: date } }] },
    { $set: { lease: { id, until: new Date(date.getTime() + 15 * 60_000) } } },
    { returnDocument: "after" },
  );
  if (!row) {
    if (!await projects().findOne(filter, { projection: { _id: 1 } })) throw new AppError("Project not found.", 404);
    throw new AppError("This project is already syncing.", 409);
  }

  const logs: LogLine[] = [];
  const before = structuredClone({ book: row.book, chapters: row.chapters, state: row.state });
  try {
    const draft = loaded(row);
    const errors = await validateProject(draft);
    if (errors.length) throw new AppError(errors[0], 400);
    const backup: Backup = async (kind, snapshot) => {
      const result = await backups().insertOne({ owner: account, projectId: _id, slug: row.slug, kind, snapshot, createdAt: new Date() });
      return String(result.insertedId);
    };
    const live = await findProdBook(conn(), draft);
    if (req.body?.reviewToken !== reviewToken(row, live)) {
      throw new AppError("The staged project or live manuscript changed. Compare again before syncing.", 409);
    }
    let lastBackup: string | undefined;
    const tracked: Backup = async (kind, snapshot) => {
      const backupId = await backup(kind, snapshot);
      if (kind === "staged") lastBackup ??= backupId;
      return backupId;
    };
    const result = await run(draft, tracked, live, (level, text) => logs.push({ at: new Date().toISOString(), level, text }));
    const done = step(result);
    const history = addEvent(row.history, {
      source: done.source,
      summary: done.summary,
      keys: done.keys ?? changedKeys(before, draft),
      ...(lastBackup ? { backupId: lastBackup, backupScope: "project" as const } : {}),
    });
    const saved = await projects().updateOne(
      { ...filter, "lease.id": id },
      { $set: { book: draft.book, chapters: draft.chapters, state: draft.state, bookMtimeMs: draft.bookMtimeMs, history }, $inc: { revision: 1 }, $unset: { lease: "" } },
      { ignoreUndefined: true },
    );
    if (!saved.matchedCount) throw new AppError("Project changed during sync. Refresh and compare again.", 409);
    return { result, logs };
  } finally {
    await projects().updateOne({ ...filter, "lease.id": id }, { $unset: { lease: "" } });
  }
}

router.use(checkUserAuthentication, requireFeature("stagingRoom"), (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
router.get("/projects", asyncErrorCatcher(async (_req, res) => {
  const account = owner();
  const [rows, preferences] = await Promise.all([
    projects().find({ owner: account }).sort({ slug: 1 }).toArray(),
    prefs().findOne({ _id: account }),
  ]);
  const ranks = new Map((preferences?.order ?? []).map((slug, index) => [slug, index]));
  rows.sort((a, b) => (ranks.get(a.slug) ?? rows.length) - (ranks.get(b.slug) ?? rows.length));
  res.json(rows.map(row => summarize(loaded(row))));
}));
router.post("/projects/import", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  // Wrap the legacy JSON as text so middleware leaves names used as object keys intact.
  const input = readProjectJson(req.body);
  const slug = slugOf(object(input) ? input.slug : undefined);
  if (await projects().findOne({ _id: key(account, slug), owner: account }, { projection: { _id: 1 } })) {
    res.json({ created: false });
    return;
  }
  const row = await projectInput(input, account);
  row.history = addEvent([], { source: "import", summary: `Imported ${row.chapters.length} chapter(s) from a folder`, keys: [] });
  try {
    await projects().insertOne(row, { ignoreUndefined: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    res.json({ created: false });
    return;
  }
  res.status(201).json({ created: true });
}));
router.get("/projects/:slug/draft", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  const slug = slugOf(req.params.slug);
  const row = await projects().findOne({ _id: key(account, slug), owner: account });
  if (!row) throw new AppError("Staging Room project could not be found.", 404);
  const { book, chapters, bookMtimeMs, revision } = row;
  res.json({ slug, book, chapters, bookMtimeMs, revision: revision ?? 0 });
}));
router.put("/projects/:slug/draft", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  const slug = slugOf(req.params.slug);
  const revision = req.body?.revision;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new AppError("Expected a project revision.", 400);
  const input = readProjectJson(req.body);
  if (!object(input)) throw new AppError("Expected a staged project.", 400);
  const row = await projectInput({ ...input, slug, state: undefined }, account);
  const current = await projects().findOne({ _id: row._id, owner: account }, { projection: { book: 1, chapters: 1, state: 1, history: 1 } });
  const history = current
    ? addEvent(current.history, { source: "editor", name: "Project file edit", summary: "Edited the project files", keys: changedKeys(current, row) })
    : undefined;
  const result = await projects().updateOne(
    {
      _id: row._id,
      owner: account,
      $and: [
        { $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }] },
        revision === 0 ? { $or: [{ revision }, { revision: { $exists: false } }] } : { revision },
      ],
    },
    { $set: { book: row.book, chapters: row.chapters, bookMtimeMs: row.bookMtimeMs, history }, $inc: { revision: 1 } },
    { ignoreUndefined: true },
  );
  if (!result.matchedCount) throw new AppError("Project changed or is syncing. Reload its draft before editing.", 409);
  res.json({ revision: revision + 1 });
}));

/* ---------- Staging editor: one chapter at a time ---------- */

router.get("/projects/:slug/chapters/:file", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const chapter = row.chapters.find(c => c.file === req.params.file);
  if (!chapter) throw new AppError("Staged chapter not found.", 404);
  const view: ChapterDraftView = {
    slug: row.slug,
    bookName: row.book.bookName,
    revision: row.revision ?? 0,
    file: chapter.file,
    name: chapter.data.name,
    number: chapter.data.number,
    format: chapter.data.format || "prose",
    text: chapter.data.text,
    annotations: chapter.data.annotations,
    chapters: [...row.chapters]
      .sort((a, b) => a.data.number - b.data.number)
      .map(c => ({ file: c.file, number: c.data.number, name: c.data.name })),
  };
  res.json(view);
}));

router.put("/projects/:slug/chapters/:file", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const revision = req.body?.revision;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new AppError("Expected a project revision.", 400);
  if (revision !== (row.revision ?? 0)) throw new AppError("Staging changed somewhere else. Reload the chapter before saving.", 409);
  if (row.lease && new Date(row.lease.until) > new Date()) throw new AppError("This project is syncing. Try again in a moment.", 409);
  const index = row.chapters.findIndex(c => c.file === req.params.file);
  if (index < 0) throw new AppError("Staged chapter not found.", 404);
  const text = req.body?.text as LocalChapterFile["text"];
  const slateErrors = checkSlate(text, "Text");
  if (slateErrors.length) throw new AppError(slateErrors[0], 400);
  const annotations = req.body?.annotations as ChapterAnnotation[] | undefined;
  if (annotations !== undefined && !Array.isArray(annotations)) throw new AppError("Notes must be a list.", 400);

  const before = structuredClone({ book: row.book, chapters: row.chapters, state: row.state });
  const chapter: LoadedChapter = { ...row.chapters[index], data: { ...row.chapters[index].data, text }, mtimeMs: Date.now() };
  if (annotations !== undefined) chapter.data.annotations = annotations;
  const chapters = row.chapters.map((c, i) => (i === index ? chapter : c));
  const errors = await validateProject(loaded({ ...row, chapters }));
  if (errors.length) throw new AppError(`Not saved: ${errors[0]}`, 400);

  let backupId: string | undefined;
  if (startsEditorStep(row.history)) {
    const inserted = await backups().insertOne({ owner: row.owner, projectId: row._id, slug: row.slug, kind: "staged", snapshot: before, createdAt: new Date() });
    backupId = String(inserted.insertedId);
  }
  const history = addEvent(row.history, {
    source: "editor",
    summary: `Edited “${chapter.data.name}” in the Staging editor`,
    keys: changedKeys(before, { book: row.book, chapters }),
    ...(backupId ? { backupId, backupScope: "project" as const } : {}),
  });
  const saved = await projects().updateOne(
    {
      _id: row._id,
      owner: row.owner,
      $and: [
        { $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }] },
        revision === 0 ? { $or: [{ revision }, { revision: { $exists: false } }] } : { revision },
      ],
    },
    { $set: { [`chapters.${index}`]: chapter, history }, $inc: { revision: 1 } },
    { ignoreUndefined: true },
  );
  if (!saved.matchedCount) throw new AppError("Staging changed somewhere else. Reload the chapter before saving.", 409);
  res.json({ revision: revision + 1 });
}));

/** Writing Studio's AI Edit, for staged text. The answer goes back to the Staging editor only. */
router.post("/projects/:slug/ai-edit", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  await findRow(req);
  const { text, instructions } = editingRequest(req.body ?? {});
  const settings = await getReaderAiSettings(account);
  const revision = await askReaderAi(
    instructions,
    [{ role: "user", content: text }],
    settings.model,
    "edit",
    Math.ceil(Buffer.byteLength(text, "utf8") / 2) + 1000,
  );
  res.json({ status: "success", data: { text: revision } });
}));
router.get("/projects/:slug", asyncErrorCatcher(async (req, res) => {
  const draft = await find(req);
  const book = detail(draft);
  book.errors = await validateProject(draft);
  res.json(book);
}));
router.get("/projects/:slug/chapter", asyncErrorCatcher(async (req, res) => {
  const draft = await find(req);
  const { file } = req.query;
  if (typeof file !== "string" || !draft.chapters.some(chapter => chapter.file === file)) {
    throw new AppError("Staged chapter not found.", 404);
  }
  res.json(chapterPreview(draft, file));
}));
router.get("/projects/:slug/compare", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const draft = loaded(row);
  if (draft.errors.length) throw new AppError(draft.errors[0], 400);
  const live = await findProdBook(conn(), draft);
  const status = computeStatus(draft, live, cfg());
  const clients = await clientNames(row.history);
  const accepted = new Map((row.review ?? []).map(r => [r.key, r.print]));
  const mark = (key: string, item: { print?: string; accepted?: boolean; source?: unknown }) => {
    item.accepted = !!item.print && accepted.get(key) === item.print;
    item.source = sourceOf(row.history, key, clients);
  };
  for (const c of status.chapters) if (c.status !== "same") mark(c.key, c);
  for (const e of status.entityChanges ?? []) mark(`${e.kind}:${e.name}`, e);
  if (status.bookChange) mark("book:settings", status.bookChange);
  res.json({ ...status, reviewToken: reviewToken(row, live) } satisfies ProdStatus);
}));
router.post("/projects/:slug/push", asyncErrorCatcher(async (req, res) => {
  const options: UploadOptions = {
    overwriteChapters: strings(req.body?.overwriteChapters),
    updateEntities: strings(req.body?.updateEntities),
  };
  res.json(await withProject(
    req,
    () => ({ source: "push", summary: "Pushed to Writing Studio", keys: [] }),
    (draft, backup, live, log) => uploadWith(conn(), cfg(), draft, options, backup, live, log),
  ));
}));
router.post("/projects/:slug/pull", asyncErrorCatcher(async (req, res) => {
  const options: PullOptions = { chapters: strings(req.body?.chapters), entities: strings(req.body?.entities) };
  res.json(await withProject(
    req,
    (result: PullResult) => ({ source: "pull", summary: `Pulled ${result.chapters} chapter(s) and ${result.entities} other item(s) from Writing Studio` }),
    (draft, backup, live, log) => pullWith(cfg(), draft, options, backup, live, log),
  ));
}));

function revertTargets(value: unknown): RevertTarget[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new AppError("Choose what to reject.", 400);
  return value.map(t => {
    if (!object(t) || typeof t.key !== "string" || !t.key ||
        (t.part !== undefined && !PARTS.includes(t.part as ReviewPartId)) ||
        (t.hunk !== undefined && (!Number.isSafeInteger(t.hunk) || (t.hunk as number) < 0 || t.part !== "text")) ||
        (t.itemId !== undefined && (typeof t.itemId !== "string" || (t.part !== "notes" && t.part !== "drafts")))) {
      throw new AppError("Invalid reject request.", 400);
    }
    return { key: t.key, part: t.part as ReviewPartId | undefined, hunk: t.hunk as number | undefined, itemId: t.itemId as string | undefined };
  });
}

/** Reject: put Writing Studio's version back into Staging. */
router.post("/projects/:slug/revert", asyncErrorCatcher(async (req, res) => {
  const targets = revertTargets(req.body?.targets);
  try {
    res.json(await withProject(
      req,
      () => ({ source: "reject", summary: `Rejected ${targets.length} change(s): put back Writing Studio's version` }),
      (draft, backup, live, log) => revertWith(cfg(), draft, targets, backup, live, log),
    ));
  } catch (error) {
    if (error instanceof RevertError) throw new AppError(error.message, 400);
    throw error;
  }
}));

/** Accept or un-accept a change. Accepts are kept with the change's fingerprint. */
router.put("/projects/:slug/review", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const { key, print, accepted } = req.body ?? {};
  if (typeof key !== "string" || !key || key.length > 500 || typeof print !== "string" || print.length > 64 || typeof accepted !== "boolean") {
    throw new AppError("Invalid review mark.", 400);
  }
  const review = (row.review ?? []).filter(r => r.key !== key);
  if (accepted) review.push({ key, print });
  await projects().updateOne({ _id: row._id, owner: row.owner }, { $set: { review: review.slice(-1000) } });
  res.json({ ok: true });
}));

/** Names of the AI connector apps (Claude, ChatGPT, ...) that wrote to the project. */
async function clientNames(history: HistoryEvent[] | undefined) {
  const ids = [...new Set((history ?? []).map(e => e.clientId).filter((id): id is string => !!id))];
  if (!ids.length) return new Map<string, string>();
  const rows = await conn().db!.collection("mcp_oauth_clients")
    .find({ clientId: { $in: ids } }, { projection: { clientId: 1, clientName: 1 } })
    .toArray();
  return new Map(rows.filter(r => typeof r.clientName === "string").map(r => [String(r.clientId), String(r.clientName)]));
}

router.get("/projects/:slug/history", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const clients = await clientNames(row.history);
  res.json([...(row.history ?? [])].reverse().map(e => ({ ...e, name: sourceName(e, clients) })));
}));

/** Puts back what a step replaced, from the backup taken before it. */
router.post("/projects/:slug/restore", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  if (row.lease && new Date(row.lease.until) > new Date()) throw new AppError("This project is syncing. Try again in a moment.", 409);
  const event = (row.history ?? []).find(e => e.id === req.body?.eventId);
  if (!event?.backupId || !mongoose.isValidObjectId(event.backupId)) throw new AppError("This step has no backup to restore.", 400);
  const saved = await backups().findOne({ _id: new mongoose.Types.ObjectId(event.backupId), owner: row.owner, projectId: row._id });
  const snapshot = saved?.snapshot as
    | { book?: LocalBookFile; chapters?: LoadedChapter[]; file?: string; chapter?: LocalChapterFile }
    | undefined;
  if (!snapshot) throw new AppError("The backup for this step was not found.", 404);

  const before = structuredClone({ book: row.book, chapters: row.chapters, state: row.state });
  let book = row.book;
  let chapters = row.chapters;
  if (snapshot.chapters && snapshot.book) {
    book = snapshot.book;
    chapters = snapshot.chapters;
  } else if (snapshot.book) {
    book = snapshot.book;
  } else if (snapshot.chapter && snapshot.file) {
    const chapter = { file: snapshot.file, data: snapshot.chapter, mtimeMs: Date.now() };
    const exists = chapters.some(c => c.file === snapshot.file);
    if (!exists && chapters.some(c => c.data.number === snapshot.chapter!.number)) {
      throw new AppError(`Chapter ${snapshot.chapter.number} is taken. Renumber chapters first, then restore.`, 409);
    }
    chapters = exists ? chapters.map(c => (c.file === snapshot.file ? chapter : c)) : [...chapters, chapter];
  } else throw new AppError("This backup cannot be restored here.", 400);

  const errors = await validateProject(loaded({ ...row, book, chapters }));
  if (errors.length) throw new AppError(`Not restored: ${errors[0]}`, 400);
  const inserted = await backups().insertOne({ owner: row.owner, projectId: row._id, slug: row.slug, kind: "staged", snapshot: before, createdAt: new Date() });
  const history = addEvent(row.history, {
    source: "restore",
    summary: `Restored Staging to before “${event.summary}”`,
    keys: changedKeys(before, { book, chapters }),
    backupId: String(inserted.insertedId),
    backupScope: "project",
  });
  const revision = row.revision ?? 0;
  const result = await projects().updateOne(
    {
      _id: row._id,
      owner: row.owner,
      $and: [
        { $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }] },
        revision === 0 ? { $or: [{ revision }, { revision: { $exists: false } }] } : { revision },
      ],
    },
    { $set: { book, chapters, bookMtimeMs: Date.now(), history }, $inc: { revision: 1 } },
  );
  if (!result.matchedCount) throw new AppError("Staging changed meanwhile. Open History again and retry.", 409);
  res.json({ ok: true });
}));
router.get("/preferences", asyncErrorCatcher(async (_req, res) => {
  const row = await prefs().findOne({ _id: owner() });
  res.json({ hidden: row?.hidden ?? [], order: row?.order ?? [], showHidden: row?.showHidden ?? false });
}));
router.put("/preferences", asyncErrorCatcher(async (req, res) => {
  const data = { hidden: strings(req.body?.hidden), order: strings(req.body?.order), showHidden: req.body?.showHidden === true };
  await prefs().updateOne({ _id: owner() }, { $set: data }, { upsert: true });
  res.json(data);
}));
router.get("/connection", (_req, res) => {
  res.json({ ...cfg(), configured: true, source: "ROZA backend" });
});
router.get("/connection/test", asyncErrorCatcher(async (_req, res) => {
  await conn().db!.admin().ping();
  res.json({ ok: true, message: "Connected to the ROZA database." });
}));

export default router;
