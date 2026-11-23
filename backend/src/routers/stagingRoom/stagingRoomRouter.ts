import { createHash, randomUUID } from "node:crypto";
import express, { Request } from "express";
import mongoose from "mongoose";
import type {
  ChangeTextView,
  LiveBookOption,
  SlateElement,
  StagedBookSummary,
  StagedBookView,
  StagedChange,
  StagingPrefs,
  StagingProjectInput,
} from "../../../../shared/types/stagingRoom";
import { editingRequest } from "../../controllers/book/writingAiController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { requireFeature } from "../../middlewares/authGuards/featureAccessMiddleware";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { askReaderAi } from "../../services/reader/readerAiService";
import { getReaderAiSettings } from "../../services/reader/readerAiSettingsService";
import {
  ApproveError,
  approveChanges,
  changeViews,
  liveCopyOf,
  readLiveBook,
  readView,
} from "../../services/stagingRoom/changes";
import { browseOutline, chapterVersion, elementView, isElementKind } from "../../services/stagingRoom/browse";
import { changesFromCopy, isV2, LegacyCopy, ProjectRow } from "../../services/stagingRoom/project";
import { checkSlate, countWords } from "../../services/stagingRoom/slate";

/*
 * Staging Room v2 (docs/staging-room-prd.md): each staged book is a basket of pending
 * changes on top of the live Writing Studio book. Approving writes them to the live
 * book; nothing here ever deletes live data.
 */

const router = express.Router();
const conn = () => mongoose.connection;
const projects = () => conn().db!.collection<ProjectRow>("staging_room_projects");
const prefsColl = () => conn().db!.collection<Partial<StagingPrefs> & { _id: string; hidden?: string[] }>("staging_room_preferences");
const backups = () => conn().db!.collection("staging_room_backups");
const key = (owner: string, slug: string) => createHash("sha256").update(JSON.stringify([owner, slug])).digest("hex");

function owner() {
  const id = getLoggedInUserIdFromReq();
  if (!id) throw new AppError("Sign in to open Staging Room.", 401);
  return id;
}

function slugOf(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || value === "." || value === ".." || /[/\\\x00-\x1f]/.test(value))
    throw new AppError("Invalid project name.", 400);
  return value;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 1000 || !value.every((v) => typeof v === "string"))
    throw new AppError("Choose at least one change.", 400);
  return [...new Set(value as string[])];
}

const notLeased = () => ({ $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }] });

/* ---------- moving rows from the old full-copy model ---------- */

async function findLiveByName(userId: string, name: string) {
  if (!mongoose.isValidObjectId(userId)) return null;
  const matches = await conn()
    .collection("books")
    .find({ userId: new mongoose.Types.ObjectId(userId), name, isArchived: { $ne: true } })
    .limit(2)
    .toArray();
  return matches.length === 1 ? matches[0] : null;
}

/**
 * An old row holds a full copy of the book. The author uploaded everything already, so a
 * linked book starts with no pending changes; Writing Studio wins. A book that was never
 * uploaded turns its copy into pending changes. The old copy is backed up first.
 */
