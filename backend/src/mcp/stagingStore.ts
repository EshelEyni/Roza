import { createHash, randomUUID } from "node:crypto";
import type {
  ChapterAnnotation,
  ChapterPlanningLinks,
  EntityKind,
  LiveCopy,
  PlanningKind,
  SlateElement,
  StagedChange,
  StagedTask,
  TaskEdit,
} from "../../../shared/types/stagingRoom";
import type { ConnectorDb } from "./connectorDb";
import { ConnectorError } from "./connectorError";
import { markdownToSlate, slateToMarkdown, slateToPlainText } from "./slateMarkdown";
import { applyEdits, followNotes, LostNote, mergeNotes, TextEdit } from "./textEdits";
import {
  boardCards,
  cardHash,
  changeTitle,
  COPY_VERSION,
  elementHash,
  PLANNING_KINDS,
  planningOf,
  textHash,
} from "../services/stagingRoom/changes";
import { isV2, ProjectRow } from "../services/stagingRoom/project";
import { checkSlate, countWords } from "../services/stagingRoom/slate";

// Staging Room access for the Claude connector (Staging Room v2, docs/staging-room-prd.md).
//
// Claude only ADDS pending changes to a staged book: new drafts (the default for chapter
// text), Main edits when the author asks, new chapters, story elements, notes and tasks.
// It never deletes anything and never writes the live books. The author approves each
// change in the Staging Room.
//
// The connector's database user cannot read the live books. It reads the copy of the
// live book that the ROZA backend keeps on each staging row (row.live).

const projectKey = (owner: string, slug: string) => createHash("sha256").update(JSON.stringify([owner, slug])).digest("hex");

function checkSlug(value: string) {
  if (!value.trim() || value.length > 200 || value === "." || value === ".." || /[/\\\x00-\x1f]/.test(value))
    throw new ConnectorError(`"${value}" is not a valid project name.`);
  return value;
}

type Text = string | SlateElement[];
type NoteInput = { quote?: string; content: string };
type TextChange = Extract<StagedChange, { kind: "draft" | "main" }>;
type LiveChapter = LiveCopy["chapters"][number];
export type ChapterRead = {
  version?: string;
  includeDrafts?: boolean;
  paragraphs?: { from?: number; to?: number };
  search?: string;
};

const MAX_PARAGRAPHS = 200;
const isMain = (ref: string) => ref.trim().toLowerCase() === "main";
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const wordCount = (n: number) => n.toLocaleString("en-US");

/** What Claude is told about notes that lost their sentence. */
function notesReport(lost: LostNote[], mainLost: LostNote[] = []) {
  return {
    ...(lost.length ? { notesMovedToGeneral: lost } : {}),
    ...(mainLost.length ? { mainNotesThatWillLoseTheirPlace: mainLost } : {}),
  };
}

