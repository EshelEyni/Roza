/**
 * Full-data view of chapters, story elements and the book itself, used by Compare,
 * Pull and Push so that every field Roza stores is seen, not only the text:
 * name, format, description, text (with formatting), planning links and notes,
 * chapter notes (annotations), drafts, the main text's source draft and task boards,
 * plus the book's name, word goal, task board, publishing settings and narrator.
 *
 * The same "content" shape is built from the local files and from the prod document,
 * so comparing them is a plain hash comparison.
 */
import crypto from "crypto";
import type {
  ChapterAnnotation,
  ChapterDraft,
  EntityKind,
  LocalChapterFile,
  LocalPlanning,
  RichText,
  SlateElement,
  StagedPublishing,
  TaskBoard,
} from "../../../../shared/types/stagingRoom";
import type { ReaderAudiobookNarrator } from "../../../../shared/types/reader";
import { countWords, plainParagraphs, toSlate } from "./slate";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ProdItem = Record<string, any>;

export const PLANNING_KINDS = ["characters", "themes", "plotlines"] as const;
export type PlanningKind = (typeof PLANNING_KINDS)[number];
export const DEFAULT_COLOR = "#937e6e";

/* ---------- cleaning and hashing ---------- */

/** Plain JSON copy without Mongo-only fields (_id, __v) and without `false` flags (Roza's defaults). */
export function clean<T = any>(value: unknown): T {
  if (value === undefined) return undefined as T;
  const walk = (x: any): any => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(x)) {
        if (k === "_id" || k === "__v" || v === false || v === undefined) continue;
        out[k] = walk(v);
      }
      return out;
    }
    return x;
  };
  return walk(JSON.parse(JSON.stringify(value)));
}

/** Order-stable form used only for comparing. Also drops null, "" and [] (Roza treats them like missing). */
export function canon(value: unknown): any {
  const walk = (x: any): any => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      const out: any = {};
      for (const k of Object.keys(x).sort()) {
        const v = walk(x[k]);
        if (v === null || v === undefined || v === false || v === "") continue;
        if (Array.isArray(v) && !v.length) continue;
        if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) continue;
        out[k] = v;
      }
      return out;
    }
    return x;
  };
  return walk(clean(value));
}

export const hashOf = (value: unknown) =>
  crypto.createHash("sha1").update(JSON.stringify(canon(value) ?? null)).digest("hex").slice(0, 16);

/* ---------- rich text ---------- */

export const asSlate = (v: RichText | undefined): SlateElement[] => (Array.isArray(v) ? v : toSlate(v || ""));

const isEmptySlate = (nodes: unknown) =>
  !Array.isArray(nodes) ||
  !nodes.length ||
  ((nodes as SlateElement[]).every((n) => n?.type === "paragraph" && !n.align) &&
    plainParagraphs(nodes as SlateElement[]).every((p) => !p.trim()));

/**
 * Slate that plain text can express exactly (plain paragraphs, no formatting, no blank lines)
 * is written to book.json as a string, so it stays easy to read and edit. Anything else stays Slate.
 */
export function toRichText(nodes: unknown): RichText {
  const slate = clean<SlateElement[]>(Array.isArray(nodes) ? nodes : []);
  if (isEmptySlate(slate)) return "";
  const simple = slate.every((el) => {
    if (el.type !== "paragraph" || el.align || el.children?.length !== 1) return false;
    const leaf = el.children[0] as any;
    if (typeof leaf?.text !== "string" || leaf.children) return false;
    if (Object.keys(leaf).some((k) => k !== "text")) return false;
    return leaf.text !== "" && leaf.text === leaf.text.trim() && !leaf.text.includes("\n");
  });
  return simple ? slate.map((el) => (el.children[0] as any).text).join("\n") : slate;
}

