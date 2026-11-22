/** Pull selected live changes into the staged project. */
import type { EntityKind, LocalChapterFile, PullOptions, PullResult } from "../../../../shared/types/stagingRoom";
import { LoadedBook, saveState } from "./bookFiles";
import type { Backup, DbInfo } from "./storageTypes";
import {
  bookPrint,
  chapterPrint,
  clean,
  entityPrint,
  entityToLocal,
  liveNames,
  localChapterContent,
  PLANNING_KINDS,
  prodBookContent,
  prodChapterContent,
  prodEntityContent,
} from "./fullData";
import { BOOK_SETTINGS_KEY, Logger, matchChapters } from "./sync";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ProdItem = Record<string, any>;

const ENTITY_KINDS: EntityKind[] = ["characters", "themes", "plotlines", "notes"];
const live = (items: ProdItem[] | undefined) => (items || []).filter((x) => x && x.isArchived !== true);
const noLog: Logger = () => undefined;

/** Pull using an open connection (exported for tests). */
export async function pullWith(
  cfg: DbInfo,
  loaded: LoadedBook,
  options: PullOptions,
  backup: Backup,
  prod: ProdItem | null,
  log: Logger = noLog,
): Promise<PullResult> {
  if (!prod) throw new Error(`"${loaded.book.bookName}" is not in "${cfg.dbName}" yet. Nothing to pull.`);
  const wantChapters = new Set(options.chapters);
  const wantEntities = new Set(options.entities);
  if (!wantChapters.size && !wantEntities.size) {
    log("ok", "Nothing selected to pull.");
    return { chapters: 0, entities: 0 };
  }

  const backupDir = await backup("staged", { book: loaded.book, chapters: loaded.chapters, state: loaded.state });
  log("info", `Saved a staged project snapshot ${backupDir}`);

  const names = liveNames(prod);
  const state = {
    ...loaded.state,
    chapters: { ...(loaded.state.chapters || {}) },
    fullPrints: { ...(loaded.state.fullPrints || {}) },
    fullEntityPrints: { ...(loaded.state.fullEntityPrints || {}) },
  };
  const usedNumbers = new Set(loaded.chapters.map((c) => c.data.number));
  const pad = (n: number) => String(n).padStart(2, "0");
  let pulledChapters = 0;
  /** story elements the pulled chapters link to */
  const linked = new Set<string>();

  /** The whole Roza chapter as a local file. Fields Roza doesn't have are left out. */
  const fromProd = (ch: ProdItem, number: number): LocalChapterFile => {
    const c = prodChapterContent(ch, names);
    const data: LocalChapterFile = {
      number,
      name: c.name,
      format: c.format as LocalChapterFile["format"],
      ...(c.description ? { description: c.description } : {}),
      text: c.text,
      planning: c.planning,
    };
    if (c.annotations !== undefined) data.annotations = c.annotations;
    if (c.drafts !== undefined) data.drafts = c.drafts;
    if (c.taskBoard !== undefined) data.taskBoard = clean(c.taskBoard);
    for (const k of PLANNING_KINDS) for (const n of Object.keys(c.planning[k] || {})) linked.add(`${k}:${n}`);
    return data;
  };

  const writeChapter = (file: string, data: LocalChapterFile, prodId: string) => {
    const index = loaded.chapters.findIndex(chapter => chapter.file === file);
    const chapter = { file, data, mtimeMs: Date.now() };
    if (index < 0) loaded.chapters.push(chapter);
    else loaded.chapters[index] = chapter;
    state.chapters[file] = prodId;
    state.fullPrints[file] = chapterPrint(localChapterContent(data));
    pulledChapters++;
  };

  // 1. Chapters that exist locally and in prod.
  for (const m of matchChapters(loaded, prod)) {
    if (!m.prod || !wantChapters.has(m.local.file)) continue;
    const data = fromProd(m.prod, m.local.data.number);
    writeChapter(m.local.file, data, String(m.prod._id));
    const notes = data.annotations?.length || 0;
    log("ok", `Pulled "${data.name}" into chapters/${m.local.file}${notes ? ` (${notes} note(s))` : ""}.`);
  }

  // 2. Chapters that only exist in Roza: new local files, numbered by their place in Roza.
  live(prod.chapters).forEach((ch, index) => {
    if (!wantChapters.has(`prod:${ch._id}`)) return;
    let number = index + 1;
    if (usedNumbers.has(number)) number = Math.max(0, ...usedNumbers) + 1;
    usedNumbers.add(number);
    let file = `${pad(number)}.json`;
    if (loaded.chapters.some(chapter => chapter.file === file)) file = `${pad(number)}-${String(ch._id).slice(-4)}.json`;
    const data = fromProd(ch, number);
    writeChapter(file, data, String(ch._id));
    log("ok", `Pulled new chapter "${data.name}" into chapters/${file}.`);
  });

  const book = loaded.book;
  const editableBook = book as Record<EntityKind, Record<string, ReturnType<typeof entityToLocal>> | undefined>;
  // Story elements a pulled chapter links to must exist locally, or the chapter would not validate.
  for (const key of linked) {
    const [rawKind, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    const kind = rawKind as EntityKind;
    if (!(name in (book[kind] || {})) && !wantEntities.has(key)) {
      wantEntities.add(key);
      log("info", `Also pulling ${kind.replace(/s$/, "")} "${name}", which a pulled chapter links to.`);
    }
  }
  let pulledEntities = 0;
  let bookChanged = false;
  for (const kind of ENTITY_KINDS)
    for (const item of live(prod[kind])) {
      const key = `${kind}:${item.name}`;
      if (!wantEntities.has(key)) continue;
      const entries = editableBook[kind] ?? (editableBook[kind] = {});
      Object.defineProperty(entries, item.name, { value: entityToLocal(kind, item), enumerable: true, writable: true, configurable: true });
      state.fullEntityPrints[key] = entityPrint(prodEntityContent(kind, item));
      pulledEntities++;
      bookChanged = true;
    }
  if (pulledEntities) log("ok", `Pulled ${pulledEntities} story element(s) into book.json.`);

  let bookState = loaded.state.bookPrint;
  if (wantEntities.has(BOOK_SETTINGS_KEY)) {
    const c = prodBookContent(prod);
    book.bookName = c.name;
    if (c.wordGoal != null) book.wordGoal = c.wordGoal;
    else delete book.wordGoal;
    if (c.taskBoard !== undefined) book.taskBoard = c.taskBoard;
    else delete book.taskBoard;
    bookState = bookPrint(c);
    bookChanged = true;
    pulledEntities++;
    log("ok", "Pulled the book's name, word goal and task board into book.json.");
  }
  if (bookChanged) loaded.bookMtimeMs = Date.now();

  saveState(loaded, {
    ...state,
    bookPrint: bookState,
    prodBookId: String(prod._id),
    dbName: cfg.dbName,
    lastSyncAt: new Date().toISOString(),
  });
  return { chapters: pulledChapters, entities: pulledEntities, backupDir };
}
