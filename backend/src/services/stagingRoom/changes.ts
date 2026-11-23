/**
 * Staging Room v2: a basket of changes on top of the live Writing Studio book.
 * See docs/staging-room-prd.md.
 *
 * - The live book is always the truth. Staging only holds additions.
 * - Text changes remember the hash of the Main text they were based on. Approving
 *   never overwrites manual work: a Main edit whose base changed becomes a draft.
 * - Nothing here deletes anything from the live book.
 */
import { randomUUID } from "node:crypto";
import mongoose, { Connection, Model, Types } from "mongoose";
import type {
  ApproveResult,
  ChangeGroup,
  ChangeView,
  ChapterAnnotation,
  EntityKind,
  LiveChapter,
  LiveCopy,
  LiveElement,
  ReadView,
  SlateElement,
  StagedChange,
} from "../../../../shared/types/stagingRoom";
import { DEFAULT_COLOR, findQuote, hashOf, reattachNotes } from "./fullData";
import { validatePlanning } from "./planningValidation";
import { bookModelFor } from "./rozaSchema";
import { countWords, elementText, toSlate } from "./slate";
import { markNew } from "./textDiff";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const ELEMENT_KINDS: EntityKind[] = ["characters", "themes", "plotlines", "notes"];
const SINGULAR: Record<EntityKind, string> = { characters: "Character", themes: "Theme", plotlines: "Plotline", notes: "Note" };

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
const liveItems = (items: Raw[] | undefined) => (items || []).filter((x) => x && x.isArchived !== true);

export const textHash = (text: unknown) => hashOf(plain(text ?? []));
export const elementHash = (color: string | undefined, text: unknown) => hashOf({ color: color ?? null, text: plain(text ?? []) });

/* ---------- the live copy ---------- */

function liveElement(kind: EntityKind, x: Raw): LiveElement {
  const text = plain((kind === "notes" ? x.text : x.description) ?? []) as SlateElement[];
  const color = kind === "themes" || kind === "plotlines" ? x.color || DEFAULT_COLOR : undefined;
  return { name: String(x.name ?? ""), ...(color ? { color } : {}), text, hash: elementHash(color, text) };
}

/** The read-only copy of a live book that Claude and the Staging Room read. */
export function liveCopyOf(book: Raw): LiveCopy {
  const chapters: LiveChapter[] = liveItems(book.chapters).map((c) => ({
    id: String(c._id),
    name: String(c.name ?? ""),
    format: c.format === "screenplay" ? "screenplay" : "prose",
    text: plain(c.text ?? []),
    mainHash: textHash(c.text),
    annotations: plain(c.annotations ?? []),
    drafts: (c.drafts || [])
      .filter((d: Raw) => d.kind !== "main-backup")
      .map((d: Raw) => ({ id: String(d.id), name: String(d.name ?? ""), words: countWords(d.text) })),
  }));
  const elements = Object.fromEntries(
    ELEMENT_KINDS.map((k) => [k, liveItems(book[k]).map((x) => liveElement(k, x))]),
  ) as Record<EntityKind, LiveElement[]>;
  return {
    bookId: String(book._id),
    name: String(book.name ?? ""),
    updatedAt: new Date(book.updatedAt ?? 0).toISOString(),
    chapters,
    ...elements,
    copiedAt: new Date().toISOString(),
  };
}

export async function readLiveBook(conn: Connection, bookId: string, userId: string): Promise<Raw | null> {
  if (!Types.ObjectId.isValid(bookId) || !Types.ObjectId.isValid(userId)) return null;
  const book = await conn.collection("books").findOne({ _id: new Types.ObjectId(bookId), userId: new Types.ObjectId(userId) });
  return book && book.isArchived !== true ? book : null;
}

/* ---------- what the Changes screen shows ---------- */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const words = (text: SlateElement[] | undefined) => countWords(text).toLocaleString("en-US");