/** Text of a node with **bold**, *italic* and __underline__ markers, for diffs. */
function markedText(node: any): string {
  if (typeof node?.text === "string" && !Array.isArray(node.children)) {
    let t = node.text as string;
    if (!t) return t;
    if (node.bold) t = `**${t}**`;
    if (node.italic) t = `*${t}*`;
    if (node.underline) t = `__${t}__`;
    return t;
  }
  return (node?.children || []).map(markedText).join("");
}

function slateLines(nodes: unknown, prefix = ""): string[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((el: any) => {
    const body = markedText(el);
    if (!body.trim()) return "";
    const tags = [el?.type && el.type !== "paragraph" ? el.type : "", el?.align || ""].filter(Boolean);
    return `${prefix}${tags.length ? `[${tags.join(", ")}] ` : ""}${body}`;
  });
}

/* ---------- planning ---------- */

/** prod chapter planning (entity ids) -> local planning (names). Links to archived elements are left out. */
export function planningToNames(planning: ProdItem | undefined, names: Record<PlanningKind, Map<string, string>>): LocalPlanning {
  const out: LocalPlanning = {};
  for (const k of PLANNING_KINDS) {
    const entries = (planning?.[k] || [])
      .map((l: ProdItem) => [names[k].get(String(l.entityId)), String(l.note || "")] as const)
      .filter(([n]: readonly [string | undefined, string]) => !!n);
    if (entries.length) out[k] = Object.fromEntries(entries);
  }
  return out;
}

/** id -> name of the live story elements in a prod book. */
export function liveNames(prod: ProdItem | null): Record<PlanningKind, Map<string, string>> {
  return Object.fromEntries(
    PLANNING_KINDS.map((k) => [
      k,
      new Map(((prod?.[k] || []) as ProdItem[]).filter((x) => x && x.isArchived !== true).map((x) => [String(x._id), x.name as string])),
    ]),
  ) as Record<PlanningKind, Map<string, string>>;
}

const planningPairs = (p: LocalPlanning | undefined) =>
  Object.fromEntries(PLANNING_KINDS.map((k) => [k, Object.entries(p?.[k] || {}).map(([n, note]) => [n, String(note ?? "")])]));

/* ---------- chapters ---------- */

export interface ChapterContent {
  name: string;
  format: string;
  description?: SlateElement[];
  text: SlateElement[];
  planning: LocalPlanning;
  annotations?: ChapterAnnotation[];
  drafts?: ChapterDraft[];
  mainSourceDraftId?: string;
  taskBoard?: TaskBoard;
}

export function localChapterContent(data: LocalChapterFile): ChapterContent {
  return {
    name: data.name,
    format: data.format || "prose",
    description: isEmptySlate(data.description) ? undefined : data.description,
    text: data.text,
    planning: data.planning || {},
    annotations: data.annotations,
    drafts: data.drafts,
    mainSourceDraftId: data.mainSourceDraftId,
    taskBoard: data.taskBoard,
  };
}

export function prodChapterContent(ch: ProdItem, names: Record<PlanningKind, Map<string, string>>): ChapterContent {
  return clean({
    name: ch.name,
    format: ch.format || "prose",
    description: isEmptySlate(ch.description) ? undefined : ch.description,
    text: ch.text,
    planning: planningToNames(ch.planning, names),
    annotations: ch.annotations,
    drafts: ch.drafts,
    mainSourceDraftId: ch.mainSourceDraftId || undefined,
    taskBoard: ch.taskBoard,
  });
}

/** Fingerprint of everything in a chapter. Draft chapter ids are ignored (they are set on push). */
export const chapterPrint = (c: ChapterContent) =>
  hashOf({
    ...c,
    planning: planningPairs(c.planning),
    drafts: c.drafts?.map((d) => ({ ...d, chapterId: undefined })),
  });