async function migrate(row: Record<string, unknown>): Promise<ProjectRow> {
  if (isV2(row)) return row;
  const legacy = row as unknown as LegacyCopy & { _id: string; owner: string; slug: string; revision?: number };
  const book = legacy.book ?? { bookName: legacy.slug, userId: legacy.owner };
  const state = legacy.state ?? {};
  await backups().insertOne({
    owner: legacy.owner,
    projectId: legacy._id,
    slug: legacy.slug,
    kind: "v1-copy",
    snapshot: { book: legacy.book, chapters: legacy.chapters, state: legacy.state },
    createdAt: new Date(),
  });
  const userId = mongoose.isValidObjectId(book.userId) ? book.userId : legacy.owner;
  const sameDb = !state.dbName || state.dbName === conn().name;
  let liveBook = sameDb && state.prodBookId ? await readLiveBook(conn(), state.prodBookId, userId) : null;
  liveBook ??= await findLiveByName(userId, book.bookName);
  const live = liveBook ? liveCopyOf(liveBook) : undefined;
  const changes = liveBook ? [] : changesFromCopy({ book, chapters: legacy.chapters ?? [], state }, undefined);
  const next: ProjectRow = {
    _id: legacy._id,
    owner: legacy.owner,
    slug: legacy.slug,
    version: 2,
    bookName: book.bookName,
    userId,
    language: book.language || "en",
    ...(liveBook ? { liveBookId: String(liveBook._id), live } : {}),
    changes,
    revision: (legacy.revision ?? 0) + 1,
  };
  await projects().updateOne(
    { _id: legacy._id, version: { $ne: 2 } } as never,
    {
      $set: next,
      $unset: { book: "", chapters: "", state: "", history: "", review: "", bookMtimeMs: "", lease: "" },
    } as never,
  );
  return next;
}

async function findRow(req: Request): Promise<ProjectRow> {
  const account = owner();
  const row = await projects().findOne({ _id: key(account, slugOf(req.params.slug)), owner: account });
  if (!row) throw new AppError("Staging Room book could not be found.", 404);
  return migrate(row as never);
}

/** Refreshes the row's copy of the live book. Returns the row as saved. */
async function withFreshLive(row: ProjectRow): Promise<ProjectRow> {
  if (!row.liveBookId) return row;
  const book = await readLiveBook(conn(), row.liveBookId, row.userId);
  if (!book) return row;
  const live = liveCopyOf(book);
  if (row.live?.updatedAt === live.updatedAt && row.live.bookId === live.bookId) return row;
  await projects().updateOne({ _id: row._id }, { $set: { live }, $inc: { revision: 1 } });
  return { ...row, live, revision: row.revision + 1 };
}

async function prefsOf(account: string, slugs: string[]): Promise<StagingPrefs> {
  const row = await prefsColl().findOne({ _id: account });
  const hidden = new Set(row?.hidden ?? []);
  return {
    order: row?.order ?? [],
    // Before pins, books were hidden instead: every book that wasn't hidden starts pinned.
    pinned: row?.pinned ?? slugs.filter((s) => !hidden.has(s)),
    filter: row?.filter === "unpinned" || row?.filter === "all" ? row.filter : "pinned",
  };
}

function summary(row: ProjectRow, pinned: Set<string>): StagedBookSummary {
  return {
    slug: row.slug,
    bookName: row.live?.name ?? row.bookName,
    language: row.language,
    linked: !!row.liveBookId,
    chapters: row.live?.chapters.length ?? 0,
    words: (row.live?.chapters ?? []).reduce((n, c) => n + countWords(c.text), 0),
    pending: row.changes.length,
    pinned: pinned.has(row.slug),
  };
}

function bookView(row: ProjectRow): StagedBookView {
  const claude = row.changes
    .filter((c) => c.by === "connector")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const views = changeViews(row.changes, row.live);
  return {
    slug: row.slug,
    bookName: row.live?.name ?? row.bookName,
    linked: !!row.liveBookId,
    revision: row.revision,
    changes: views,
    ...(claude ? { lastClaudeSave: { at: claude.updatedAt, title: views.find((v) => v.id === claude.id)?.title ?? "" } } : {}),
  };
}

const findChange = (row: ProjectRow, id: string) => {
  const change = row.changes.find((c) => c.id === id);
  if (!change) throw new AppError("This change is no longer waiting. It may have been approved or discarded.", 404);
  return change;
};

