import crypto from "crypto";
import fs from "fs";
import path from "path";
import mongoose, { Connection, Model, Types } from "mongoose";
import type {
  ChapterAnnotation,
  EntityKind,
  LocalChapterFile,
  LogLine,
  ProdStatus,
  RichText,
  TaskBoard,
  UploadOptions,
  UploadResult,
} from "../../../shared/types/stagingRoom";
import { loadBook, LoadedBook, saveState, writeBackup } from "./bookFiles";
import { DbConfig, loadDbConfig, maskHost } from "./config";
import { diffParagraphs } from "./diff";
import {
  asSlate,
  BookContent,
  bookLines,
  bookPrint,
  bookReport,
  ChapterContent,
  chapterLines,
  chapterPrint,
  chapterReport,
  clean,
  entityLines,
  entityReport,
  entityPrint as fullEntityPrint,
  hashOf,
  liveNames,
  localChapterContent,
  localEntityContent,
  PLANNING_KINDS,
  prodBookContent,
  prodChapterContent,
  prodEntityContent,
  reattachNotes,
} from "./fullData";
import { validatePlanning } from "./planningValidation";
import { planProdEdits } from "./prodEdits";
import { bookModelFor, bookSchema } from "./rozaSchema";
import { countWords, fingerprint, plainParagraphs, toSlate } from "./slate";

export type Logger = (level: LogLine["level"], text: string) => void;
const noLog: Logger = () => undefined;

/* eslint-disable @typescript-eslint/no-explicit-any */
type ProdItem = Record<string, any>;
type ProdBook = Record<string, any>;

export const BOOK_SETTINGS_KEY = "book:settings";
const ENTITY_KINDS: EntityKind[] = ["characters", "themes", "plotlines", "notes"];

const live = (items: ProdItem[] | undefined) => (items || []).filter((x) => x && x.isArchived !== true);
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
const toObj = (doc: mongoose.Document) => doc.toObject({ virtuals: false, transform: false } as any) as ProdBook;

export async function withDb<T>(root: string, fn: (conn: Connection, cfg: DbConfig) => Promise<T>): Promise<T> {
  const cfg = loadDbConfig(root);
  const conn = await mongoose
    .createConnection(cfg.url, { dbName: cfg.dbName, serverSelectionTimeoutMS: 15000 })
    .asPromise();
  try {
    return await fn(conn, cfg);
  } finally {
    await conn.close();
  }
}