/** What changed, one line per paragraph / link / note / draft / task, for the git-style diff. */
export function chapterLines(c: ChapterContent): string[] {
  return [
    `# ${c.name}`,
    ...(c.format !== "prose" ? [`Format: ${c.format}`] : []),
    ...slateLines(c.description, "Description: "),
    ...slateLines(c.text),
    ...PLANNING_KINDS.flatMap((k) =>
      Object.entries(c.planning?.[k] || {}).map(([n, note]) => `Planning · ${k} · ${n}${note ? `: ${note}` : ""}`),
    ),
    ...(c.annotations || []).map(annotationLine),
    ...(c.drafts || []).flatMap((d) => [
      `Draft “${d.name}” · ${countWords(d.text)} words · ${(d.annotations || []).length} note(s) · updated ${d.updatedAt}`,
      ...(d.kind ? [`Draft “${d.name}” kind: ${d.kind}`] : []),
      ...(d.summary ? [`Draft “${d.name}” summary: ${d.summary}`] : []),
      ...slateLines(d.text, `Draft “${d.name}”: `),
    ]),
    ...(c.mainSourceDraftId ? [`Main text from draft: ${c.mainSourceDraftId}`] : []),
    ...taskBoardLines(c.taskBoard),
  ];
}

function annotationLine(a: ChapterAnnotation): string {
  if (a.general) return `Note (general): ${a.content}`;
  const where = a.anchor ? `¶${a.anchor.anchor.path[0] + 1}` : "unattached";
  return `Note on “${a.quote}” (${where}): ${a.content}`;
}

function taskBoardLines(board: TaskBoard | undefined): string[] {
  return (board?.lists || []).flatMap((l: any) => [
    `Task list · ${l.title}`,
    ...(l.cards || []).flatMap((c: any) => [
      `Task · ${l.title} · ${c.completed ? "✓ " : ""}${c.title}${c.dueDate ? ` (due ${c.dueDate})` : ""}${
        (c.labels || []).length ? ` [${c.labels.map((x: any) => x.title).join(", ")}]` : ""
      }${c.description ? `: ${c.description}` : ""}`,
      ...(c.checklist || []).map((i: any) => `Task · ${l.title} · ${c.title} · ${i.done ? "☑" : "☐"} ${i.title}`),
    ]),
  ]);
}

/* ---------- short "what changed" reports ---------- */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "3 only in Roza, 1 only here, 2 edited" for lists of items with ids (notes, drafts). */
function listReport(local: { id: string }[] | undefined, prod: { id: string }[] | undefined, word: string): string | undefined {
  const l = new Map((local || []).map((x) => [x.id, x]));
  const p = new Map((prod || []).map((x) => [x.id, x]));
  const onlyRoza = [...p.keys()].filter((id) => !l.has(id)).length;
  const onlyHere = [...l.keys()].filter((id) => !p.has(id)).length;
  const edited = [...l.keys()].filter((id) => p.has(id) && hashOf(l.get(id)) !== hashOf(p.get(id))).length;
  const parts = [
    onlyRoza ? `${onlyRoza} only in Roza` : "",
    onlyHere ? `${onlyHere} only here` : "",
    edited ? `${edited} edited` : "",
  ].filter(Boolean);
  if (!parts.length && hashOf(local) !== hashOf(prod)) parts.push("order changed");
  return parts.length ? `${word}: ${parts.join(", ")}` : undefined;
}

/** How many paragraphs differ between two documents (formatting counts, spacing doesn't). */
function paragraphReport(local: unknown, prod: unknown, word: string): string | undefined {
  if (hashOf(local) === hashOf(prod)) return undefined;
  const a = slateLines(local).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const b = slateLines(prod).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const inA = new Map<string, number>();
  for (const s of a) inA.set(s, (inA.get(s) || 0) + 1);
  let common = 0;
  for (const s of b) {
    const n = inA.get(s) || 0;
    if (n) {
      common++;
      inA.set(s, n - 1);
    }
  }
  const here = a.length - common;
  const roza = b.length - common;
  if (!here && !roza) return `${word}: spacing or order only`;
  const parts = [here ? `${here} here` : "", roza ? `${roza} in Roza` : ""].filter(Boolean);
  const n = Math.max(here, roza);
  return `${word}: ${plural(n, "paragraph")} ${n === 1 ? "differs" : "differ"} (${parts.join(", ")})`;
}

