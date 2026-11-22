import { createHash, randomUUID } from "node:crypto";
import express, { Request } from "express";
import mongoose from "mongoose";
import type { BookListPrefs, LogLine, PullOptions, StagingProjectInput, UploadOptions } from "../../../../shared/types/stagingRoom";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { requireFeature } from "../../middlewares/authGuards/featureAccessMiddleware";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { chapterPreview, detail, summarize, validateBook } from "../../services/stagingRoom/bookFiles";
import type { LoadedBook } from "../../services/stagingRoom/bookFiles";
import { computeStatus, findProdBook, uploadWith, validateProject } from "../../services/stagingRoom/sync";
import { pullWith } from "../../services/stagingRoom/pull";
import type { Backup } from "../../services/stagingRoom/storageTypes";

type Project = Omit<LoadedBook, "errors"> & {
  _id: string;
  owner: string;
  revision: number;
  lease?: { id: string; until: Date };
};

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

async function withProject<T>(req: Request, run: (draft: LoadedBook, backup: Backup, live: LiveBook, log: (level: LogLine["level"], text: string) => void) => Promise<T>) {
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
    const result = await run(draft, backup, live, (level, text) => logs.push({ at: new Date().toISOString(), level, text }));
    const saved = await projects().updateOne(
      { ...filter, "lease.id": id },
      { $set: { book: draft.book, chapters: draft.chapters, state: draft.state, bookMtimeMs: draft.bookMtimeMs }, $inc: { revision: 1 }, $unset: { lease: "" } },
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
  const result = await projects().updateOne(
    {
      _id: row._id,
      owner: account,
      $and: [
        { $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }] },
        revision === 0 ? { $or: [{ revision }, { revision: { $exists: false } }] } : { revision },
      ],
    },
    { $set: { book: row.book, chapters: row.chapters, bookMtimeMs: row.bookMtimeMs }, $inc: { revision: 1 } },
    { ignoreUndefined: true },
  );
  if (!result.matchedCount) throw new AppError("Project changed or is syncing. Reload its draft before editing.", 409);
  res.json({ revision: revision + 1 });
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
  res.json({ ...computeStatus(draft, live, cfg()), reviewToken: reviewToken(row, live) });
}));
router.post("/projects/:slug/push", asyncErrorCatcher(async (req, res) => {
  const options: UploadOptions = {
    overwriteChapters: strings(req.body?.overwriteChapters),
    updateEntities: strings(req.body?.updateEntities),
  };
  res.json(await withProject(req, (draft, backup, live, log) => uploadWith(conn(), cfg(), draft, options, backup, live, log)));
}));
router.post("/projects/:slug/pull", asyncErrorCatcher(async (req, res) => {
  const options: PullOptions = { chapters: strings(req.body?.chapters), entities: strings(req.body?.entities) };
  res.json(await withProject(req, (draft, backup, live, log) => pullWith(cfg(), draft, options, backup, live, log)));
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
