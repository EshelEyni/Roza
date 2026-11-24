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
  ChapterPlanningLinks,
  EntityKind,
  LiveChapter,
  LiveCopy,
  LiveElement,
  PlanningKind,
  ReadView,
  SlateElement,
  StagedChange,
} from "../../../../shared/types/stagingRoom";
import { DEFAULT_COLOR, findQuote, hashOf, reattachNotes } from "./fullData";
import { validatePlanning } from "./planningValidation";
import { bookModelFor } from "./rozaSchema";
import { countWords, elementText, toSlate } from "./slate";
import { proseBlocks, screenplayStart } from "./screenplay";
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
  return { id: String(x._id ?? ""), name: String(x.name ?? ""), ...(color ? { color } : {}), text, hash: elementHash(color, text) };
}

/** Bump when the live copy starts keeping something new. Older copies are refreshed. */
export const COPY_VERSION = 2;

export const PLANNING_KINDS: PlanningKind[] = ["characters", "themes", "plotlines"];

/** A chapter's planning links, with every kind present. */
export function planningOf(planning: Raw | undefined): ChapterPlanningLinks {
  return Object.fromEntries(
    PLANNING_KINDS.map((k) => [k, (planning?.[k] || []).map((l: Raw) => ({ entityId: String(l.entityId), note: String(l.note ?? "") }))]),
  ) as ChapterPlanningLinks;
}
export const planningHash = (planning: Raw | undefined) => hashOf(planningOf(planning));
export const cardHash = (card: unknown) => hashOf(plain(card));

/** The read-only copy of a live book that Claude and the Staging Room read. */
export function liveCopyOf(book: Raw): LiveCopy {
  const chapters: LiveChapter[] = liveItems(book.chapters).map((c) => ({
    id: String(c._id),
    name: String(c.name ?? ""),
    format: c.format === "screenplay" ? "screenplay" : "prose",
    text: plain(c.text ?? []),
    mainHash: textHash(c.text),
    summary: plain(c.description ?? []),
    summaryHash: textHash(c.description),
    planning: planningOf(c.planning),
    planningHash: planningHash(c.planning),
    ...(c.taskBoard ? { taskBoard: plain(c.taskBoard) } : {}),
    annotations: plain(c.annotations ?? []),
    drafts: (c.drafts || [])
      .filter((d: Raw) => d.kind !== "main-backup")
      .map((d: Raw) => ({
        id: String(d.id),
        name: String(d.name ?? ""),
        words: countWords(d.text),
        text: plain(d.text ?? []),
        annotations: plain(d.annotations ?? []),
        ...(d.summary ? { summary: String(d.summary) } : {}),
        ...(d.format ? { format: d.format } : {}),
      })),
  }));
  const elements = Object.fromEntries(
    ELEMENT_KINDS.map((k) => [k, liveItems(book[k]).map((x) => liveElement(k, x))]),
  ) as Record<EntityKind, LiveElement[]>;
  return {
    copyVersion: COPY_VERSION,
    bookId: String(book._id),
    name: String(book.name ?? ""),
    updatedAt: new Date(book.updatedAt ?? 0).toISOString(),
    chapters,
    ...elements,
    ...(book.taskBoard ? { taskBoard: plain(book.taskBoard) } : {}),
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
    case "summary":
      return `Summary · ${chapter(c.chapterId)}`;
    case "planning":
      return `Planning · ${chapter(c.chapterId)}`;
    case "chapterSettings":
      return `Chapter settings · ${chapter(c.chapterId)}`;
    case "tasks":
      return plural(c.tasks.length, "task");
    case "taskEdit":
      return `Task · ${c.cardTitle}`;
  }
}

/* ---------- planning and task helpers ---------- */

/** True when the chapter's planning changed in Writing Studio since Claude read it. */
function planningConflict(c: Extract<StagedChange, { kind: "planning" }>, live: LiveCopy | undefined): boolean {
  const ch = live?.chapters.find((x) => x.id === c.chapterId);
  return !!ch && ch.planningHash !== undefined && ch.planningHash !== c.baseHash;
}

type Card = Raw & { id: string; title: string };

/** The cards of a board, with the list each one is in. */
export function boardCards(board: Raw | undefined): { card: Card; list: Raw }[] {
  return ((board?.lists as Raw[] | undefined) ?? []).flatMap((list) => ((list.cards as Card[] | undefined) ?? []).map((card) => ({ card, list })));
}

/** The live card a task edit points at, or undefined when it is gone. */
function liveCard(c: Extract<StagedChange, { kind: "taskEdit" }>, live: LiveCopy | undefined) {
  const board = c.boardChapterId ? live?.chapters.find((x) => x.id === c.boardChapterId)?.taskBoard : live?.taskBoard;
  return boardCards(board).find((x) => x.card.id === c.cardId)?.card;
}