function planningReport(local: LocalPlanning, prod: LocalPlanning): string | undefined {
  let onlyRoza = 0;
  let onlyHere = 0;
  let notes = 0;
  for (const k of PLANNING_KINDS) {
    const l = local?.[k] || {};
    const p = prod?.[k] || {};
    for (const n of Object.keys(p)) if (!(n in l)) onlyRoza++;
    for (const n of Object.keys(l)) {
      if (!(n in p)) onlyHere++;
      else if ((l[n] || "") !== (p[n] || "")) notes++;
    }
  }
  const parts = [
    onlyRoza ? `${plural(onlyRoza, "link")} only in Roza` : "",
    onlyHere ? `${plural(onlyHere, "link")} only here` : "",
    notes ? `${plural(notes, "link note")} edited` : "",
  ].filter(Boolean);
  if (!parts.length && hashOf(planningPairs(local)) !== hashOf(planningPairs(prod))) parts.push("order changed");
  return parts.length ? `Planning: ${parts.join(", ")}` : undefined;
}

/** One short line per part of the chapter that differs. */
export function chapterReport(local: ChapterContent, prod: ChapterContent): string[] {
  return [
    local.name !== prod.name ? `Name: “${local.name}” here, “${prod.name}” in Roza` : undefined,
    local.format !== prod.format ? `Format: ${local.format} here, ${prod.format} in Roza` : undefined,
    paragraphReport(local.description, prod.description, "Description"),
    paragraphReport(local.text, prod.text, "Text"),
    planningReport(local.planning, prod.planning),
    listReport(local.annotations, prod.annotations, "Notes"),
    listReport(local.drafts, prod.drafts, "Drafts"),
    (local.mainSourceDraftId || "") !== (prod.mainSourceDraftId || "") ? "Main text source draft differs" : undefined,
    hashOf(local.taskBoard) !== hashOf(prod.taskBoard) ? "Task board differs" : undefined,
  ].filter((x): x is string => !!x);
}

/* ---------- story elements ---------- */

export interface EntityContent {
  color?: string;
  body: SlateElement[];
}

const colored = (kind: EntityKind) => kind === "themes" || kind === "plotlines";

export function localEntityContent(kind: EntityKind, value: RichText | [string, RichText]): EntityContent {
  if (colored(kind)) {
    const [color, desc] = value as [string, RichText];
    return { color: (color || DEFAULT_COLOR).toLowerCase(), body: asSlate(desc) };
  }
  return { body: asSlate(value as RichText) };
}

export function prodEntityContent(kind: EntityKind, item: ProdItem): EntityContent {
  const body = clean<SlateElement[]>((kind === "notes" ? item.text : item.description) || []);
  return colored(kind) ? { color: String(item.color || DEFAULT_COLOR).toLowerCase(), body } : { body };
}

/** Empty documents compare equal however they are written. */
export const entityPrint = (c: EntityContent) => hashOf({ ...c, body: isEmptySlate(c.body) ? [] : c.body });

export const entityReport = (local: EntityContent, prod: EntityContent): string[] =>
  [
    local.color !== prod.color ? `Colour: ${local.color} here, ${prod.color} in Roza` : undefined,
    paragraphReport(isEmptySlate(local.body) ? [] : local.body, isEmptySlate(prod.body) ? [] : prod.body, "Text"),
  ].filter((x): x is string => !!x);

export const entityLines = (c: EntityContent) => [...(c.color ? [`Colour: ${c.color}`] : []), ...slateLines(c.body)];

/** The value written to book.json for a prod story element. */
export function entityToLocal(kind: EntityKind, item: ProdItem): RichText | [string, RichText] {
  const c = prodEntityContent(kind, item);
  return colored(kind) ? [c.color!, toRichText(c.body)] : toRichText(c.body);
}

