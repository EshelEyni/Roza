/**
 * Reject staged changes: put the live Writing Studio version back into Staging.
 * Writing Studio itself is never changed here.
 *
 * A whole item that Writing Studio has is pulled again. A whole item that only
 * Staging has is removed. A part of a chapter (its text, one text change, one note,
 * one draft, its details, planning or tasks) is copied from Writing Studio alone.
 */
import type { ChapterAnnotation, EntityKind, LocalChapterFile, RevertResult, RevertTarget, SlateElement } from "../../../../shared/types/stagingRoom";
import { LoadedBook, validateBook } from "./bookFiles";
import type { Backup, DbInfo } from "./storageTypes";
import { ChapterContent, clean, PLANNING_KINDS, reattachNotes } from "./fullData";
import { pullWith } from "./pull";
import { changeRuns, textLines } from "./review";
import { BOOK_SETTINGS_KEY, ChapterMatch, Logger, matchChapters, validateProject } from "./sync";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ProdBook = Record<string, any>;

const ENTITY_KINDS: EntityKind[] = ["characters", "themes", "plotlines", "notes"];
const copy = <T>(value: T): T => structuredClone(value);
const live = (items: any[] | undefined) => (items || []).filter((x) => x && x.isArchived !== true);

export class RevertError extends Error {}

/** Moves notes after a replaced run of paragraphs, so they keep pointing at the same text. */
function shiftNotes(notes: ChapterAnnotation[] | undefined, after: number, delta: number) {
  if (!notes || !delta) return notes;
  return notes.map((n) => {
    if (!n.anchor || n.anchor.anchor.path[0] < after) return n;
    const move = (p: { path: number[]; offset: number }) => ({ ...p, path: [p.path[0] + delta, ...p.path.slice(1)] });
    return { ...n, anchor: { anchor: move(n.anchor.anchor), focus: move(n.anchor.focus) } };
  });
}

function setOrDelete<K extends keyof LocalChapterFile>(data: LocalChapterFile, field: K, value: LocalChapterFile[K] | undefined) {
  if (value === undefined) delete data[field];
  else data[field] = copy(value);
}

/** Replaces one note or draft (by id) with Writing Studio's, or removes it when Writing Studio has none. */
function replaceById<T extends { id: string }>(local: T[] | undefined, studio: T[] | undefined, id: string): T[] {
  const list = [...(local || [])];
  const index = list.findIndex((x) => x.id === id);
  const theirs = studio?.find((x) => x.id === id);
  if (!theirs) {
    if (index < 0) throw new RevertError("That note or draft is no longer different. Compare again.");
    list.splice(index, 1);
  } else if (index < 0) list.push(copy(theirs));
  else list[index] = copy(theirs);
  return list;
}

function revertPart(m: ChapterMatch, targets: RevertTarget[], needEntities: Set<string>, loaded: LoadedBook) {
  const data = m.local.data;
  const studio = m.prodContent as ChapterContent;
  const hunks = targets.filter((t) => t.part === "text" && t.hunk !== undefined).map((t) => t.hunk!);
  const wholeText = targets.some((t) => t.part === "text" && t.hunk === undefined);

  if (wholeText) {
    data.text = copy(studio.text) as LocalChapterFile["text"];
  } else if (hunks.length) {
    const runs = changeRuns(textLines(data.text), textLines(studio.text));
    let text = [...data.text] as SlateElement[];
    let notes = data.annotations;
    // From the end, so earlier paragraph numbers stay right.
    for (const h of [...new Set(hunks)].sort((a, b) => runs[b]?.a0 - runs[a]?.a0)) {
      const run = runs[h];
      if (!run) throw new RevertError("That change is no longer in the text. Compare again.");
      const incoming = copy(studio.text.slice(run.b0, run.b1));
      text = [...text.slice(0, run.a0), ...incoming, ...text.slice(run.a1)];
      notes = shiftNotes(notes, run.a1, incoming.length - (run.a1 - run.a0));
    }
    data.text = text as LocalChapterFile["text"];
    data.annotations = notes;
  }

  for (const t of targets) {
    if (t.part === "notes") {
      if (t.itemId) data.annotations = replaceById(data.annotations, studio.annotations, t.itemId);
      else setOrDelete(data, "annotations", studio.annotations);
    } else if (t.part === "drafts") {
      if (t.itemId) data.drafts = replaceById(data.drafts, studio.drafts, t.itemId);
      else setOrDelete(data, "drafts", studio.drafts);
    } else if (t.part === "details") {
      data.name = studio.name;
      data.format = studio.format as LocalChapterFile["format"];
      setOrDelete(data, "description", studio.description as LocalChapterFile["description"]);
      setOrDelete(data, "mainSourceDraftId", studio.mainSourceDraftId);
    } else if (t.part === "planning") {
      data.planning = copy(studio.planning);
      for (const k of PLANNING_KINDS)
        for (const name of Object.keys(studio.planning[k] || {}))
          if (!(name in (loaded.book[k] || {}))) needEntities.add(`${k}:${name}`);
    } else if (t.part === "tasks") {
      setOrDelete(data, "taskBoard", studio.taskBoard ? clean(studio.taskBoard) : undefined);
    } else if (t.part !== "text") {
      throw new RevertError(`Unknown part "${t.part}".`);
    }
  }
  // Text moved: notes find their quote again (or become unattached).
  if (data.annotations) data.annotations = reattachNotes(data.text, data.annotations).notes;
  m.local.mtimeMs = Date.now();
}