/** True when the card changed in Writing Studio since Claude read it. */
function taskConflict(c: Extract<StagedChange, { kind: "taskEdit" }>, live: LiveCopy | undefined): boolean {
  const card = liveCard(c, live);
  return !!card && cardHash(card) !== c.baseHash;
}

/** Plain lines that describe a task edit, for the Changes screen. */
function taskEditLines(edit: StagedChange & { kind: "taskEdit" }): string[] {
  const e = edit.edit;
  return [
    ...(e.title !== undefined ? [`Title: ${e.title}`] : []),
    ...(e.completed !== undefined ? [e.completed ? "Mark as done" : "Mark as not done"] : []),
    ...(e.description !== undefined ? [`Description: ${e.description || "(empty)"}`] : []),
    ...(e.dueDate !== undefined ? [e.dueDate ? `Due: ${e.dueDate}` : "Remove the due date"] : []),
    ...(e.list !== undefined ? [`Move to list “${e.list}”`] : []),
    ...(e.checklist ? [`Checklist: ${e.checklist.map((i) => `${i.done ? "☑" : "☐"} ${i.title}`).join(", ") || "(empty)"}`] : []),
  ];
}

/** Plain lines that describe chapter settings, for the Changes screen. */
function settingsLines(c: Extract<StagedChange, { kind: "chapterSettings" }>, live: LiveCopy | undefined): string[] {
  const after = c.move ? (c.move.afterId ? live?.chapters.find((x) => x.id === c.move!.afterId)?.name ?? "a removed chapter" : null) : undefined;
  return [
    ...(c.name !== undefined ? [`Rename to “${c.name}”`] : []),
    ...(c.format ? [`Change the format to ${c.format}`] : []),
    ...(after === null ? ["Move to the start of the book"] : after !== undefined ? [`Move after “${after}”`] : []),
  ];
}

const KIND_WORD: Record<PlanningKind, [string, string]> = { characters: ["character", "Characters"], themes: ["theme", "Themes"], plotlines: ["plotline", "Plotlines"] };

/** Plain lines that list a planning change, with the element names. */
function planningLines(c: Extract<StagedChange, { kind: "planning" }>, live: LiveCopy | undefined) {
  const current = live?.chapters.find((x) => x.id === c.chapterId)?.planning;
  return PLANNING_KINDS.filter((k) => c.planning[k]).map((k) => {
    const name = (id: string) => live?.[k].find((x) => x.id === id)?.name ?? "a removed element";
    const links = c.planning[k]!;
    return {
      heading: `${KIND_WORD[k][1]}: ${links.length ? "" : "none"}`,
      links: links.map((l) => ({ text: `${name(l.entityId)}${l.note ? ` — ${l.note}` : ""}`, isNew: !current?.[k].some((x) => x.entityId === l.entityId && x.note === l.note) })),
    };
  });
}

function planningMeta(c: Extract<StagedChange, { kind: "planning" }>): string {
  const parts = PLANNING_KINDS.filter((k) => c.planning[k]).map((k) => plural(c.planning[k]!.length, KIND_WORD[k][0]));
  return `Links ${parts.join(", ")} · replaces those links in the chapter’s planning`;
}

/** True when the chapter's summary changed in Writing Studio since Claude read it. */
function summaryConflict(c: Extract<StagedChange, { kind: "summary" }>, live: LiveCopy | undefined): boolean {
  const ch = live?.chapters.find((x) => x.id === c.chapterId);
  return !!ch && (ch.summaryHash ?? textHash(ch.summary)) !== c.baseHash;
}