/* ---------- the book itself ---------- */

export interface BookContent {
  name: string;
  wordGoal?: number | null;
  taskBoard?: TaskBoard;
  publishing?: StagedPublishing;
  audiobookNarrator?: ReaderAudiobookNarrator;
}

/**
 * A copy of Roza's publishing settings. `clean` is not used here: it drops `false`,
 * and includeTitlePage / includeToc default to true, so `false` must be kept.
 */
export function publishingCopy(value: unknown): StagedPublishing | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { _id: _ignored, ...rest } = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  return rest as unknown as StagedPublishing;
}

/** Publishing settings in a form where a missing flag and `true` compare equal (Roza's default). */
const publishingKey = (p: StagedPublishing | undefined) =>
  p && { ...p, includeTitlePage: p.includeTitlePage === false ? "no" : "yes", includeToc: p.includeToc === false ? "no" : "yes" };

export const bookPrint = (c: BookContent) => hashOf({ ...c, publishing: publishingKey(c.publishing) });

const publishingDiffers = (a: BookContent, b: BookContent) =>
  hashOf(publishingKey(a.publishing)) !== hashOf(publishingKey(b.publishing));

export const bookReport = (local: BookContent, prod: BookContent): string[] =>
  [
    local.name !== prod.name ? `Name: “${local.name}” here, “${prod.name}” in Roza` : undefined,
    (local.wordGoal ?? null) !== (prod.wordGoal ?? null)
      ? `Word goal: ${local.wordGoal ? local.wordGoal.toLocaleString() : "none"} here, ${prod.wordGoal ? prod.wordGoal.toLocaleString() : "none"} in Roza`
      : undefined,
    hashOf(local.taskBoard) !== hashOf(prod.taskBoard)
      ? local.taskBoard === undefined
        ? `Task board: only in Roza (${plural((prod.taskBoard?.lists || []).reduce((n: number, l: any) => n + (l.cards || []).length, 0), "card")})`
        : "Task board differs"
      : undefined,
    publishingDiffers(local, prod)
      ? local.publishing === undefined
        ? "Publishing settings: only in Roza"
        : prod.publishing === undefined
          ? "Publishing settings: only here"
          : "Publishing settings differ"
      : undefined,
    hashOf(local.audiobookNarrator) !== hashOf(prod.audiobookNarrator)
      ? `Narrator: ${narratorText(local.audiobookNarrator)} here, ${narratorText(prod.audiobookNarrator)} in Roza`
      : undefined,
  ].filter((x): x is string => !!x);

const narratorText = (n: ReaderAudiobookNarrator | undefined) => (n ? `${n.name} (${n.engine})` : "none");

function publishingLines(p: StagedPublishing | undefined): string[] {
  if (!p) return [];
  return [
    `Publishing · title: ${p.title}`,
    ...(p.author ? [`Publishing · author: ${p.author}`] : []),
    `Publishing · language: ${p.language}`,
    `Publishing · title page: ${p.includeTitlePage === false ? "no" : "yes"} · table of contents: ${p.includeToc === false ? "no" : "yes"}`,
    `Publishing · ${plural((p.chapterIds || []).length, "chapter")} selected`,
    `Publishing · cover: ${p.cover ? "yes" : "none"}`,
    `Publishing · identifier: ${p.identifier}`,
    ...(p.publishedAt ? [`Publishing · published: ${p.publishedAt}`] : []),
  ];
}

export const bookLines = (c: BookContent) => [
  `Book name: ${c.name}`,
  ...(c.wordGoal ? [`Word goal: ${c.wordGoal.toLocaleString()}`] : []),
  ...taskBoardLines(c.taskBoard),
  ...publishingLines(c.publishing),
  ...(c.audiobookNarrator ? [`Narrator: ${narratorText(c.audiobookNarrator)}`] : []),
];