export function changeTitle(c: StagedChange, live: LiveCopy | undefined): string {
  const chapter = (id: string) => live?.chapters.find((x) => x.id === id)?.name ?? "a removed chapter";
  switch (c.kind) {
    case "draft":
      return `Draft “${c.name}” · ${chapter(c.chapterId)}`;
    case "main":
      return `Main text · ${chapter(c.chapterId)}`;
    case "chapter":
      return `New chapter · ${c.name}`;
    case "element":
      return `${SINGULAR[c.element]} · ${c.name}`;
    case "notes":
      return `${plural(c.notes.length, "note")} · ${chapter(c.chapterId)}`;
    case "tasks":
      return plural(c.tasks.length, "task");
  }
}

function elementConflict(c: Extract<StagedChange, { kind: "element" }>, live: LiveCopy | undefined): boolean {
  if (!live) return false;
  const current = live[c.element].find((x) => x.name === c.name);
  if (c.baseHash === null) return !!current;
  return !current || current.hash !== c.baseHash;
}

/** The pending changes, grouped and described for the Changes screen. */
export function changeViews(changes: StagedChange[], live: LiveCopy | undefined): ChangeView[] {
  const order = new Map((live?.chapters ?? []).map((c, i) => [c.id, i]));
  const chapterGroup = (id: string): ChangeGroup => {
    const ch = live?.chapters.find((x) => x.id === id);
    return { type: "chapter", chapterId: id, name: ch?.name ?? "Removed chapter", order: order.get(id) ?? 9_000 };
  };
  // New chapters sit after the chapter they follow.
  const newOrder = (c: Extract<StagedChange, { kind: "chapter" }>, seen = new Set<string>()): number => {
    if (!c.afterId) return 10_000 + changes.indexOf(c);
    if (order.has(c.afterId)) return order.get(c.afterId)! + 0.5;
    const before = changes.find((x): x is Extract<StagedChange, { kind: "chapter" }> => x.kind === "chapter" && x.id === c.afterId);
    if (!before || seen.has(before.id)) return 10_000 + changes.indexOf(c);
    return newOrder(before, seen.add(c.id)) + 0.01;
  };
  return changes.map((c): ChangeView => {
    const base = { id: c.id, kind: c.kind, updatedAt: c.updatedAt, title: changeTitle(c, live) };
    const missing = (id: string) => (live && !live.chapters.some((x) => x.id === id) ? "This chapter is no longer in Writing Studio." : undefined);
    switch (c.kind) {
      case "draft": {
        const notes = c.notes?.length ? ` · ${plural(c.notes.length, "note")}` : "";
        return {
          ...base,
          title: `Draft “${c.name}”`,
          group: chapterGroup(c.chapterId),
          tag: "NEW DRAFT",
          tone: "new",
          meta: `${words(c.text)} words${notes} · approving adds it as a draft, Main stays as it is`,
          readable: true,
          editable: true,
          warning: missing(c.chapterId),
        };
      }
      case "main": {
        const ch = live?.chapters.find((x) => x.id === c.chapterId);
        return {
          ...base,
          title: "Edit to Main",
          group: chapterGroup(c.chapterId),
          tag: "MAIN EDIT",
          tone: "changed",
          meta: `${words(c.text)} words · replaces the Main text`,
          readable: true,
          editable: true,
          warning:
            missing(c.chapterId) ??
            (ch && ch.mainHash !== c.baseHash ? "You changed Main in Writing Studio since. Approving adds this as a draft instead." : undefined),
        };
      }
      case "chapter":
        return {
          ...base,
          title: c.name,
          group: { type: "chapter", chapterId: c.id, name: `${c.name} (new)`, order: newOrder(c) },
          tag: "NEW CHAPTER",
          tone: "new",
          meta: `${words(c.text)} words · becomes the chapter’s Main`,
          readable: true,
          editable: true,
        };
      case "element": {
        const isNew = c.baseHash === null;
        return {
          ...base,
          group: { type: "elements" },
          tag: isNew ? "NEW" : "CHANGED",
          tone: isNew ? "new" : "changed",
          meta: isNew ? `New ${SINGULAR[c.element].toLowerCase()}` : "Description updated",
          readable: true,
          editable: false,
          warning: elementConflict(c, live) ? "Changed in Writing Studio since Claude read it." : undefined,
        };
      }
      case "notes":
        return {
          ...base,
          title: `Notes on Main`,
          group: chapterGroup(c.chapterId),
          tag: plural(c.notes.length, "NOTE").toUpperCase(),
          tone: "new",
          meta: "Added to the chapter’s Main text",
          readable: false,
          editable: false,
          warning: missing(c.chapterId),
        };
      case "tasks":
        return {
          ...base,
          title: `${plural(c.tasks.length, "new task")} on the book board`,
          group: { type: "tasks" },
          tag: plural(c.tasks.length, "TASK").toUpperCase(),
          tone: "new",
          meta: c.tasks.length > 1 ? `“${c.tasks[0].title}” and ${c.tasks.length - 1} more` : `“${c.tasks[0]?.title ?? ""}”`,
          readable: true,
          editable: false,
        };
    }
  });
}