/** A summary with no words counts as empty. */
const isBlank = (text: SlateElement[] | undefined) => !(text ?? []).some((n) => elementText(n).trim());

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
      case "summary": {
        const isNew = isBlank(live?.chapters.find((x) => x.id === c.chapterId)?.summary);
        return {
          ...base,
          title: "Chapter summary",
          group: chapterGroup(c.chapterId),
          tag: isNew ? "NEW SUMMARY" : "SUMMARY",
          tone: isNew ? "new" : "changed",
          meta: `${words(c.text)} words · replaces the summary in the Bible`,
          readable: true,
          editable: false,
          warning: missing(c.chapterId) ?? (summaryConflict(c, live) ? "Changed in Writing Studio since Claude read it." : undefined),
        };
      }
      case "planning":
        return {
          ...base,
          title: "Chapter planning",
          group: chapterGroup(c.chapterId),
          tag: "PLANNING",
          tone: "changed",
          meta: planningMeta(c),
          readable: true,
          editable: false,
          warning: missing(c.chapterId) ?? (planningConflict(c, live) ? "Changed in Writing Studio since Claude read it." : undefined),
        };
      case "chapterSettings":
        return {
          ...base,
          title: "Chapter settings",
          group: chapterGroup(c.chapterId),
          tag: "SETTINGS",
          tone: "changed",
          meta: settingsLines(c, live).join(" · "),
          readable: true,
          editable: false,
          warning: missing(c.chapterId),
        };
      case "taskEdit": {
        const lines = taskEditLines(c);
        return {
          ...base,
          title: `Task “${c.cardTitle}”`,
          group: { type: "tasks" },
          tag: "TASK EDIT",
          tone: "changed",
          meta: lines.length > 1 ? `${lines[0]} and ${lines.length - 1} more` : lines[0] ?? "",
          readable: true,
          editable: false,
          warning: live && !liveCard(c, live) ? "This task is no longer in Writing Studio." : taskConflict(c, live) ? "Changed in Writing Studio since Claude read it." : undefined,
        };
      }
      case "tasks":
        return {
          ...base,
          title: c.tasks.every((t) => t.onChapterBoard)
            ? `${plural(c.tasks.length, "new task")} on chapter boards`
            : `${plural(c.tasks.length, "new task")} on the book board`,
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
    case "summary": {
      const old = chapter(c.chapterId)?.summary;
      return {
        ...base,
        title: chapter(c.chapterId)?.name ?? "Removed chapter",
        subtitle: isBlank(old) ? "New summary" : "Summary changed",
        words: countWords(c.text),
        paragraphs: isBlank(old) ? marked(c.text, undefined, true) : marked(c.text, old),
      };
    }
    case "planning":
      return {
        ...base,
        title: chapter(c.chapterId)?.name ?? "Removed chapter",
        subtitle: "Chapter planning",
        words: 0,
        paragraphs: planningLines(c, live).flatMap((k) => [
          { segments: [{ text: k.heading, isNew: false }] },
          ...k.links.map((l) => ({ segments: [{ text: `• ${l.text}`, isNew: l.isNew }] })),
        ]),
      };
    case "chapterSettings":
      return {
        ...base,
        title: chapter(c.chapterId)?.name ?? "Removed chapter",
        subtitle: "Chapter settings",
        words: 0,
        paragraphs: settingsLines(c, live).map((text) => ({ segments: [{ text, isNew: true }] })),
      };
    case "taskEdit":
      return {
        ...base,
        subtitle: c.boardChapterId ? `Task board of “${chapter(c.boardChapterId)?.name ?? "a removed chapter"}”` : "Book task board",
        words: 0,
        paragraphs: taskEditLines(c).map((text) => ({ segments: [{ text, isNew: true }] })),
      };
    case "tasks":
      return {
        ...base,
        subtitle: "Book task board",
        words: 0,
        paragraphs: c.tasks.map((t) => {
          const where = t.onChapterBoard && t.chapterId ? ` (board of “${chapter(t.chapterId)?.name ?? "a new chapter"}”)` : "";
          const extra = [t.list ? `list “${t.list}”` : "", t.dueDate ? `due ${t.dueDate}` : "", t.checklist?.length ? `checklist: ${t.checklist.join(", ")}` : ""].filter(Boolean);
          const text = `${t.title}${where}${t.description ? ` — ${t.description}` : ""}${extra.length ? ` · ${extra.join(" · ")}` : ""}`;
          return { segments: [{ text, isNew: true }] };
        }),
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

const sameTitle = (a: unknown, b: string) => String(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** The list on a board with this title, made when missing. No title: the first list (made as "To do" when the board is empty). */
function listOn(board: Raw, title?: string): Raw & { cards: Raw[] } {
  board.lists ||= [];
  let list = title?.trim() ? board.lists.find((l: Raw) => sameTitle(l.title, title)) : board.lists[0];
  if (!list) {
    list = { id: randomUUID(), title: title?.trim() || "To do", cards: [] };
    board.lists.push(list);
  }
  list.cards ||= [];
  return list;
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
    .filter(
      (c) =>
        (c.kind === "element" && elementConflict(c, live)) ||
        (c.kind === "summary" && summaryConflict(c, live)) ||
        (c.kind === "planning" && planningConflict(c, live)) ||
        (c.kind === "taskEdit" && taskConflict(c, live)),
    )
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
      case "summary": {
        const ch = findChapter(c.chapterId);
        if (!ch) {
          messages.push("Skipped a summary: its chapter is no longer in Writing Studio.");
          continue;
        }
        ch.description = c.text;
        ch.updatedAt = now;
        messages.push(`Updated the summary of “${ch.name}”.`);
        touched.add("chapters");
        break;
      }
      case "tasks": {
        const added: string[] = [];
        for (const t of c.tasks) {
          const chapterId = t.chapterId ? newChapterIds.get(t.chapterId) ?? t.chapterId : "";
          const ch = t.onChapterBoard && chapterId ? findChapter(chapterId) : undefined;
          if (t.onChapterBoard && !ch) {
            messages.push(`Skipped the task “${t.title}”: its chapter is no longer in Writing Studio.`);
            continue;
          }
          const list = listOn(ch ? (ch.taskBoard ||= { lists: [] }) : (doc.taskBoard ||= { lists: [] }), t.list);
          list.cards.push({
            id: randomUUID(),
            title: t.title,
            description: t.description ?? "",
            chapterId,
            completed: false,
            dueDate: t.dueDate ?? "",
            checklist: (t.checklist ?? []).map((title) => ({ id: randomUUID(), title, done: false })),
            labels: [],
            createdAt: iso,
            updatedAt: iso,
          });
          if (ch) ch.updatedAt = now;
          touched.add(ch ? "chapters" : "taskBoard");
          added.push(`“${list.title}”${ch ? ` on the board of “${ch.name}”` : ""}`);
        }
        if (added.length) messages.push(`Added ${plural(added.length, "task")} to ${[...new Set(added)].join(", ")}.`);
        break;
      }
      case "taskEdit": {
        const ch = c.boardChapterId ? findChapter(c.boardChapterId) : undefined;
        const board = c.boardChapterId ? ch?.taskBoard : doc.taskBoard;
        const found = boardCards(board).find((x) => x.card.id === c.cardId);
        if (!board || !found) {
          messages.push(`Skipped the task “${c.cardTitle}”: it is no longer in Writing Studio.`);
          continue;
        }
        const { card, list } = found;
        const e = c.edit;
        if (e.title !== undefined) card.title = e.title;
        if (e.description !== undefined) card.description = e.description;
        if (e.completed !== undefined) card.completed = e.completed;
        if (e.dueDate !== undefined) card.dueDate = e.dueDate;
        if (e.checklist)
          card.checklist = e.checklist.map((item) => {
            const old = ((card.checklist as Raw[] | undefined) ?? []).find((x) => x.title === item.title);
            return { id: old?.id ?? randomUUID(), title: item.title, done: item.done };
          });
        card.updatedAt = iso;
        if (e.list !== undefined && !sameTitle(list.title, e.list)) {
          list.cards = list.cards.filter((x: Raw) => x !== card);
          listOn(board, e.list).cards.push(card);
        }
        if (ch) ch.updatedAt = now;
        touched.add(ch ? "chapters" : "taskBoard");
        messages.push(`Updated the task “${card.title}”.`);
        break;
      }
      case "planning": {
        const ch = findChapter(c.chapterId);
        if (!ch) {
          messages.push("Skipped planning: its chapter is no longer in Writing Studio.");
          continue;
        }
        const planning = planningOf(ch.planning);
        let dropped = 0;
        for (const k of PLANNING_KINDS) {
          const links = c.planning[k];
          if (!links) continue;
          const ids = new Set(liveItems(doc[k]).map((x) => String(x._id)));
          planning[k] = links.filter((l) => ids.has(l.entityId));
          dropped += links.length - planning[k].length;
        }
        ch.planning = planning;
        ch.updatedAt = now;
        messages.push(`Updated the planning of “${ch.name}”.${dropped ? ` ${plural(dropped, "link")} to removed elements left out.` : ""}`);
        touched.add("chapters");
        break;
      }
      case "chapterSettings": {
        const ch = findChapter(c.chapterId);
        if (!ch) {
          messages.push("Skipped chapter settings: the chapter is no longer in Writing Studio.");
          continue;
        }
        const done: string[] = [];
        if (c.name !== undefined && c.name.trim() && c.name.trim() !== ch.name) {
          done.push(`renamed “${ch.name}” to “${c.name.trim()}”`);
          ch.name = c.name.trim();
        }
        const format = ch.format === "screenplay" ? "screenplay" : "prose";
        if (c.format && c.format !== format) {
          ch.text = c.format === "prose" ? proseBlocks(ch.text ?? []) : screenplayStart(ch.text ?? []);
          ch.format = c.format;
          done.push(`changed “${ch.name}” to ${c.format}`);
        }
        if (c.move) {
          const afterId = c.move.afterId ? newChapterIds.get(c.move.afterId) ?? c.move.afterId : null;
          const rest = doc.chapters.filter((x: Raw) => x !== ch);
          const at = afterId ? rest.findIndex((x: Raw) => String(x._id) === afterId) : -1;
          if (afterId && at < 0) messages.push(`Did not move “${ch.name}”: the chapter it goes after is gone.`);
          else {
            rest.splice(at + 1, 0, ch);
            doc.chapters = rest;
            done.push(`moved “${ch.name}”`);
          }
        }
        ch.updatedAt = now;
        messages.push(done.length ? `Chapter settings: ${done.join(", ")}.` : `“${ch.name}” already had these settings.`);
        touched.add("chapters");
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