export const prodBookContent = (prod: ProdItem): BookContent => ({
  ...clean<BookContent>({ name: prod.name, wordGoal: prod.wordGoal, taskBoard: prod.taskBoard, audiobookNarrator: prod.audiobookNarrator }),
  ...(prod.publishing ? { publishing: publishingCopy(prod.publishing) } : {}),
});

/* ---------- keeping notes attached when the text changes ---------- */

type Point = { path: number[]; offset: number };

/** Every text leaf of a document, in order, with its path. */
function leavesOf(nodes: SlateElement[]): { path: number[]; text: string }[] {
  const out: { path: number[]; text: string }[] = [];
  const walk = (node: any, path: number[]) => {
    if (typeof node?.text === "string" && !Array.isArray(node.children)) out.push({ path, text: node.text });
    else (node?.children || []).forEach((c: any, i: number) => walk(c, [...path, i]));
  };
  (nodes || []).forEach((n, i) => walk(n, [i]));
  return out;
}

const samePath = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/** The text a range covers (like Slate's Editor.string), or undefined if a point is not in the document. */
function rangeText(leaves: ReturnType<typeof leavesOf>, a: Point, b: Point): string | undefined {
  const ia = leaves.findIndex((l) => samePath(l.path, a.path));
  const ib = leaves.findIndex((l) => samePath(l.path, b.path));
  if (ia < 0 || ib < 0 || a.offset > leaves[ia].text.length || b.offset > leaves[ib].text.length) return undefined;
  let [s, e, so, eo] = [ia, ib, a.offset, b.offset];
  if (s > e || (s === e && so > eo)) [s, e, so, eo] = [e, s, eo, so];
  if (s === e) return leaves[s].text.slice(so, eo);
  return [leaves[s].text.slice(so), ...leaves.slice(s + 1, e).map((l) => l.text), leaves[e].text.slice(0, eo)].join("");
}

/** Find the quote in the text (within one paragraph) and return a range around it. */
function findQuote(nodes: SlateElement[], quote: string): { anchor: Point; focus: Point } | undefined {
  if (!quote) return undefined;
  for (let block = 0; block < (nodes || []).length; block++) {
    const leaves = leavesOf([nodes[block]]).map((l) => ({ ...l, path: [block, ...l.path.slice(1)] }));
    const joined = leaves.map((l) => l.text).join("");
    const at = joined.indexOf(quote);
    if (at < 0) continue;
    const point = (pos: number, end: boolean): Point => {
      let start = 0;
      for (let i = 0; i < leaves.length; i++) {
        const len = leaves[i].text.length;
        const last = i === leaves.length - 1;
        if (pos < start + len || (pos === start + len && (end || last))) return { path: leaves[i].path, offset: pos - start };
        start += len;
      }
      const l = leaves[leaves.length - 1];
      return { path: l.path, offset: l.text.length };
    };
    return { anchor: point(at, false), focus: point(at + quote.length, true) };
  }
  return undefined;
}

/**
 * Makes sure every note still points at its quote in `text`. Notes whose range no longer
 * covers the quote are moved to where the quote is now; if the quote is gone they become
 * "unattached" (anchor null), which Roza shows as "text removed" and lets you re-attach.
 */
export function reattachNotes(
  text: SlateElement[],
  notes: ChapterAnnotation[] | undefined,
): { notes: ChapterAnnotation[] | undefined; moved: number; detached: number } {
  if (!notes) return { notes, moved: 0, detached: 0 };
  const leaves = leavesOf(text);
  let moved = 0;
  let detached = 0;
  const out = notes.map((n) => {
    if (n.general || !n.anchor) return n;
    const current = rangeText(leaves, n.anchor.anchor, n.anchor.focus);
    if (current !== undefined && (current.slice(0, 500) === n.quote || !n.quote)) return n;
    const found = findQuote(text, n.quote);
    if (found) {
      moved++;
      return { ...n, anchor: found };
    }
    detached++;
    return { ...n, anchor: null };
  });
  return { notes: out, moved, detached };
}