/* ---------- the reading view ---------- */

const paragraphs = (text: SlateElement[] | undefined) => (text || []).map((n) => elementText(n));

function marked(next: SlateElement[], old: SlateElement[] | undefined, markAll = false): ReadView["paragraphs"] {
  const segs = old ? markNew(paragraphs(next), paragraphs(old)) : paragraphs(next).map((t) => [{ text: t, isNew: markAll }]);
  return next.map((n, i) => ({ ...(n.align ? { align: n.align } : {}), segments: segs[i] }));
}

export function readView(c: StagedChange, live: LiveCopy | undefined): ReadView {
  const chapter = (id: string) => live?.chapters.find((x) => x.id === id);
  const base = { id: c.id, title: changeTitle(c, live), editable: c.kind === "draft" || c.kind === "main" || c.kind === "chapter" };
  switch (c.kind) {
    case "draft":
    case "main": {
      const ch = chapter(c.chapterId);
      return {
        ...base,
        title: ch?.name ?? "Removed chapter",
        subtitle: c.kind === "draft" ? `New draft “${c.name}”` : "Edit to Main",
        words: countWords(c.text),
        paragraphs: marked(c.text, ch?.text ?? []),
      };
    }
    case "chapter":
      return { ...base, title: c.name, subtitle: "New chapter", words: countWords(c.text), paragraphs: marked(c.text, undefined) };
    case "element": {
      const current = live?.[c.element].find((x) => x.name === c.name);
      const text = [...(c.color ? toSlate(`Colour: ${c.color}`) : []), ...c.text];
      const old = current ? [...(current.color ? toSlate(`Colour: ${current.color}`) : []), ...current.text] : undefined;
      return {
        ...base,
        subtitle: current ? "Changed" : "New",
        words: countWords(c.text),
        paragraphs: old ? marked(text, old) : marked(text, undefined, true),
      };
    }
    case "notes":
      return {
        ...base,
        subtitle: "Notes",
        words: 0,
        paragraphs: c.notes.map((n) => ({ segments: [{ text: `${n.quote ? `“${n.quote}” — ` : ""}${n.content}`, isNew: true }] })),
      };
    case "tasks":
      return {
        ...base,
        subtitle: "Book task board",
        words: 0,
        paragraphs: c.tasks.map((t) => ({ segments: [{ text: t.description ? `${t.title} — ${t.description}` : t.title, isNew: true }] })),
      };
  }
}

/* ---------- approving ---------- */

/** Notes given by quote get a range in the text. Notes whose quote is not found stay unattached. */
export function anchorNotes(text: SlateElement[], notes: ChapterAnnotation[] | undefined): ChapterAnnotation[] {
  return (notes || []).map((n) => {
    if (n.general || n.anchor || !n.quote) return n;
    const found = findQuote(text, n.quote);
    return found ? { ...n, anchor: found } : n;
  });
}