export async function testConnection(root: string): Promise<{ ok: boolean; message: string }> {
  try {
    return await withDb(root, async (conn, cfg) => {
      await conn.db!.admin().ping();
      const books = await conn.collection("books").estimatedDocumentCount();
      return { ok: true, message: `Connected to "${cfg.dbName}" on ${maskHost(cfg.url)} (${books} books).` };
    });
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ---------- building Roza-shaped items from local files ---------- */

type IdMaps = Record<(typeof PLANNING_KINDS)[number], Map<string, string>>;

function buildEntities(loaded: LoadedBook, bookId: Types.ObjectId, kind: EntityKind, only?: Set<string>) {
  const source = (loaded.book[kind] || {}) as Record<string, RichText | [string, RichText]>;
  return Object.entries(source)
    .filter(([name]) => !only || only.has(name))
    .map(([name, value]) => {
      const base = { _id: new Types.ObjectId(), bookId, name, type: kind };
      if (kind === "notes") return { ...base, text: asSlate(value as RichText) };
      if (kind === "characters") return { ...base, description: asSlate(value as RichText) };
      const [color, desc] = value as [string, RichText];
      return { ...base, color, description: asSlate(desc) };
    });
}

/** Points task cards at the right chapters; cards whose chapter isn't in the book lose the link. */
function remapBoard(board: TaskBoard | undefined, ids: Map<string, string>): TaskBoard | undefined {
  if (!board) return board;
  return {
    ...board,
    lists: (board.lists || []).map((l: any) => ({
      ...l,
      cards: (l.cards || []).map((c: any) => (c.chapterId ? { ...c, chapterId: ids.get(String(c.chapterId)) ?? "" } : c)),
    })),
  };
}

interface BuiltChapter {
  chapter: ProdItem;
  /** fields to write when replacing an existing Roza chapter */
  fields: string[];
  moved: number;
  detached: number;
  /** the local file's notes/drafts after re-attaching, when that changed them (written back after a push) */
  localFix?: Pick<LocalChapterFile, "annotations" | "drafts">;
}

/**
 * A Roza chapter from a local file. With `prodCh` (replacing an existing chapter), fields the
 * local file leaves out are not written, so Roza keeps them; Roza's notes are re-attached to
 * the new text when the text changed.
 */
function buildChapter(
  data: LocalChapterFile,
  bookId: Types.ObjectId,
  ids: IdMaps,
  _id = new Types.ObjectId(),
  prodCh?: ProdItem,
): BuiltChapter {
  const planning = Object.fromEntries(
    PLANNING_KINDS.map((kind) => {
      const links = Object.entries(data.planning?.[kind] || {}).map(([name, note]) => {
        const entityId = ids[kind].get(name);
        if (!entityId) throw new Error(`Chapter "${data.name}" links to unknown ${kind} "${name}".`);
        return { entityId, note: String(note ?? "") };
      });
      // Roza keeps links to archived story elements (so they come back on restore). Keep them too.
      const liveIds = new Set(ids[kind].values());
      const archived = ((prodCh?.planning?.[kind] || []) as ProdItem[])
        .filter((l) => !liveIds.has(String(l.entityId)))
        .map((l) => ({ entityId: String(l.entityId), note: String(l.note || "") }));
      return [kind, [...links, ...archived]];
    }),
  );
  const chapter: ProdItem = {
    _id,
    bookId,
    type: "chapters",
    format: data.format || prodCh?.format || "prose",
    name: data.name,
    description: data.description?.length ? data.description : toSlate(""),
    text: data.text,
    planning,
  };
  const fields = ["name", "description", "text", "planning"];
  if (data.format !== undefined) fields.push("format");

  let moved = 0;
  let detached = 0;
  let localFix: BuiltChapter["localFix"];
  const textChanged = !prodCh || hashOf(prodCh.text) !== hashOf(data.text);
  const notes: ChapterAnnotation[] | undefined =
    data.annotations !== undefined ? data.annotations : textChanged && prodCh?.annotations?.length ? clean(prodCh.annotations) : undefined;
  if (notes !== undefined) {
    const r = reattachNotes(data.text, notes);
    chapter.annotations = r.notes;
    moved += r.moved;
    detached += r.detached;
    fields.push("annotations");
    if (data.annotations !== undefined && r.moved + r.detached) localFix = { annotations: r.notes };
  }
  if (data.drafts !== undefined) {
    let draftsFixed = false;
    const drafts = data.drafts.map((d) => {
      const r = reattachNotes(d.text, d.annotations);
      moved += r.moved;
      detached += r.detached;
      if (r.moved + r.detached) draftsFixed = true;
      return { ...d, ...(r.notes ? { annotations: r.notes } : {}) };
    });
    chapter.drafts = drafts.map((d) => ({ ...d, chapterId: String(_id) }));
    fields.push("drafts");
    if (draftsFixed) localFix = { ...localFix, drafts: drafts };
  }
  if (data.taskBoard !== undefined) {
    chapter.taskBoard = data.taskBoard;
    fields.push("taskBoard");
  }
  return { chapter, fields, moved, detached, localFix };
}

const idMapOf = (lists: Record<string, ProdItem[]>): IdMaps =>
  Object.fromEntries(
    PLANNING_KINDS.map((kind) => [kind, new Map(live(lists[kind]).map((x) => [x.name, String(x._id)]))]),
  ) as IdMaps;

function buildNewBook(loaded: LoadedBook, Book: Model<any>) {
  const bookId = new Types.ObjectId();
  const lists = Object.fromEntries(ENTITY_KINDS.map((k) => [k, buildEntities(loaded, bookId, k)]));
  const ids = idMapOf(lists);
  const built = loaded.chapters.map((c) => buildChapter(c.data, bookId, ids));
  // Task cards may point at chapter ids of an earlier copy of this book: map them to the new ids.
  const chapterIds = new Map<string, string>();
  loaded.chapters.forEach((c, i) => {
    const newId = String(built[i].chapter._id);
    chapterIds.set(newId, newId);
    const old = loaded.state.chapters?.[c.file];
    if (old) chapterIds.set(old, newId);
  });
  const chapters: ProdItem[] = built.map((b) => ({ ...b.chapter, taskBoard: remapBoard(b.chapter.taskBoard, chapterIds) }) as ProdItem);
  const bookBoard = remapBoard(loaded.book.taskBoard, chapterIds);
  const doc = new Book({
    _id: bookId,
    userId: new Types.ObjectId(loaded.book.userId),
    name: loaded.book.bookName,
    chapters,
    ...lists,
    taskBoard: bookBoard,
    ...(loaded.book.wordGoal != null ? { wordGoal: loaded.book.wordGoal } : {}),
    filterBy: "chapters",
  });
  return {
    doc,
    bookId,
    chapterIds: loaded.chapters.map((c, i) => [c.file, String(chapters[i]._id)] as const),
    boards: { book: bookBoard, chapters: chapters.map((c) => c.taskBoard as TaskBoard | undefined) },
  };
}

/** After creating a book: task cards now point at the new chapter ids; write that back to the local files. */
function writeBoardsBack(loaded: LoadedBook, boards: { book?: TaskBoard; chapters: (TaskBoard | undefined)[] }) {
  const save = (file: string, board: TaskBoard) => {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(file, JSON.stringify({ ...data, taskBoard: board }, null, 2) + "\n");
  };
  if (boards.book && hashOf(boards.book) !== hashOf(loaded.book.taskBoard)) {
    save(path.join(loaded.dir, "book.json"), boards.book);
    loaded.book.taskBoard = boards.book;
  }
  loaded.chapters.forEach((c, i) => {
    const board = boards.chapters[i];
    if (!board || hashOf(board) === hashOf(c.data.taskBoard)) return;
    save(path.join(loaded.dir, "chapters", c.file), board);
    c.data.taskBoard = board;
  });
}

/** Full local check with Roza's schema and planning rules. No database needed. */
export async function validateLocal(root: string, slug: string): Promise<string[]> {
  const loaded = loadBook(root, slug);
  if (loaded.errors.length) return loaded.errors;
  try {
    const Book = (mongoose.models.Book as Model<any>) || mongoose.model("Book", bookSchema, "books");
    const { doc, bookId } = buildNewBook(loaded, Book);
    await doc.validate();
    validatePlanning(plain(toObj(doc)), String(bookId));
    return [];
  } catch (e) {
    return [(e as Error).message];
  }
}

/* ---------- comparing with prod ---------- */

export async function findProdBook(conn: Connection, loaded: LoadedBook): Promise<ProdBook | null> {
  const coll = conn.collection("books");
  const userId = new Types.ObjectId(loaded.book.userId);
  if (loaded.state.prodBookId && Types.ObjectId.isValid(loaded.state.prodBookId)) {
    const byId = await coll.findOne({ _id: new Types.ObjectId(loaded.state.prodBookId), userId });
    if (byId && byId.isArchived !== true) return byId;
  }
  const matches = await coll.find({ userId, name: loaded.book.bookName, isArchived: { $ne: true } }).toArray();
  if (matches.length > 1)
    throw new Error(
      `Prod has ${matches.length} books named "${loaded.book.bookName}" for this user. Archive the extra one in Roza first.`,
    );
  return matches[0] || null;
}

export interface ChapterMatch {
  local: LoadedBook["chapters"][number];
  prod?: ProdItem;
  differs: boolean;
  localContent: ChapterContent;
  prodContent?: ChapterContent;
}

/** Pairs local chapter files with Roza chapters (saved id first, then name) and compares every field. */
export function matchChapters(loaded: LoadedBook, prod: ProdBook | null): ChapterMatch[] {
  const pool = live(prod?.chapters);
  const names = liveNames(prod);
  const used = new Set<string>();
  return loaded.chapters.map((local) => {
    const savedId = loaded.state.chapters?.[local.file];
    const found =
      pool.find((c) => String(c._id) === savedId && !used.has(String(c._id))) ||
      pool.find((c) => c.name === local.data.name && !used.has(String(c._id)));
    if (found) used.add(String(found._id));
    const localContent = localChapterContent(local.data);
    const prodContent = found ? prodChapterContent(found, names) : undefined;
    const differs = !!prodContent && chapterPrint(localContent) !== chapterPrint(prodContent);
    return { local, prod: found as ProdItem | undefined, differs, localContent, prodContent };
  });
}

/** Older fingerprint (name + plain text only), still read from state files written before full sync. */
export function syncPrint(name: string, text: unknown): string {
  return crypto.createHash("sha1").update(`${name}\n${fingerprint(text)}`).digest("hex").slice(0, 16);
}

const SLACK_MS = 2000;
type Direction = "pull" | "push" | "conflict";

const decide = (localChanged: boolean, prodChanged: boolean): Direction =>
  prodChanged && !localChanged ? "pull" : localChanged && !prodChanged ? "push" : "conflict";

/** Which side changed since the last sync, when there is no fingerprint to go by. */
function byTime(loaded: LoadedBook, localMtime: number | undefined, prodUpdatedAt: unknown): Direction {
  const syncAt = Date.parse(loaded.state.lastSyncAt || loaded.state.lastUploadAt || "");
  if (!Number.isFinite(syncAt)) return "conflict";
  const prodAt = Date.parse(String(prodUpdatedAt || ""));
  return decide((localMtime ?? Infinity) > syncAt + SLACK_MS, !Number.isFinite(prodAt) || prodAt > syncAt + SLACK_MS);
}

/** For a chapter that differs: which side changed since the last upload/pull? */
function directionOf(loaded: LoadedBook, m: ChapterMatch): Direction {
  const full = loaded.state.fullPrints?.[m.local.file];
  if (full) return decide(chapterPrint(m.localContent) !== full, chapterPrint(m.prodContent!) !== full);
  const legacy = loaded.state.prints?.[m.local.file];
  if (legacy) {
    // The old fingerprint covered only name + text. If the local file didn't change those,
    // the difference is in fields only Roza had (notes, planning, ...), so Roza is newer.
    const localChanged = syncPrint(m.local.data.name, m.local.data.text) !== legacy;
    return decide(localChanged, syncPrint(m.prod!.name, m.prod!.text) !== legacy || !localChanged);
  }
  return byTime(loaded, m.local.mtimeMs, m.prod!.updatedAt);
}

/* story elements: older plain-text fingerprint, still read from older state files */
function entityParasLocal(kind: EntityKind, value: RichText | [string, RichText]): string[] {
  if (kind === "themes" || kind === "plotlines") {
    const [color, desc] = value as [string, RichText];
    return [`Colour: ${(color || "").toLowerCase()}`, ...plainParagraphs(asSlate(desc))];
  }
  return plainParagraphs(asSlate(value as RichText));
}
function entityParasProd(kind: EntityKind, item: ProdItem): string[] {
  const paras = plainParagraphs(kind === "notes" ? item.text : item.description);
  return kind === "themes" || kind === "plotlines" ? [`Colour: ${(item.color || "#937e6e").toLowerCase()}`, ...paras] : paras;
}
const normParas = (paras: string[]) => paras.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
const legacyEntityPrint = (paras: string[]) => crypto.createHash("sha1").update(normParas(paras)).digest("hex").slice(0, 16);

function entityDirection(loaded: LoadedBook, kind: EntityKind, value: RichText | [string, RichText], item: ProdItem): Direction {
  const key = `${kind}:${item.name}`;
  const full = loaded.state.fullEntityPrints?.[key];
  if (full)
    return decide(
      fullEntityPrint(localEntityContent(kind, value)) !== full,
      fullEntityPrint(prodEntityContent(kind, item)) !== full,
    );
  const legacy = loaded.state.entityPrints?.[key];
  if (legacy) {
    const localChanged = legacyEntityPrint(entityParasLocal(kind, value)) !== legacy;
    return decide(localChanged, legacyEntityPrint(entityParasProd(kind, item)) !== legacy || !localChanged);
  }
  return byTime(loaded, loaded.bookMtimeMs, item.updatedAt);
}

const localEntities = (loaded: LoadedBook, kind: EntityKind) =>
  (loaded.book[kind] || {}) as Record<string, RichText | [string, RichText]>;

const entityDiffers = (kind: EntityKind, value: RichText | [string, RichText], item: ProdItem) =>
  fullEntityPrint(localEntityContent(kind, value)) !== fullEntityPrint(prodEntityContent(kind, item));

function entityChangesOf(loaded: LoadedBook, prod: ProdBook | null): NonNullable<ProdStatus["entityChanges"]> {
  const out: NonNullable<ProdStatus["entityChanges"]> = [];
  for (const kind of ENTITY_KINDS) {
    const localMap = localEntities(loaded, kind);
    const prodItems = live(prod?.[kind]);
    for (const name of Object.keys(localMap))
      if (!prodItems.some((x) => x.name === name)) out.push({ kind, name, status: "new" });
    for (const item of prodItems) {
      if (!(item.name in localMap)) {
        out.push({ kind, name: item.name, status: "prod-only" });
        continue;
      }
      const value = localMap[item.name];
      if (!entityDiffers(kind, value, item)) continue;
      out.push({
        kind,
        name: item.name,
        status: "differs",
        direction: entityDirection(loaded, kind, value, item),
        diff: diffParagraphs(entityLines(localEntityContent(kind, value)), entityLines(prodEntityContent(kind, item))),
        summary: entityReport(localEntityContent(kind, value), prodEntityContent(kind, item)),
      });
    }
  }
  return out;
}

/* the book's own fields: name, word goal, task board */

const localBookContent = (loaded: LoadedBook): BookContent =>
  clean({ name: loaded.book.bookName, wordGoal: loaded.book.wordGoal, taskBoard: loaded.book.taskBoard });

function bookChangeOf(loaded: LoadedBook, prod: ProdBook | null): ProdStatus["bookChange"] {
  if (!prod) return undefined;
  const local = localBookContent(loaded);
  const remote = prodBookContent(prod);
  if (bookPrint(local) === bookPrint(remote)) return undefined;
  const base = loaded.state.bookPrint;
  let direction: Direction;
  if (base) direction = decide(bookPrint(local) !== base, bookPrint(remote) !== base);
  else {
    // Never synced these fields: if book.json doesn't set them, they only exist in Roza.
    const untracked = loaded.book.wordGoal === undefined && loaded.book.taskBoard === undefined && local.name === remote.name;
    direction = untracked ? "pull" : "conflict";
  }
  return { direction, diff: diffParagraphs(bookLines(local), bookLines(remote)), summary: bookReport(local, remote) };
}

export function computeStatus(loaded: LoadedBook, prod: ProdBook | null, cfg: DbConfig): ProdStatus {
  const matches = matchChapters(loaded, prod);
  const matchedIds = new Set(matches.filter((m) => m.prod).map((m) => String(m.prod!._id)));
  return {
    dbName: cfg.dbName,
    host: maskHost(cfg.url),
    bookExists: !!prod,
    prodBookId: prod ? String(prod._id) : undefined,
    prodUpdatedAt: prod?.updatedAt ? new Date(prod.updatedAt).toISOString() : undefined,
    chapters: [
      ...matches.map((m) => ({
        key: m.local.file,
        direction: m.prod && m.differs ? directionOf(loaded, m) : undefined,
        diff: m.prod && m.differs ? diffParagraphs(chapterLines(m.localContent), chapterLines(m.prodContent!)) : undefined,
        summary: m.prod && m.differs ? chapterReport(m.localContent, m.prodContent!) : undefined,
        file: m.local.file,
        name: m.local.data.name,
        status: (!m.prod ? "new" : m.differs ? "differs" : "same") as "new" | "differs" | "same",
        localWords: countWords(m.local.data.text),
        prodWords: m.prod ? countWords(m.prod.text) : undefined,
      })),
      ...live(prod?.chapters)
        .filter((c) => !matchedIds.has(String(c._id)))
        .map((c) => ({
          key: `prod:${c._id}`,
          name: c.name as string,
          status: "prod-only" as const,
          prodWords: countWords(c.text),
        })),
    ],
    entities: ENTITY_KINDS.flatMap((kind) =>
      Object.keys(loaded.book[kind] || {}).map((name) => ({
        kind,
        name,
        status: (live(prod?.[kind]).some((x) => x.name === name) ? "exists" : "new") as "exists" | "new",
      })),
    ),
    edits: prod ? planProdEdits(loaded.book, prod, localNumbersOf(matches)).messages : [],
    entityChanges: entityChangesOf(loaded, prod),
    bookChange: bookChangeOf(loaded, prod),
  };
}

const localNumbersOf = (matches: ChapterMatch[]) =>
  new Map(matches.filter((m) => m.prod).map((m) => [String(m.prod!._id), m.local.data.number] as const));

/** Reorder / archive / replace-text in the existing prod book, as declared in book.json. */
async function applyProdEdits(conn: Connection, loaded: LoadedBook, bookId: Types.ObjectId, log: Logger) {
  const coll = conn.collection("books");
  const fresh = await coll.findOne({ _id: bookId });
  if (!fresh) throw new Error("The book disappeared from prod during the upload.");
  const now = new Date(Math.max(Date.now(), new Date(fresh.updatedAt || 0).getTime() + 1));
  const plan = planProdEdits(loaded.book, fresh, localNumbersOf(matchChapters(loaded, fresh)), now);
  if (!plan.changed) return [];
  const merged = plain({ ...fresh, ...plan.next });
  validatePlanning(merged, String(bookId));
  const r = await coll.updateOne(
    { _id: bookId, updatedAt: fresh.updatedAt },
    { $set: { ...plan.next, updatedAt: now } },
  );
  if (r.matchedCount !== 1)
    throw new Error("The book changed in Roza while applying reorder/archive/rename. Those edits were not written. Check status again.");
  for (const m of plan.messages) log("ok", m);
  return plan.messages;
}

export async function prodStatus(root: string, slug: string): Promise<ProdStatus> {
  const loaded = loadBook(root, slug);
  if (loaded.errors.length) throw new Error(`Fix local errors first: ${loaded.errors[0]}`);
  return withDb(root, async (conn, cfg) => computeStatus(loaded, await findProdBook(conn, loaded), cfg));
}

/* ---------- uploading ---------- */

export async function upload(
  root: string,
  slug: string,
  options: UploadOptions,
  log: Logger = noLog,
): Promise<UploadResult> {
  const loaded = loadBook(root, slug);
  if (loaded.errors.length) throw new Error(`Fix local errors first: ${loaded.errors[0]}`);

  return withDb(root, (conn, cfg) => uploadWith(conn, cfg, loaded, options, log));
}

function logNotes(log: Logger, built: BuiltChapter[]) {
  const moved = built.reduce((n, b) => n + b.moved, 0);
  const detached = built.reduce((n, b) => n + b.detached, 0);
  if (moved) log("info", `Re-attached ${moved} note(s) to their quote in the new text.`);
  if (detached) log("warn", `${detached} note(s) lost their quote and will show in Roza as "Unattached · text removed".`);
}

/** Upload using an open connection (exported for tests). */
export async function uploadWith(
  conn: Connection,
  cfg: DbConfig,
  loaded: LoadedBook,
  options: UploadOptions,
  log: Logger = noLog,
): Promise<UploadResult> {
  log("info", `Connected to "${cfg.dbName}" on ${maskHost(cfg.url)}.`);
  const Book = bookModelFor(conn) as Model<any>;
  const prod = await findProdBook(conn, loaded);

  if (!prod) {
    log("info", `"${loaded.book.bookName}" is not in prod yet. Creating it.`);
    const { doc, bookId, chapterIds, boards } = buildNewBook(loaded, Book);
    await doc.validate();
    validatePlanning(plain(toObj(doc)), String(bookId));
    await doc.save();
    writeBoardsBack(loaded, boards);
    const now = new Date().toISOString();
    saveState(loaded, {
      prodBookId: String(bookId),
      dbName: cfg.dbName,
      lastUploadAt: now,
      lastSyncAt: now,
      chapters: Object.fromEntries(chapterIds),
      fullPrints: Object.fromEntries(loaded.chapters.map((c) => [c.file, chapterPrint(localChapterContent(c.data))])),
      fullEntityPrints: Object.fromEntries(
        ENTITY_KINDS.flatMap((k) =>
          Object.entries(localEntities(loaded, k)).map(([n, v]) => [`${k}:${n}`, fullEntityPrint(localEntityContent(k, v))]),
        ),
      ),
      bookPrint: bookPrint(localBookContent(loaded)),
    });
    const counts = Object.fromEntries(ENTITY_KINDS.map((k) => [k, Object.keys(loaded.book[k] || {}).length]));
    log("ok", `Created book ${bookId} with ${loaded.chapters.length} chapter(s).`);
    return {
      created: true,
      prodBookId: String(bookId),
      added: { chapters: loaded.chapters.length, ...counts } as UploadResult["added"],
      overwritten: 0,
      updatedEntities: 0,
      edits: [],
    };
  }

  const bookId = prod._id as Types.ObjectId;
  const backupPath = writeBackup(loaded, prod);
  log("info", `Backed up the current prod book to ${backupPath}`);

  // Story elements Roza doesn't have yet.
  const newEntities = Object.fromEntries(
    ENTITY_KINDS.map((kind) => {
      const existing = new Set(live(prod[kind]).map((x) => x.name));
      const wanted = new Set(Object.keys(loaded.book[kind] || {}).filter((n) => !existing.has(n)));
      return [kind, buildEntities(loaded, bookId, kind, wanted)];
    }),
  ) as unknown as Record<EntityKind, ProdItem[]>;
  const ids = idMapOf(
    Object.fromEntries(PLANNING_KINDS.map((k) => [k, [...live(prod[k]), ...newEntities[k]]])),
  );

  // Existing story elements the user chose to update: rebuilt from book.json, keeping Roza's _id.
  const wantUpdate = new Set(options.updateEntities || []);
  const updatedEntities = Object.fromEntries(
    ENTITY_KINDS.map((kind) => {
      const localMap = localEntities(loaded, kind);
      const items = live(prod[kind])
        .filter((x) => wantUpdate.has(`${kind}:${x.name}`) && x.name in localMap)
        .filter((x) => entityDiffers(kind, localMap[x.name], x))
        .map((x) => ({ ...buildEntities(loaded, bookId, kind, new Set([x.name]))[0], _id: x._id }));
      return [kind, items];
    }),
  ) as unknown as Record<EntityKind, ProdItem[]>;
  const updatedCount = ENTITY_KINDS.reduce((n, k) => n + updatedEntities[k].length, 0);

  // The book's own fields (name, word goal, task board), when ticked. Fields book.json leaves out stay as they are.
  const bookFields: Record<string, unknown> = {};
  let unsetWordGoal = false;
  if (wantUpdate.has(BOOK_SETTINGS_KEY) && bookChangeOf(loaded, prod)) {
    const b = loaded.book;
    if (b.bookName !== prod.name) bookFields.name = b.bookName;
    if (b.wordGoal === null) unsetWordGoal = prod.wordGoal != null;
    else if (b.wordGoal !== undefined && b.wordGoal !== prod.wordGoal) bookFields.wordGoal = b.wordGoal;
    if (b.taskBoard !== undefined && hashOf(b.taskBoard) !== hashOf(prod.taskBoard)) bookFields.taskBoard = b.taskBoard;
  }
  const bookUpdate = Object.keys(bookFields).length > 0 || unsetWordGoal;

  const matches = matchChapters(loaded, prod);
  const overwrite = new Set(options.overwriteChapters);
  const pairsNew = matches.filter((m) => !m.prod).map((m) => ({ m, b: buildChapter(m.local.data, bookId, ids) }));
  const pairsReplaced = matches
    .filter((m) => m.prod && m.differs && overwrite.has(m.local.file))
    .map((m) => ({ m, b: buildChapter(m.local.data, bookId, ids, m.prod!._id, m.prod) }));
  const builtNew = pairsNew.map((p) => p.b);
  const builtReplaced = pairsReplaced.map((p) => p.b);
  logNotes(log, builtReplaced);

  if (!builtNew.length && !builtReplaced.length && !updatedCount && !bookUpdate && ENTITY_KINDS.every((k) => !newEntities[k].length)) {
    const edits = await applyProdEdits(conn, loaded, bookId, log);
    if (!edits.length) log("ok", "Prod is already up to date. Nothing to write.");
    const fresh = await conn.collection("books").findOne({ _id: bookId });
    saveIds(loaded, cfg, fresh || prod);
    return { created: false, prodBookId: String(bookId), added: zeroCounts(), overwritten: 0, updatedEntities: 0, edits, backupPath };
  }

  // Cast + validate everything through Roza's schema.
  const temp = new Book({
    _id: bookId,
    userId: prod.userId,
    name: (bookFields.name as string) ?? prod.name,
    ...(bookFields.taskBoard ? { taskBoard: bookFields.taskBoard } : {}),
    ...(bookFields.wordGoal !== undefined ? { wordGoal: bookFields.wordGoal } : {}),
    chapters: [...builtNew, ...builtReplaced].map((b) => b.chapter),
    ...Object.fromEntries(ENTITY_KINDS.map((k) => [k, [...newEntities[k], ...updatedEntities[k]]])),
  });
  await temp.validate();
  const cast = toObj(temp);
  const now = new Date();
  const replacedFields = new Map(builtReplaced.map((b) => [String(b.chapter._id), b.fields]));
  const castChapters: ProdItem[] = cast.chapters.map((c: ProdItem) => ({ ...c, createdAt: now, updatedAt: now }));
  const castNew = castChapters.filter((c) => !replacedFields.has(String(c._id)));
  const castReplaced = castChapters.filter((c) => replacedFields.has(String(c._id)));
  const updatedIds = new Set(ENTITY_KINDS.flatMap((k) => updatedEntities[k].map((x) => String(x._id))));
  const castAll = Object.fromEntries(
    ENTITY_KINDS.map((k) => [k, (cast[k] || []).map((x: ProdItem) => ({ ...x, createdAt: now, updatedAt: now }))]),
  ) as Record<EntityKind, ProdItem[]>;
  const castEntities = Object.fromEntries(
    ENTITY_KINDS.map((k) => [k, castAll[k].filter((x) => !updatedIds.has(String(x._id)))]),
  ) as Record<EntityKind, ProdItem[]>;
  const castUpdated = Object.fromEntries(
    ENTITY_KINDS.map((k) => [k, castAll[k].filter((x) => updatedIds.has(String(x._id)))]),
  ) as Record<EntityKind, ProdItem[]>;
  const castBook: Record<string, unknown> = {};
  for (const f of Object.keys(bookFields)) castBook[f] = cast[f];

  // Validate the merged result the same way Roza's save would.
  const merged = plain(prod);
  merged.chapters = [
    ...(prod.chapters || []).map((c: ProdItem) => {
      const r = castReplaced.find((x) => String(x._id) === String(c._id));
      if (!r) return c;
      const out = { ...c };
      for (const f of replacedFields.get(String(c._id))!) out[f] = r[f];
      return out;
    }),
    ...castNew,
  ];
  for (const k of ENTITY_KINDS)
    merged[k] = [
      ...(prod[k] || []).map((x: ProdItem) => castUpdated[k].find((u) => String(u._id) === String(x._id)) || x),
      ...castEntities[k],
    ];
  Object.assign(merged, plain(castBook));
  validatePlanning(plain(merged), String(bookId));

  const coll = conn.collection("books");
  let expectedUpdatedAt = prod.updatedAt;
  const edits: string[] = [];

  if (castReplaced.length || updatedCount || bookUpdate) {
    const $set: Record<string, unknown> = { updatedAt: now, ...castBook };
    const $unset: Record<string, ""> = {};
    if (unsetWordGoal) $unset.wordGoal = "";
    const arrayFilters: Record<string, unknown>[] = castReplaced.map((c, i) => {
      const f = `c${i}`;
      for (const field of replacedFields.get(String(c._id))!) $set[`chapters.$[${f}].${field}`] = c[field];
      $set[`chapters.$[${f}].updatedAt`] = now;
      return { [`${f}._id`]: c._id };
    });
    let e = 0;
    for (const k of ENTITY_KINDS)
      for (const x of castUpdated[k]) {
        const f = `e${e++}`;
        for (const field of k === "notes" ? ["text"] : k === "characters" ? ["description"] : ["description", "color"])
          $set[`${k}.$[${f}].${field}`] = x[field];
        $set[`${k}.$[${f}].updatedAt`] = now;
        arrayFilters.push({ [`${f}._id`]: x._id });
      }
    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;
    const r = await coll.updateOne({ _id: bookId, updatedAt: expectedUpdatedAt }, update, { arrayFilters });
    if (r.matchedCount !== 1)
      throw new Error("The book changed in Roza while uploading. Nothing was written. Check status again.");
    expectedUpdatedAt = now;
    if (castReplaced.length) log("ok", `Updated ${castReplaced.length} chapter(s) in Roza.`);
    if (updatedCount) log("ok", `Updated ${updatedCount} story element(s) in Roza.`);
    if (bookUpdate) {
      const what = [...Object.keys(bookFields), ...(unsetWordGoal ? ["wordGoal (removed)"] : [])].join(", ");
      edits.push(`Updated the book's ${what}`);
      log("ok", `Updated the book's ${what} in Roza.`);
    }
  }

  const $push: Record<string, any> = {};
  if (castNew.length) $push.chapters = { $each: castNew };
  for (const k of ENTITY_KINDS) if (castEntities[k].length) $push[k] = { $each: castEntities[k] };
  if (Object.keys($push).length) {
    const r = await coll.updateOne(
      { _id: bookId, updatedAt: expectedUpdatedAt },
      { $push, $set: { updatedAt: new Date(now.getTime() + 1) } },
    );
    if (r.matchedCount !== 1)
      throw new Error(
        expectedUpdatedAt !== prod.updatedAt
          ? "Updated items were saved, but adding new items failed because the book changed. Check status again."
          : "The book changed in Roza while uploading. Nothing was written. Check status again.",
      );
    log("ok", `Added ${castNew.length} chapter(s) and ${ENTITY_KINDS.map((k) => `${castEntities[k].length} ${k}`).join(", ")}.`);
  }

  edits.push(...(await applyProdEdits(conn, loaded, bookId, log)));
  writeLocalFixes(loaded, [...pairsNew, ...pairsReplaced], log);
  const fresh = await coll.findOne({ _id: bookId });
  saveIds(loaded, cfg, fresh || prod);
  return {
    created: false,
    edits,
    prodBookId: String(bookId),
    added: {
      chapters: castNew.length,
      ...(Object.fromEntries(ENTITY_KINDS.map((k) => [k, castEntities[k].length])) as Record<EntityKind, number>),
    },
    overwritten: castReplaced.length,
    updatedEntities: updatedCount,
    backupPath,
  };
}

/** Notes that a push re-attached are written back to the local chapter files, so both sides match. */
function writeLocalFixes(loaded: LoadedBook, built: { m: ChapterMatch; b: BuiltChapter }[], log: Logger) {
  for (const { m, b } of built) {
    if (!b.localFix) continue;
    const file = path.join(loaded.dir, "chapters", m.local.file);
    const data = { ...JSON.parse(fs.readFileSync(file, "utf8")), ...b.localFix };
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    Object.assign(m.local.data, b.localFix);
    log("info", `Updated the note positions in chapters/${m.local.file} to match.`);
  }
}

const zeroCounts = (): UploadResult["added"] => ({ chapters: 0, characters: 0, themes: 0, plotlines: 0, notes: 0 });

/** After a push: remember chapter ids, and fingerprints of everything that is now the same on both sides. */
function saveIds(loaded: LoadedBook, cfg: DbConfig, prod: ProdBook) {
  const matches = matchChapters(loaded, prod);
  const fullPrints: Record<string, string> = {};
  for (const m of matches) {
    if (!m.prod) continue;
    if (!m.differs) fullPrints[m.local.file] = chapterPrint(m.localContent);
    else if (loaded.state.fullPrints?.[m.local.file]) fullPrints[m.local.file] = loaded.state.fullPrints[m.local.file];
  }
  const fullEntityPrints: Record<string, string> = { ...(loaded.state.fullEntityPrints || {}) };
  for (const kind of ENTITY_KINDS) {
    const localMap = localEntities(loaded, kind);
    for (const item of live(prod[kind]))
      if (item.name in localMap && !entityDiffers(kind, localMap[item.name], item))
        fullEntityPrints[`${kind}:${item.name}`] = fullEntityPrint(localEntityContent(kind, localMap[item.name]));
  }
  const local = localBookContent(loaded);
  const now = new Date().toISOString();
  saveState(loaded, {
    ...loaded.state,
    prodBookId: String(prod._id),
    dbName: cfg.dbName,
    lastUploadAt: now,
    lastSyncAt: now,
    chapters: Object.fromEntries(matches.filter((m) => m.prod).map((m) => [m.local.file, String(m.prod!._id)])),
    fullPrints,
    fullEntityPrints,
    bookPrint: bookPrint(local) === bookPrint(prodBookContent(prod)) ? bookPrint(local) : loaded.state.bookPrint,
  });
}