/** Removes a story element that only Staging has, with the chapter links to it. */
function removeEntity(loaded: LoadedBook, kind: EntityKind, name: string) {
  const entries = loaded.book[kind] as Record<string, unknown> | undefined;
  if (!entries || !(name in entries)) throw new RevertError(`"${name}" is not in Staging.`);
  delete entries[name];
  if (kind !== "notes")
    for (const chapter of loaded.chapters) {
      const links = chapter.data.planning?.[kind];
      if (links && name in links) {
        delete links[name];
        chapter.mtimeMs = Date.now();
      }
    }
  loaded.bookMtimeMs = Date.now();
}

export async function revertWith(
  cfg: DbInfo,
  loaded: LoadedBook,
  targets: RevertTarget[],
  backup: Backup,
  prod: ProdBook | null,
  log: Logger,
): Promise<RevertResult> {
  if (!targets.length) return { reverted: 0 };
  const backupDir = await backup("staged", { book: loaded.book, chapters: loaded.chapters, state: loaded.state });
  log("info", `Saved a staged project snapshot ${backupDir}`);

  const matches = matchChapters(loaded, prod);
  const byFile = new Map(matches.map((m) => [m.local.file, m]));
  const pullChapters = new Set<string>();
  const pullEntities = new Set<string>();
  const partTargets = new Map<string, RevertTarget[]>();
  const removeFiles = new Set<string>();

  for (const t of targets) {
    if (t.key === BOOK_SETTINGS_KEY) pullEntities.add(t.key);
    else if (t.key.startsWith("prod:")) pullChapters.add(t.key);
    else if (byFile.has(t.key)) {
      const m = byFile.get(t.key)!;
      if (!m.prod) {
        if (t.part) throw new RevertError(`"${m.local.data.name}" is new in Staging. Reject the whole chapter.`);
        removeFiles.add(t.key);
      } else if (!t.part) pullChapters.add(t.key);
      else partTargets.set(t.key, [...(partTargets.get(t.key) || []), t]);
    } else {
      const colon = t.key.indexOf(":");
      const kind = t.key.slice(0, colon) as EntityKind;
      const name = t.key.slice(colon + 1);
      if (colon < 0 || !ENTITY_KINDS.includes(kind)) throw new RevertError(`Unknown item "${t.key}".`);
      if (live(prod?.[kind]).some((x) => x.name === name)) pullEntities.add(t.key);
      else {
        removeEntity(loaded, kind, name);
        log("ok", `Removed ${kind.replace(/s$/, "")} "${name}" from Staging.`);
      }
    }
  }

  for (const file of removeFiles) {
    const chapter = loaded.chapters.find((c) => c.file === file)!;
    loaded.chapters = loaded.chapters.filter((c) => c.file !== file);
    const state = { ...loaded.state };
    for (const field of ["chapters", "prints", "fullPrints"] as const)
      if (state[field]) {
        state[field] = { ...state[field] };
        delete state[field]![file];
      }
    loaded.state = state;
    log("ok", `Removed new chapter "${chapter.data.name}" from Staging.`);
  }

  const needEntities = new Set<string>();
  for (const [file, list] of partTargets) {
    if (pullChapters.has(file)) continue;
    revertPart(byFile.get(file)!, list, needEntities, loaded);
    log("ok", `Put back Writing Studio's ${[...new Set(list.map((t) => t.part))].join(", ")} in "${byFile.get(file)!.local.data.name}".`);
  }
  for (const key of needEntities) pullEntities.add(key);

  if (pullChapters.size || pullEntities.size) {
    if (!prod) throw new RevertError("The book is not in Writing Studio yet. There is nothing to restore from.");
    await pullWith(cfg, loaded, { chapters: [...pullChapters], entities: [...pullEntities] }, async () => backupDir, prod, log);
  }

  loaded.errors = validateBook(loaded.book, loaded.chapters);
  const errors = await validateProject(loaded);
  if (errors.length) throw new RevertError(`Nothing was changed. Rejecting would leave Staging invalid: ${errors[0]}`);
  return { reverted: targets.length, backupDir };
}