const draftName = (d = new Date()) => `Claude · ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

export class ApproveError extends Error {}

/**
 * Applies the chosen changes to the live book in one write. Element changes whose live
 * version changed since Claude read them need `confirm`. Returns the ids that were applied.
 */
export async function approveChanges(
  conn: Connection,
  project: { userId: string; bookName: string; liveBookId?: string },
  chosen: StagedChange[],
  confirm: boolean,
  backup: (book: Raw) => Promise<unknown>,
): Promise<ApproveResult & { applied: string[]; bookId: string }> {
  const coll = conn.collection("books");
  const Book = bookModelFor(conn) as Model<any>;
  let book = project.liveBookId ? await readLiveBook(conn, project.liveBookId, project.userId) : null;
  if (project.liveBookId && !book) throw new ApproveError("The book is no longer in Writing Studio.");

  const live = book ? liveCopyOf(book) : undefined;
  const conflicts = chosen
    .filter((c): c is Extract<StagedChange, { kind: "element" }> => c.kind === "element" && elementConflict(c, live))
    .map((c) => ({ id: c.id, title: changeTitle(c, live) }));
  if (conflicts.length && !confirm) return { approved: 0, messages: [], conflicts, applied: [], bookId: project.liveBookId ?? "" };

  if (!book) {
    if (!Types.ObjectId.isValid(project.userId)) throw new ApproveError("The staged book has no valid owner.");
    const created = new Book({ userId: new Types.ObjectId(project.userId), name: project.bookName, chapters: [], filterBy: "chapters" });
    await created.save();
    book = await coll.findOne({ _id: created._id });
    if (!book) throw new ApproveError("Could not create the book in Writing Studio.");
  } else await backup(book);

  const doc = book as Raw;
  const bookId = doc._id as Types.ObjectId;
  const startedAt = doc.updatedAt;
  const now = new Date(Math.max(Date.now(), new Date(startedAt ?? 0).getTime() + 1));
  const iso = now.toISOString();
  const touched = new Set<string>();
  const applied: string[] = [];
  const messages: string[] = [];
  const newChapterIds = new Map<string, string>();
  doc.chapters ||= [];

  const findChapter = (id: string) => liveItems(doc.chapters).find((c) => String(c._id) === id);
  const addDraft = (ch: Raw, name: string, text: SlateElement[], notes: ChapterAnnotation[] | undefined) => {
    ch.drafts = [
      ...(ch.drafts || []),
      {
        id: randomUUID(),
        chapterId: String(ch._id),
        name,
        text,
        annotations: anchorNotes(text, notes),
        format: ch.format || "prose",
        createdAt: iso,
        updatedAt: iso,
      },
    ];
    ch.updatedAt = now;
  };

  // Oldest first, so a new chapter placed after another new chapter finds it.
  for (const c of [...chosen].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    switch (c.kind) {
      case "draft": {
        const ch = findChapter(c.chapterId);
        if (!ch) {
          messages.push(`Skipped draft “${c.name}”: its chapter is no longer in Writing Studio.`);
          continue;
        }
        addDraft(ch, c.name, c.text, c.notes);
        messages.push(`Added draft “${c.name}” to “${ch.name}”.`);
        touched.add("chapters");
        break;
      }
      case "main": {
        const ch = findChapter(c.chapterId);
        if (!ch) {
          messages.push("Skipped a Main edit: its chapter is no longer in Writing Studio.");
          continue;
        }
        if (textHash(ch.text) === c.baseHash) {
          ch.text = c.text;
          ch.annotations = [...(reattachNotes(c.text, ch.annotations).notes ?? []), ...anchorNotes(c.text, c.notes)];
          ch.updatedAt = now;
          messages.push(`Replaced the Main text of “${ch.name}”.`);
        } else {
          addDraft(ch, draftName(), c.text, c.notes);
          messages.push(`“${ch.name}”: you changed Main since, so Claude’s version was added as a draft.`);
        }
        touched.add("chapters");
        break;
      }
      case "chapter": {
        const _id = new Types.ObjectId();
        const chapter = {
          _id,
          bookId,
          type: "chapters",
          name: c.name,
          format: "prose",
          description: toSlate(""),
          text: c.text,
          annotations: anchorNotes(c.text, c.notes),
          createdAt: now,
          updatedAt: now,
        };
        const afterId = c.afterId ? newChapterIds.get(c.afterId) ?? c.afterId : null;
        const at = afterId ? doc.chapters.findIndex((x: Raw) => String(x._id) === afterId) : -1;
        if (at >= 0) doc.chapters.splice(at + 1, 0, chapter);
        else doc.chapters.push(chapter);
        newChapterIds.set(c.id, String(_id));
        messages.push(`Added the chapter “${c.name}”.`);
        touched.add("chapters");
        break;
      }
      case "element": {
        const list: Raw[] = (doc[c.element] ||= []);
        const current = liveItems(list).find((x) => x.name === c.name);
        const field = c.element === "notes" ? "text" : "description";
        const color = c.element === "themes" || c.element === "plotlines" ? c.color || current?.color || DEFAULT_COLOR : undefined;
        if (current) {
          current[field] = c.text;
          if (color) current.color = color;
          current.updatedAt = now;
        } else
          list.push({
            _id: new Types.ObjectId(),
            bookId,
            type: c.element,
            name: c.name,
            [field]: c.text,
            ...(color ? { color } : {}),
            createdAt: now,
            updatedAt: now,
          });
        messages.push(`${current ? "Updated" : "Added"} ${SINGULAR[c.element].toLowerCase()} “${c.name}”.`);
        touched.add(c.element);
        break;
      }
      case "notes": {
        const ch = findChapter(c.chapterId);
        if (!ch) {
          messages.push("Skipped notes: their chapter is no longer in Writing Studio.");
          continue;
        }
        ch.annotations = [...(ch.annotations || []), ...anchorNotes(ch.text, c.notes)];
        ch.updatedAt = now;
        messages.push(`Added ${plural(c.notes.length, "note")} to “${ch.name}”.`);
        touched.add("chapters");
        break;
      }
      case "tasks": {
        const board = (doc.taskBoard ||= { lists: [] });
        board.lists ||= [];
        if (!board.lists.length) board.lists.push({ id: randomUUID(), title: "To do", cards: [] });
        const list = board.lists[0];
        list.cards ||= [];
        for (const t of c.tasks)
          list.cards.push({
            id: randomUUID(),
            title: t.title,
            description: t.description ?? "",
            chapterId: t.chapterId ? newChapterIds.get(t.chapterId) ?? t.chapterId : "",
            completed: false,
            dueDate: "",
            checklist: [],
            labels: [],
            createdAt: iso,
            updatedAt: iso,
          });
        messages.push(`Added ${plural(c.tasks.length, "task")} to “${list.title}”.`);
        touched.add("taskBoard");
        break;
      }
    }
    applied.push(c.id);
  }

  if (!touched.size) return { approved: 0, messages, applied, bookId: String(bookId) };

  // Cast and check everything with Writing Studio's own schema and planning rules.
  const check = new Book(doc);
  try {
    await check.validate();
    validatePlanning(plain(doc), String(bookId));
  } catch (e) {
    throw new ApproveError(`Nothing was approved. Writing Studio would reject it: ${(e as Error).message}`);
  }
  const cast = check.toObject({ virtuals: false, transform: false } as any) as Raw;
  const $set: Raw = { updatedAt: now };
  for (const key of touched) $set[key] = cast[key];
  const r = await coll.updateOne({ _id: bookId, updatedAt: startedAt }, { $set });
  if (r.matchedCount !== 1) throw new ApproveError("The book changed in Writing Studio while approving. Nothing was written. Try again.");
  return { approved: applied.length, messages, applied, bookId: String(bookId) };
}

export const isObjectId = (v: unknown): v is string => typeof v === "string" && mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v);

/**
 * After Writing Studio saves a book: refresh the live copy on every staging row of that
 * book, so Claude reads the newest Main text. Errors are only logged by the caller.
 */
export async function refreshLiveCopies(conn: Connection, bookId: string): Promise<void> {
  if (!Types.ObjectId.isValid(bookId)) return;
  const rows = conn.collection("staging_room_projects");
  if (!(await rows.findOne({ version: 2, liveBookId: bookId }, { projection: { _id: 1 } }))) return;
  const book = await conn.collection("books").findOne({ _id: new Types.ObjectId(bookId) });
  if (!book) return;
  await rows.updateMany({ version: 2, liveBookId: bookId }, { $set: { live: liveCopyOf(book) }, $inc: { revision: 1 } });
}