/** clientId is the connector app (Claude, ChatGPT, ...). The Staging Room shows changes by it as from Claude. */
export function createStagingStore(db: ConnectorDb, owner: string, clientId?: string) {
  const projects = () => db.stagingProjects();

  async function load(slug: string): Promise<ProjectRow> {
    checkSlug(slug);
    const row = (await projects().findOne({ _id: projectKey(owner, slug), owner } as never)) as { version?: unknown } | null;
    if (!row) throw new ConnectorError(`No staged book "${slug}". Call staging_list_projects.`);
    if (!isV2(row))
      throw new ConnectorError(`"${slug}" needs a one-time upgrade. Ask the author to open Staging Room once, then try again.`);
    return row;
  }

  function liveOf(row: ProjectRow): LiveCopy {
    if (!row.live) throw new ConnectorError(`"${row.slug}" is not in Writing Studio yet. Add chapters with staging_add_chapter.`);
    return row.live;
  }

  /** Chapters are numbered 1..n in the live order. */
  function chapterAt(row: ProjectRow, number: number) {
    const live = liveOf(row);
    const chapter = live.chapters[number - 1];
    if (!chapter) throw new ConnectorError(`"${row.slug}" has no chapter ${number}. It has ${live.chapters.length} chapter(s).`);
    return chapter;
  }

  function toSlate(text: Text, screenplay = false): SlateElement[] {
    if (typeof text === "string") {
      if (screenplay) throw new ConnectorError("This chapter is a screenplay. Markdown can't keep its layout. Send Slate nodes.");
      return markdownToSlate(text) as SlateElement[];
    }
    const errors = checkSlate(text, "Text");
    if (errors.length) throw new ConnectorError(errors[0]);
    return text;
  }

  const notesOf = (notes: NoteInput[] | undefined): ChapterAnnotation[] | undefined =>
    notes?.length
      ? notes.map((n) => ({ id: randomUUID(), content: n.content, quote: n.quote ?? "", anchor: null, ...(n.quote ? {} : { general: true }) }))
      : undefined;

  const stamp = () => {
    const now = new Date().toISOString();
    return { id: randomUUID(), createdAt: now, updatedAt: now, by: "connector" as const, ...(clientId ? { clientId } : {}) };
  };

  /** Adds a change, or replaces the one with the same id. Refused while an approval is writing. */
  async function save(row: ProjectRow, change: StagedChange, replaces?: StagedChange) {
    const filter = {
      _id: row._id,
      owner,
      $or: [{ lease: { $exists: false } }, { "lease.until": { $lte: new Date() } }],
      ...(replaces ? { changes: { $elemMatch: { id: replaces.id, updatedAt: replaces.updatedAt } } } : {}),
    };
    const update = replaces
      ? { $set: { "changes.$": change }, $inc: { revision: 1 } }
      : { $push: { changes: change }, $inc: { revision: 1 } };
    const r = await projects().updateOne(filter as never, update as never);
    if (!r.matchedCount)
      throw new ConnectorError(`"${row.slug}" changed while saving (the author may be approving or editing). Nothing was saved. Read it again and retry.`);
    return { slug: row.slug, changeId: change.id, pending: change.kind, title: changeTitle(change, row.live), saved: replaces ? "updated" : "added" };
  }

  async function listProjects() {
    const rows = (await projects().find({ owner }).sort({ slug: 1 }).toArray()) as unknown as (ProjectRow | { slug: string; version?: number })[];
    return {
      projects: rows.map((row) =>
        isV2(row)
          ? {
              slug: row.slug,
              bookName: row.live?.name ?? row.bookName,
              inWritingStudio: !!row.liveBookId,
              chapters: row.live?.chapters.length ?? 0,
              pendingChanges: row.changes.length,
            }
          : { slug: row.slug, needsUpgrade: "Ask the author to open Staging Room once." },
      ),
    };
  }

  async function getProject(slug: string) {
    const row = await load(slug);
    const live = row.live;
    return {
      slug: row.slug,
      bookName: live?.name ?? row.bookName,
      inWritingStudio: !!row.liveBookId,
      liveCopiedAt: live?.copiedAt ?? null,
      chapters: (live?.chapters ?? []).map((c, i) => ({
        number: i + 1,
        title: c.name,
        format: c.format,
        words: countWords(c.text),
        drafts: c.drafts.map((d) => d.name),
      })),
      characters: (live?.characters ?? []).map((x) => x.name),
      themes: (live?.themes ?? []).map((x) => x.name),
      plotlines: (live?.plotlines ?? []).map((x) => x.name),
      notes: (live?.notes ?? []).map((x) => x.name),
      pendingChanges: row.changes.map((c) => ({ changeId: c.id, kind: c.kind, title: changeTitle(c, live), updatedAt: c.updatedAt })),
    };
  }

  /** Refuses when the row's live copy is older than what this tool needs. */
  function needFreshCopy(row: ProjectRow) {
    if ((liveOf(row).copyVersion ?? 0) < COPY_VERSION)
      throw new ConnectorError(`"${row.slug}" has an older copy of the book. Ask the author to open Staging Room once, then try again.`);
  }

  /** A Writing Studio draft by id or name. */
  const studioDraft = (chapter: LiveChapter, ref: string) =>
    chapter.drafts.find((d) => d.id === ref) ?? chapter.drafts.find((d) => d.name === ref) ?? chapter.drafts.find((d) => sameName(d.name, ref));

  /** A Writing Studio draft's text and notes. Refused for copies made before draft texts were kept. */
  function studioDraftText(row: ProjectRow, chapter: LiveChapter, ref: string) {
    const draft = studioDraft(chapter, ref);
    if (!draft) return undefined;
    if (!draft.text) needFreshCopy(row);
    return { draft, text: (draft.text ?? []) as SlateElement[], notes: draft.annotations };
  }

  /** The pending drafts and Main edit of a chapter (by anyone). */
  const pendingTexts = (row: ProjectRow, chapter: LiveChapter) =>
    row.changes.filter((c): c is TextChange => (c.kind === "draft" || c.kind === "main") && c.chapterId === chapter.id);

  /** A pending draft or Main edit by changeId, or a pending draft by name. */
  function pendingByRef(row: ProjectRow, chapter: LiveChapter, ref: string): TextChange {
    const list = pendingTexts(row, chapter);
    const found =
      list.find((c) => c.id === ref) ??
      list.find((c) => c.kind === "draft" && c.name === ref) ??
      list.find((c) => c.kind === "draft" && sameName(c.name, ref));
    if (found) return found;
    if (studioDraft(chapter, ref))
      throw new ConnectorError(
        `"${ref}" is a draft in Writing Studio. It can't be changed in place. ` +
          `Copy it with staging_copy_draft (from "${ref}"), then edit the copy.`,
      );
    const names = list.filter((c) => c.kind === "draft").map((c) => `"${(c as { name: string }).name}"`);
    throw new ConnectorError(`Chapter ${chapter.name} has no pending draft "${ref}".${names.length ? ` Pending drafts: ${names.join(", ")}.` : ""}`);
  }

  /** "main", a pending draft name or id, or (left out) the chapter's only pending draft. */
  function editTarget(row: ProjectRow, chapter: LiveChapter, ref?: string): { change?: TextChange; text: SlateElement[]; label: string } {
    const label = (c: TextChange) => (c.kind === "draft" ? `draft “${c.name}”` : "pending Main edit");
    if (ref === undefined) {
      const drafts = pendingTexts(row, chapter).filter((c) => c.kind === "draft");
      if (drafts.length === 1) return { change: drafts[0], text: drafts[0].text, label: label(drafts[0]) };
      if (!drafts.length)
        throw new ConnectorError(`Chapter "${chapter.name}" has no pending draft. Start one with staging_copy_draft (from "main"), or pass target "main".`);
      throw new ConnectorError(
        `Chapter "${chapter.name}" has ${drafts.length} pending drafts: ${drafts.map((d) => `"${(d as { name: string }).name}"`).join(", ")}. Pass target.`,
      );
    }
    if (isMain(ref)) {
      const main = pendingTexts(row, chapter).find((c) => c.kind === "main");
      return main ? { change: main, text: main.text, label: label(main) } : { text: chapter.text, label: "Main" };
    }
    const change = pendingByRef(row, chapter, ref);
    return { change, text: change.text, label: label(change) };
  }

  /** The chapter's summary (the Bible's Summary tab), or a note when the copy predates summaries. */
  function summaryView(chapter: LiveChapter, view: "markdown" | "full") {
    if (chapter.summaryHash === undefined)
      return { summary: null, summaryNote: "This copy of the book has no summaries yet. Ask the author to open Staging Room once, then read again." };
    const text = chapter.summary ?? [];
    return { summary: view === "full" ? text : slateToMarkdown(text) };
  }

  /** The pending summary for a chapter (by anyone). */
  const summaryChange = (row: ProjectRow, chapter: LiveChapter) =>
    row.changes.find((c): c is Extract<StagedChange, { kind: "summary" }> => c.kind === "summary" && c.chapterId === chapter.id);

  type Pending<K extends StagedChange["kind"]> = Extract<StagedChange, { kind: K }>;
  const planningChange = (row: ProjectRow, chapter: LiveChapter) =>
    row.changes.find((c): c is Pending<"planning"> => c.kind === "planning" && c.chapterId === chapter.id);
  const settingsChange = (row: ProjectRow, chapter: LiveChapter) =>
    row.changes.find((c): c is Pending<"chapterSettings"> => c.kind === "chapterSettings" && c.chapterId === chapter.id);

  /** Planning links with element names instead of ids. */
  function planningView(live: LiveCopy, planning: Partial<ChapterPlanningLinks>) {
    const out: Partial<Record<PlanningKind, { name: string; note?: string }[]>> = {};
    for (const k of PLANNING_KINDS) {
      const links = planning[k];
      if (!links) continue;
      out[k] = links.map((l) => ({ name: live[k].find((x) => x.id === l.entityId)?.name ?? "(removed element)", ...(l.note ? { note: l.note } : {}) }));
    }
    return out;
  }

  const chapterNumberOf = (live: LiveCopy, id: string | undefined | null) => {
    const i = id ? live.chapters.findIndex((c) => c.id === id) : -1;
    return i >= 0 ? i + 1 : null;
  };

  function settingsView(live: LiveCopy, c: Pending<"chapterSettings">) {
    return {
      changeId: c.id,
      ...(c.name !== undefined ? { title: c.name } : {}),
      ...(c.format ? { format: c.format } : {}),
      ...(c.move ? { after: c.move.afterId ? chapterNumberOf(live, c.move.afterId) : 0 } : {}),
    };
  }

  const notesView = (notes: ChapterAnnotation[] | undefined) =>
    (notes ?? []).map((n) => ({ content: n.content, ...(n.quote ? { quote: n.quote } : {}), ...(n.general ? { general: true } : {}) }));

  /**
   * Reads a chapter. By default: Main, plus the pending drafts and Main edit for it.
   * `version` reads only one text. `paragraphs` and `search` return only some paragraphs.
   */
  async function getChapter(slug: string, number: number, view: "markdown" | "full" = "markdown", options: ChapterRead = {}) {
    const row = await load(slug);
    const chapter = chapterAt(row, number);
    const pending = pendingTexts(row, chapter);
    const show = (text: SlateElement[]) => (view === "full" ? text : slateToMarkdown(text));
    const sliced = !!options.paragraphs || !!options.search;
    const select = (text: SlateElement[]) => {
      if (!sliced) return { text: show(text) };
      const from = Math.max(0, options.paragraphs?.from ?? 0);
      const to = Math.min(text.length - 1, options.paragraphs?.to ?? text.length - 1);
      const needle = options.search?.trim().toLowerCase();
      const hits: { index: number; text: unknown }[] = [];
      for (let index = from; index <= to && hits.length < MAX_PARAGRAPHS; index++) {
        const block = text[index];
        const md = slateToMarkdown([block]);
        if (needle && !md.toLowerCase().includes(needle) && !slateToPlainText([block]).toLowerCase().includes(needle)) continue;
        hits.push({ index, text: view === "full" ? block : md });
      }
      return { totalParagraphs: text.length, paragraphs: hits };
    };
    const pendingSummary = summaryChange(row, chapter);
    const pendingPlanning = planningChange(row, chapter);
    const pendingSettings = settingsChange(row, chapter);
    const live = liveOf(row);
    const head = {
      slug,
      number,
      title: chapter.name,
      format: chapter.format,
      words: countWords(chapter.text),
      drafts: chapter.drafts.map((d) => d.name),
      ...summaryView(chapter, view),
      ...(pendingSummary ? { pendingSummary: { changeId: pendingSummary.id, text: show(pendingSummary.text) } } : {}),
      ...(chapter.planning ? { planning: planningView(live, chapter.planning) } : {}),
      ...(pendingPlanning ? { pendingPlanning: { changeId: pendingPlanning.id, ...planningView(live, pendingPlanning.planning) } } : {}),
      ...(pendingSettings ? { pendingSettings: settingsView(live, pendingSettings) } : {}),
    };
    const pendingInfo = (c: TextChange) => ({
      changeId: c.id,
      kind: c.kind,
      ...(c.kind === "draft" ? { name: c.name } : {}),
      words: countWords(c.text),
      notes: c.notes?.length ?? 0,
    });

    if (options.version !== undefined) {
      if (isMain(options.version))
        return { ...head, version: "Main", ...select(chapter.text), notes: notesView(chapter.annotations), pending: pending.map(pendingInfo) };
      const isPending = pending.some((c) => c.id === options.version || (c.kind === "draft" && sameName(c.name, options.version!)));
      const studio = isPending ? undefined : studioDraftText(row, chapter, options.version);
      if (studio)
        return {
          ...head,
          version: { writingStudioDraft: studio.draft.name, words: studio.draft.words, ...(studio.draft.summary ? { summary: studio.draft.summary } : {}) },
          ...select(studio.text),
          notes: notesView(studio.notes),
        };
      const change = pendingByRef(row, chapter, options.version);
      return { ...head, version: pendingInfo(change), ...select(change.text), notes: notesView(change.notes) };
    }
    const withTexts = !sliced && (options.includeDrafts ?? view !== "full");
    return {
      ...head,
      mainNotes: notesView(chapter.annotations),
      main: sliced ? select(chapter.text) : show(chapter.text),
      pending: pending.map((c) => ({ ...pendingInfo(c), ...(withTexts ? { text: show(c.text) } : {}) })),
    };
  }

  async function createProject(slug: string, bookName: string, language: "he" | "en") {
    checkSlug(slug);
    if (!bookName.trim()) throw new ConnectorError("bookName is required.");
    const row: ProjectRow = {
      _id: projectKey(owner, slug),
      owner,
      slug,
      version: 2,
      bookName: bookName.trim(),
      userId: owner,
      language,
      changes: [],
      revision: 0,
    };
    try {
      await projects().insertOne(row as never);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConnectorError(`A staged book named "${slug}" already exists.`);
      throw error;
    }
    return { slug, bookName: row.bookName, note: "The book is created in Writing Studio when the author approves its first change." };
  }

  async function writeDraft(input: { slug: string; number: number; text: Text; name?: string; newDraft?: boolean; notes?: NoteInput[] }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    const text = toSlate(input.text, chapter.format === "screenplay");
    const drafts = pendingTexts(row, chapter).filter((c): c is Extract<StagedChange, { kind: "draft" }> => c.kind === "draft");
    const named = input.name?.trim() ? drafts.find((c) => sameName(c.name, input.name!)) : undefined;
    const existing = input.newDraft
      ? undefined
      : named ?? drafts.filter((c) => c.by === "connector").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const name = input.name?.trim() || existing?.name || `Claude · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    if (existing) {
      const { notes, lost } = followNotes(text, mergeNotes(existing.notes, notesOf(input.notes)));
      const saved = await save(row, { ...existing, name, text, ...(notes ? { notes } : {}), updatedAt: new Date().toISOString() }, existing);
      return { ...saved, ...notesReport(lost) };
    }
    const { notes, lost } = followNotes(text, notesOf(input.notes));
    const saved = await save(row, { ...stamp(), kind: "draft", chapterId: chapter.id, name, text, baseHash: chapter.mainHash, notes });
    return { ...saved, ...notesReport(lost) };
  }

  async function editMain(input: { slug: string; number: number; text: Text; notes?: NoteInput[] }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    const text = toSlate(input.text, chapter.format === "screenplay");
    const existing = row.changes.find(
      (c): c is Extract<StagedChange, { kind: "main" }> => c.kind === "main" && c.chapterId === chapter.id && c.by === "connector",
    );
    const { notes, lost } = followNotes(text, mergeNotes(existing?.notes, notesOf(input.notes)));
    const mainLost = followNotes(text, chapter.annotations).lost;
    const saved = existing
      ? await save(row, { ...existing, text, ...(notes ? { notes } : {}), updatedAt: new Date().toISOString() }, existing)
      : await save(row, { ...stamp(), kind: "main", chapterId: chapter.id, text, baseHash: chapter.mainHash, notes });
    return { ...saved, ...notesReport(lost, mainLost) };
  }

  /** Find/replace on one text of a chapter, applied here. Saves only when every edit matches exactly once. */
  async function editText(input: { slug: string; number: number; target?: string; edits: TextEdit[]; dryRun?: boolean }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    const target = editTarget(row, chapter, input.target);
    const { text, previews } = applyEdits(target.text, input.edits);
    const errors = checkSlate(text, "Text");
    if (errors.length) throw new ConnectorError(`${errors[0]}. Nothing was saved.`);
    const n = input.edits.length;
    const summary = `${input.dryRun ? "would apply" : "applied"} ${n} edit${n === 1 ? "" : "s"}; words ${wordCount(countWords(target.text))} → ${wordCount(countWords(text))}`;
    const { notes, lost } = followNotes(text, target.change?.notes);
    const isMainText = !target.change || target.change.kind === "main";
    const mainLost = isMainText ? followNotes(text, chapter.annotations).lost : [];
    if (input.dryRun) return { dryRun: true, target: target.label, summary, edits: previews, ...notesReport(lost, mainLost) };
    const saved = target.change
      ? await save(row, { ...target.change, text, ...(notes ? { notes } : {}), updatedAt: new Date().toISOString() }, target.change)
      : await save(row, { ...stamp(), kind: "main", chapterId: chapter.id, text, baseHash: chapter.mainHash });
    return { changeId: saved.changeId, target: target.label, summary, saved: saved.saved, ...notesReport(lost, mainLost) };
  }

  /** Copies Main or a pending text into a new pending draft, here on the server. */
  async function copyDraft(input: { slug: string; number: number; from: string; name: string; withNotes?: boolean }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    const name = input.name.trim();
    if (!name) throw new ConnectorError("name is required.");
    if (pendingTexts(row, chapter).some((c) => c.kind === "draft" && sameName(c.name, name)))
      throw new ConnectorError(`Chapter "${chapter.name}" already has a pending draft named "${name}". Pick another name.`);
    const isPending = pendingTexts(row, chapter).some((c) => c.id === input.from || (c.kind === "draft" && sameName(c.name, input.from)));
    const studio = isMain(input.from) || isPending ? undefined : studioDraftText(row, chapter, input.from);
    const source = isMain(input.from)
      ? { text: chapter.text, notes: chapter.annotations }
      : studio ?? (({ text, notes }) => ({ text, notes }))(pendingByRef(row, chapter, input.from));
    const notes = input.withNotes && source.notes?.length ? source.notes.map((n) => ({ ...n, id: randomUUID() })) : undefined;
    const text = JSON.parse(JSON.stringify(source.text)) as SlateElement[];
    const saved = await save(row, { ...stamp(), kind: "draft", chapterId: chapter.id, name, text, baseHash: chapter.mainHash, ...(notes ? { notes } : {}) });
    return { changeId: saved.changeId, name, words: countWords(text), notes: notes?.length ?? 0 };
  }

  async function addChapter(input: { slug: string; title: string; text: Text; after?: number; changeId?: string; notes?: NoteInput[] }) {
    const row = await load(input.slug);
    if (!input.title.trim()) throw new ConnectorError("title is required.");
    const text = toSlate(input.text);
    if (input.changeId) {
      const existing = row.changes.find((c): c is Extract<StagedChange, { kind: "chapter" }> => c.kind === "chapter" && c.id === input.changeId);
      if (!existing) throw new ConnectorError(`No pending new chapter with changeId ${input.changeId}.`);
      const { notes, lost } = followNotes(text, mergeNotes(existing.notes, notesOf(input.notes)));
      const saved = await save(row, { ...existing, name: input.title.trim(), text, ...(notes ? { notes } : {}), updatedAt: new Date().toISOString() }, existing);
      return { ...saved, ...notesReport(lost) };
    }
    const afterId = input.after === undefined ? null : input.after === 0 ? null : chapterAt(row, input.after).id;
    return save(row, { ...stamp(), kind: "chapter", name: input.title.trim(), afterId, text, notes: notesOf(input.notes) });
  }

  async function setElement(input: { slug: string; kind: EntityKind; name: string; text: Text; color?: string }) {
    const row = await load(input.slug);
    const name = input.name.trim();
    if (!name) throw new ConnectorError("name is required.");
    const text = typeof input.text === "string" ? (markdownToSlate(input.text) as SlateElement[]) : toSlate(input.text);
    const withColor = input.kind === "themes" || input.kind === "plotlines";
    if (input.color && !withColor) throw new ConnectorError("Only themes and plotlines have a colour.");
    const current = row.live?.[input.kind].find((x) => x.name === name);
    const color = withColor ? input.color || current?.color || "#937e6e" : undefined;
    if (current && current.hash === elementHash(color, text)) return { slug: row.slug, unchanged: true, note: "It already reads like this in Writing Studio." };
    const existing = row.changes.find(
      (c): c is Extract<StagedChange, { kind: "element" }> => c.kind === "element" && c.element === input.kind && c.name === name,
    );
    if (existing) return save(row, { ...existing, text, ...(color ? { color } : {}), updatedAt: new Date().toISOString() }, existing);
    return save(row, { ...stamp(), kind: "element", element: input.kind, name, ...(color ? { color } : {}), text, baseHash: current?.hash ?? null });
  }

  /** Proposes a new chapter summary. Saving again updates the same pending summary. */
  async function setSummary(input: { slug: string; number: number; text: Text }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    if (chapter.summaryHash === undefined)
      throw new ConnectorError("This copy of the book has no summaries yet. Ask the author to open Staging Room once, then try again.");
    const text = toSlate(input.text);
    if (!text.some((n) => slateToPlainText([n]).trim())) throw new ConnectorError("text is empty. These tools can't remove a summary.");
    const existing = summaryChange(row, chapter);
    if (existing) return save(row, { ...existing, text, updatedAt: new Date().toISOString() }, existing);
    if (textHash(text) === chapter.summaryHash) return { slug: row.slug, unchanged: true, note: "The summary already reads like this in Writing Studio." };
    return save(row, { ...stamp(), kind: "summary", chapterId: chapter.id, text, baseHash: chapter.summaryHash });
  }

  /** The text of story elements. With name, only that element. */
  async function getElements(input: { slug: string; kind: EntityKind; name?: string; view?: "markdown" | "full" }) {
    const row = await load(input.slug);
    const live = liveOf(row);
    const show = (text: SlateElement[]) => (input.view === "full" ? text : slateToMarkdown(text));
    const pending = row.changes.filter((c): c is Extract<StagedChange, { kind: "element" }> => c.kind === "element" && c.element === input.kind);
    const pendingOf = (name: string) => pending.find((c) => c.name === name);
    let items = live[input.kind];
    if (input.name !== undefined) {
      const name = input.name;
      items = items.filter((x) => x.name === name);
      if (!items.length) items = live[input.kind].filter((x) => sameName(x.name, name));
      if (!items.length && !pending.some((c) => sameName(c.name, name)))
        throw new ConnectorError(`No ${input.kind} named "${name}". It has: ${live[input.kind].map((x) => `"${x.name}"`).join(", ") || "none"}.`);
    }
    const listed = new Set(items.map((x) => x.name));
    const newOnes = pending.filter((c) => !listed.has(c.name) && (input.name === undefined || sameName(c.name, input.name)));
    return {
      slug: row.slug,
      kind: input.kind,
      items: [
        ...items.map((x) => {
          const p = pendingOf(x.name);
          return {
            name: x.name,
            ...(x.color ? { color: x.color } : {}),
            text: show(x.text),
            ...(p ? { pendingChange: { changeId: p.id, text: show(p.text), ...(p.color ? { color: p.color } : {}) } } : {}),
          };
        }),
        ...newOnes.map((p) => ({ name: p.name, new: true, pendingChange: { changeId: p.id, text: show(p.text), ...(p.color ? { color: p.color } : {}) } })),
      ],
    };
  }

  async function addNotes(input: { slug: string; number: number; notes: NoteInput[] }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    if (!input.notes.length) throw new ConnectorError("notes is empty.");
    return save(row, { ...stamp(), kind: "notes", chapterId: chapter.id, notes: notesOf(input.notes)! });
  }

  type TaskInput = {
    title: string;
    description?: string;
    chapter?: number;
    onChapterBoard?: boolean;
    list?: string;
    dueDate?: string;
    checklist?: string[];
  };

  async function addTasks(input: { slug: string; tasks: TaskInput[] }) {
    const row = await load(input.slug);
    if (!input.tasks.length) throw new ConnectorError("tasks is empty.");
    const tasks: StagedTask[] = input.tasks.map((t) => {
      if (t.onChapterBoard && !t.chapter) throw new ConnectorError(`The task "${t.title}" has onChapterBoard but no chapter.`);
      return {
        title: t.title.trim(),
        ...(t.description ? { description: t.description } : {}),
        ...(t.chapter ? { chapterId: chapterAt(row, t.chapter).id } : {}),
        ...(t.onChapterBoard ? { onChapterBoard: true } : {}),
        ...(t.list?.trim() ? { list: t.list.trim() } : {}),
        ...(t.dueDate ? { dueDate: t.dueDate } : {}),
        ...(t.checklist?.length ? { checklist: t.checklist.map((x) => x.trim()).filter(Boolean) } : {}),
      };
    });
    if (tasks.some((t) => !t.title)) throw new ConnectorError("Every task needs a title.");
    return save(row, { ...stamp(), kind: "tasks", tasks });
  }

  /** Every task card: the book board and the chapters' own boards. */
  function allCards(live: LiveCopy) {
    return [
      ...boardCards(live.taskBoard).map((x) => ({ ...x, chapter: undefined as LiveChapter | undefined })),
      ...live.chapters.flatMap((chapter) => boardCards(chapter.taskBoard).map((x) => ({ ...x, chapter }))),
    ];
  }

  /** Task boards: the book board and every chapter board that has cards, or one chapter's board. */
  async function getTasks(input: { slug: string; chapter?: number; includeCompleted?: boolean }) {
    const row = await load(input.slug);
    needFreshCopy(row);
    const live = liveOf(row);
    const showDone = input.includeCompleted ?? true;
    const pendingEdits = row.changes.filter((c): c is Pending<"taskEdit"> => c.kind === "taskEdit");
    const card = (c: Record<string, unknown>) => {
      const p = pendingEdits.find((x) => x.cardId === c.id);
      return {
        cardId: String(c.id),
        title: String(c.title ?? ""),
        ...(c.description ? { description: String(c.description) } : {}),
        completed: !!c.completed,
        ...(c.dueDate ? { dueDate: String(c.dueDate) } : {}),
        ...((c.checklist as unknown[] | undefined)?.length
          ? { checklist: (c.checklist as { title: string; done: boolean }[]).map((i) => ({ title: i.title, done: !!i.done })) }
          : {}),
        ...((c.labels as unknown[] | undefined)?.length ? { labels: (c.labels as { title: string }[]).map((l) => l.title) } : {}),
        ...(c.chapterId ? { chapter: chapterNumberOf(live, String(c.chapterId)) } : {}),
        ...(p ? { pendingEdit: { changeId: p.id, ...p.edit } } : {}),
      };
    };
    const boardView = (board: { lists?: { title?: string; cards?: Record<string, unknown>[] }[] } | undefined) =>
      (board?.lists ?? []).map((l) => ({ list: String(l.title ?? ""), cards: (l.cards ?? []).filter((c) => showDone || !c.completed).map(card) }));
    const chapters = input.chapter ? [chapterAt(row, input.chapter)] : live.chapters.filter((c) => boardCards(c.taskBoard).length);
    const pendingAdds = row.changes.filter((c): c is Pending<"tasks"> => c.kind === "tasks");
    return {
      slug: row.slug,
      ...(input.chapter ? {} : { bookBoard: boardView(live.taskBoard as never) }),
      chapterBoards: chapters.map((c) => ({ chapter: chapterNumberOf(live, c.id), title: c.name, lists: boardView(c.taskBoard as never) })),
      ...(pendingAdds.length
        ? { pendingNewTasks: pendingAdds.map((c) => ({ changeId: c.id, titles: c.tasks.map((t) => t.title) })) }
        : {}),
    };
  }

  /** Proposes changes to an existing task card. Saving again for the same card updates the same pending change. */
  async function updateTask(input: { slug: string; cardId: string } & TaskEdit) {
    const row = await load(input.slug);
    needFreshCopy(row);
    const { slug: _slug, cardId, ...fields } = input;
    const edit = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as TaskEdit;
    if (!Object.keys(edit).length) throw new ConnectorError("Nothing to change. Pass at least one field.");
    if (edit.title !== undefined && !edit.title.trim()) throw new ConnectorError("title can't be empty.");
    const found = allCards(liveOf(row)).find((x) => x.card.id === cardId);
    if (!found) throw new ConnectorError(`No task with cardId ${cardId}. Read the boards with staging_get_tasks.`);
    const existing = row.changes.find((c): c is Pending<"taskEdit"> => c.kind === "taskEdit" && c.cardId === cardId);
    if (existing) return save(row, { ...existing, edit: { ...existing.edit, ...edit }, updatedAt: new Date().toISOString() }, existing);
    return save(row, {
      ...stamp(),
      kind: "taskEdit",
      cardId,
      ...(found.chapter ? { boardChapterId: found.chapter.id } : {}),
      cardTitle: found.card.title,
      edit,
      baseHash: cardHash(found.card),
    });
  }

  type LinkInput = { name: string; note?: string };

  /** Proposes the chapter's links to characters, themes or plotlines. Each kind given replaces that kind's links. */
  async function setPlanning(input: { slug: string; number: number } & Partial<Record<PlanningKind, LinkInput[]>>) {
    const row = await load(input.slug);
    needFreshCopy(row);
    const live = liveOf(row);
    const chapter = chapterAt(row, input.number);
    const planning: Partial<ChapterPlanningLinks> = {};
    for (const k of PLANNING_KINDS) {
      const links = input[k];
      if (!links) continue;
      const seen = new Set<string>();
      planning[k] = links.map((l) => {
        const item = live[k].find((x) => x.name === l.name) ?? live[k].find((x) => sameName(x.name, l.name));
        if (!item?.id) {
          const waiting = row.changes.some((c) => c.kind === "element" && c.element === k && sameName(c.name, l.name));
          throw new ConnectorError(
            waiting
              ? `"${l.name}" is still a pending ${k} change. The author must approve it before chapters can link to it.`
              : `No ${k} named "${l.name}". It has: ${live[k].map((x) => `"${x.name}"`).join(", ") || "none"}.`,
          );
        }
        if (seen.has(item.id)) throw new ConnectorError(`"${item.name}" is listed twice in ${k}.`);
        seen.add(item.id);
        return { entityId: item.id, note: l.note ?? "" };
      });
    }
    if (!Object.keys(planning).length) throw new ConnectorError("Pass characters, themes or plotlines.");
    const existing = planningChange(row, chapter);
    if (existing) return save(row, { ...existing, planning: { ...existing.planning, ...planning }, updatedAt: new Date().toISOString() }, existing);
    const current = planningOf(chapter.planning);
    if (PLANNING_KINDS.every((k) => !planning[k] || JSON.stringify(planning[k]) === JSON.stringify(current[k])))
      return { slug: row.slug, unchanged: true, note: "The planning already reads like this in Writing Studio." };
    return save(row, { ...stamp(), kind: "planning", chapterId: chapter.id, planning, baseHash: chapter.planningHash ?? "" });
  }

  /** Proposes a new title, format or place for a chapter. Saving again updates the same pending change. */
  async function updateChapter(input: { slug: string; number: number; title?: string; format?: "prose" | "screenplay"; after?: number }) {
    const row = await load(input.slug);
    const chapter = chapterAt(row, input.number);
    if (input.title === undefined && !input.format && input.after === undefined)
      throw new ConnectorError("Nothing to change. Pass title, format or after.");
    if (input.title !== undefined && !input.title.trim()) throw new ConnectorError("title can't be empty.");
    if (input.after === input.number) throw new ConnectorError("A chapter can't go after itself.");
    const move = input.after === undefined ? undefined : { afterId: input.after === 0 ? null : chapterAt(row, input.after).id };
    const fields = {
      ...(input.title !== undefined ? { name: input.title.trim() } : {}),
      ...(input.format ? { format: input.format } : {}),
      ...(move ? { move } : {}),
    };
    const existing = settingsChange(row, chapter);
    if (existing) return save(row, { ...existing, ...fields, updatedAt: new Date().toISOString() }, existing);
    return save(row, { ...stamp(), kind: "chapterSettings", chapterId: chapter.id, ...fields });
  }

  return {
    listProjects,
    getProject,
    getChapter,
    getElements,
    createProject,
    writeDraft,
    editMain,
    editText,
    copyDraft,
    addChapter,
    setElement,
    setSummary,
    setPlanning,
    updateChapter,
    addNotes,
    addTasks,
    getTasks,
    updateTask,
  };
}