router.use(checkUserAuthentication, requireFeature("stagingRoom"), (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

/* ---------- books ---------- */

router.get("/projects", asyncErrorCatcher(async (_req, res) => {
  const account = owner();
  const raw = await projects().find({ owner: account }).sort({ slug: 1 }).toArray();
  const rows = await Promise.all(raw.map((r) => migrate(r as never)));
  const prefs = await prefsOf(account, rows.map((r) => r.slug));
  const ranks = new Map(prefs.order.map((slug, index) => [slug, index]));
  rows.sort((a, b) => (ranks.get(a.slug) ?? rows.length) - (ranks.get(b.slug) ?? rows.length));
  const pinned = new Set(prefs.pinned);
  res.json(rows.map((row) => summary(row, pinned)));
}));

/** The author's Writing Studio books, for "Stage a book". */
router.get("/live-books", asyncErrorCatcher(async (_req, res) => {
  const account = owner();
  const [books, rows] = await Promise.all([
    conn().collection("books")
      .find({ userId: new mongoose.Types.ObjectId(account), isArchived: { $ne: true } }, { projection: { name: 1 } })
      .sort({ name: 1 })
      .toArray(),
    projects().find({ owner: account }, { projection: { liveBookId: 1 } }).toArray(),
  ]);
  const staged = new Set(rows.map((r) => r.liveBookId).filter(Boolean));
  res.json(books.map((b): LiveBookOption => ({ id: String(b._id), name: String(b.name ?? ""), staged: staged.has(String(b._id)) })));
}));

/** Stage a live book: creates its (empty) basket of changes. */
router.post("/projects", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  const bookId = req.body?.bookId;
  if (typeof bookId !== "string") throw new AppError("Choose a book.", 400);
  const book = await readLiveBook(conn(), bookId, account);
  if (!book) throw new AppError("That book is not in Writing Studio.", 404);
  if (await projects().findOne({ owner: account, liveBookId: bookId })) throw new AppError("This book is already in Staging Room.", 409);
  const base = String(book.name || "book").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "book";
  let slug = base;
  for (let n = 2; await projects().findOne({ _id: key(account, slug) }, { projection: { _id: 1 } }); n++) slug = `${base}-${n}`;
  const row: ProjectRow = {
    _id: key(account, slug),
    owner: account,
    slug,
    version: 2,
    bookName: String(book.name ?? ""),
    userId: account,
    language: "en",
    liveBookId: bookId,
    live: liveCopyOf(book),
    changes: [],
    revision: 0,
  };
  await projects().insertOne(row);
  res.status(201).json({ slug });
}));

/**
 * Import folder: an old staged project folder. Its differences from the live book become
 * pending changes (new drafts, new chapters, element changes). Nothing is removed.
 */
router.post("/projects/import", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  let input: StagingProjectInput;
  try {
    // Sent as text so middleware leaves names used as object keys intact.
    input = JSON.parse(String(req.body?.project));
  } catch {
    throw new AppError("Expected a project JSON string.", 400);
  }
  if (!object(input) || !object(input.book) || typeof input.book.bookName !== "string" || !Array.isArray(input.chapters))
    throw new AppError("Invalid project folder.", 400);
  const slug = slugOf(input.slug);
  if (await projects().findOne({ _id: key(account, slug), owner: account }, { projection: { _id: 1 } })) {
    res.json({ created: false });
    return;
  }
  for (const c of input.chapters) {
    if (!object(c) || !object(c.data) || typeof c.data.name !== "string" || typeof c.file !== "string") throw new AppError("Invalid chapter file.", 400);
    const errors = checkSlate(c.data.text, `${c.file}`);
    if (errors.length) throw new AppError(errors[0], 400);
  }
  const userId = mongoose.isValidObjectId(input.book.userId) ? input.book.userId : account;
  const state = input.state ?? {};
  let book = state.prodBookId && (!state.dbName || state.dbName === conn().name) ? await readLiveBook(conn(), state.prodBookId, userId) : null;
  book ??= await findLiveByName(userId, input.book.bookName);
  const live = book ? liveCopyOf(book) : undefined;
  const row: ProjectRow = {
    _id: key(account, slug),
    owner: account,
    slug,
    version: 2,
    bookName: input.book.bookName,
    userId,
    language: input.book.language || "en",
    ...(book ? { liveBookId: String(book._id), live } : {}),
    changes: changesFromCopy({ book: input.book, chapters: input.chapters, state }, live),
    revision: 0,
  };
  try {
    await projects().insertOne(row);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    res.json({ created: false });
    return;
  }
  res.status(201).json({ created: true });
}));

router.get("/projects/:slug", asyncErrorCatcher(async (req, res) => {
  res.json(bookView(await withFreshLive(await findRow(req))));
}));

/* ---------- browse the live book (read only) ---------- */

router.get("/projects/:slug/browse", asyncErrorCatcher(async (req, res) => {
  const row = await withFreshLive(await findRow(req));
  res.json(browseOutline(row.live, row.changes));
}));

router.get("/projects/:slug/browse/chapters/:id", asyncErrorCatcher(async (req, res) => {
  const row = await withFreshLive(await findRow(req));
  if (!row.live) throw new AppError("This book is not in Writing Studio yet.", 404);
  const version = typeof req.query.version === "string" && req.query.version ? req.query.version : "main";
  const book = version === "main" || !row.liveBookId ? null : await readLiveBook(conn(), row.liveBookId, row.userId);
  const view = chapterVersion(row.live, book, String(req.params.id), version);
  if (!view) throw new AppError("This chapter or draft is no longer in Writing Studio.", 404);
  res.json(view);
}));

router.get("/projects/:slug/browse/:kind/:index", asyncErrorCatcher(async (req, res) => {
  const kind = req.params.kind;
  const index = Number(req.params.index);
  if (!isElementKind(kind) || !Number.isInteger(index) || index < 0) throw new AppError("Unknown item.", 400);
  const row = await withFreshLive(await findRow(req));
  const view = row.live ? elementView(row.live, kind, index) : null;
  if (!view) throw new AppError("This item is no longer in Writing Studio.", 404);
  res.json(view);
}));

/* ---------- one change ---------- */

router.get("/projects/:slug/changes/:id", asyncErrorCatcher(async (req, res) => {
  const row = await withFreshLive(await findRow(req));
  res.json(readView(findChange(row, String(req.params.id)), row.live));
}));

function textOf(c: StagedChange): SlateElement[] {
  if (c.kind === "draft" || c.kind === "main" || c.kind === "chapter") return c.text;
  throw new AppError("Only drafts and chapter text can be edited.", 400);
}

router.get("/projects/:slug/changes/:id/text", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const c = findChange(row, String(req.params.id));
  const chapter = "chapterId" in c ? row.live?.chapters.find((x) => x.id === c.chapterId) : undefined;
  const view: ChangeTextView = {
    id: c.id,
    slug: row.slug,
    bookName: row.live?.name ?? row.bookName,
    title: c.kind === "chapter" ? c.name : chapter?.name ?? "Removed chapter",
    subtitle: c.kind === "draft" ? `Draft “${c.name}”` : c.kind === "main" ? "Edit to Main" : "New chapter",
    format: chapter?.format ?? "prose",
    text: textOf(c),
    updatedAt: c.updatedAt,
  };
  res.json(view);
}));

/** The Staging editor saves here. The save is refused if Claude saved a newer version meanwhile. */
router.put("/projects/:slug/changes/:id/text", asyncErrorCatcher(async (req, res) => {
  const row = await findRow(req);
  const c = findChange(row, String(req.params.id));
  textOf(c);
  const text = req.body?.text as SlateElement[];
  const errors = checkSlate(text, "Text");
  if (errors.length) throw new AppError(errors[0], 400);
  if (req.body?.updatedAt !== c.updatedAt) throw new AppError("Claude saved a newer version of this text. Load it first.", 409);
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(c.updatedAt) + 1)).toISOString();
  const r = await projects().updateOne(
    { _id: row._id, changes: { $elemMatch: { id: c.id, updatedAt: c.updatedAt } }, ...notLeased() } as never,
    { $set: { "changes.$.text": text, "changes.$.updatedAt": updatedAt }, $inc: { revision: 1 } } as never,
  );
  if (!r.matchedCount) throw new AppError("This text changed meanwhile. Load the newer version first.", 409);
  res.json({ updatedAt });
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

/* ---------- approve and discard ---------- */

router.post("/projects/:slug/approve", asyncErrorCatcher(async (req, res) => {
  const chosenIds = ids(req.body?.ids);
  const confirm = req.body?.confirm === true;
  const row = await findRow(req);
  const lease = { id: randomUUID(), until: new Date(Date.now() + 5 * 60_000) };
  const locked = await projects().findOneAndUpdate({ _id: row._id, ...notLeased() } as never, { $set: { lease } }, { returnDocument: "after" });
  if (!locked) throw new AppError("Another approval is running. Try again in a moment.", 409);
  try {
    const chosen = (locked as unknown as ProjectRow).changes.filter((c) => chosenIds.includes(c.id));
    if (!chosen.length) throw new AppError("These changes are no longer waiting.", 404);
    const result = await approveChanges(conn(), row, chosen, confirm, async (book) => {
      await backups().insertOne({ owner: row.owner, projectId: row._id, slug: row.slug, kind: "live", snapshot: book, createdAt: new Date() });
    });
    if (result.applied.length) {
      const book = await readLiveBook(conn(), result.bookId, row.userId);
      await projects().updateOne(
        { _id: row._id, "lease.id": lease.id } as never,
        {
          $pull: { changes: { id: { $in: result.applied } } },
          $set: { liveBookId: result.bookId, ...(book ? { live: liveCopyOf(book) } : {}) },
          $inc: { revision: 1 },
        } as never,
      );
    }
    const { applied: _applied, bookId: _bookId, ...out } = result;
    res.json(out);
  } catch (error) {
    if (error instanceof ApproveError) throw new AppError(error.message, 409);
    throw error;
  } finally {
    await projects().updateOne({ _id: row._id, "lease.id": lease.id } as never, { $unset: { lease: "" } });
  }
}));

/** Discard removes changes from Staging only. They are kept in a backup. */
router.post("/projects/:slug/discard", asyncErrorCatcher(async (req, res) => {
  const chosenIds = ids(req.body?.ids);
  const row = await findRow(req);
  const chosen = row.changes.filter((c) => chosenIds.includes(c.id));
  if (!chosen.length) throw new AppError("These changes are no longer waiting.", 404);
  await backups().insertOne({ owner: row.owner, projectId: row._id, slug: row.slug, kind: "discarded", snapshot: { changes: chosen }, createdAt: new Date() });
  await projects().updateOne(
    { _id: row._id, ...notLeased() } as never,
    { $pull: { changes: { id: { $in: chosen.map((c) => c.id) } } }, $inc: { revision: 1 } } as never,
  );
  res.json({ discarded: chosen.length });
}));

/* ---------- list preferences ---------- */

router.get("/preferences", asyncErrorCatcher(async (_req, res) => {
  const account = owner();
  const rows = await projects().find({ owner: account }, { projection: { slug: 1 } }).toArray();
  res.json(await prefsOf(account, rows.map((r) => r.slug)));
}));
router.put("/preferences", asyncErrorCatcher(async (req, res) => {
  const list = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === "string") ? [...new Set(v as string[])].slice(0, 1000) : undefined);
  const filter = req.body?.filter;
  const data: Partial<StagingPrefs> = {};
  const order = list(req.body?.order);
  const pinned = list(req.body?.pinned);
  if (order) data.order = order;
  if (pinned) data.pinned = pinned;
  if (filter === "pinned" || filter === "unpinned" || filter === "all") data.filter = filter;
  await prefsColl().updateOne({ _id: owner() }, { $set: data }, { upsert: true });
  const account = owner();
  const rows = await projects().find({ owner: account }, { projection: { slug: 1 } }).toArray();
  res.json(await prefsOf(account, rows.map((r) => r.slug)));
}));

export default router;
