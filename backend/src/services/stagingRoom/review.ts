/**
 * Review diffs for the Staging Room: what differs between the staged copy ("staging")
 * and the live Writing Studio book ("studio"), split into parts (text, notes, drafts,
 * details, planning, tasks). Text changes get ids, so one change can be rejected alone.
 */
import type {
  ChapterAnnotation,
  ChapterDraft,
  DiffBlock,
  DiffPara,
  ReviewItemChange,
  ReviewItemSide,
  ReviewPart,
  SlateElement,
} from "../../../../shared/types/stagingRoom";
import {
  BookContent,
  bookLines,
  ChapterContent,
  EntityContent,
  entityLines,
  hashOf,
  PLANNING_KINDS,
  slateLines,
  taskBoardLines,
} from "./fullData";
import { countWords, plainParagraphs } from "./slate";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** One step of lining up two lists: in both, only in staging (a), or only in studio (b). */
type Op = { kind: "same" | "a" | "b"; i: number; j: number };

/** A run of changes: staging lines [a0, a1) became studio lines [b0, b1). */
export interface Run {
  a0: number;
  a1: number;
  b0: number;
  b1: number;
}

/** Longest-common-subsequence alignment, after trimming the shared start and end. */
function align(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: Op[] = [];
  for (let k = 0; k < start; k++) ops.push({ kind: "same", i: k, j: k });
  const n = endA - start;
  const m = endB - start;
  if (n * m > 4_000_000) {
    // Too big to line up: one change from the first difference to the last.
    for (let i = start; i < endA; i++) ops.push({ kind: "a", i, j: start });
    for (let j = start; j < endB; j++) ops.push({ kind: "b", i: endA, j });
  } else {
    const w = m + 1;
    const dp = new Int32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i * w + j] = a[start + i] === b[start + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        ops.push({ kind: "same", i: start + i, j: start + j });
        i++;
        j++;
      } else if (j >= m || (i < n && dp[(i + 1) * w + j] >= dp[i * w + j + 1])) {
        ops.push({ kind: "a", i: start + i, j: start + j });
        i++;
      } else {
        ops.push({ kind: "b", i: start + i, j: start + j });
        j++;
      }
    }
  }
  for (let k = 0; endA + k < a.length; k++) ops.push({ kind: "same", i: endA + k, j: endB + k });
  return ops;
}

type Entry = { kind: "same"; i: number; j: number } | { kind: "change"; run: Run };

/**
 * Same lines and runs of changes, in order. Blank lines are left out, and a run that
 * only adds or removes blank lines is not a change.
 */
function entriesOf(a: string[], b: string[]): Entry[] {
  const ka = a.map(norm);
  const kb = b.map(norm);
  const ops = align(ka, kb);
  const out: Entry[] = [];
  let run: Run | undefined;
  const close = () => {
    if (!run) return;
    const visible = ka.slice(run.a0, run.a1).some(Boolean) || kb.slice(run.b0, run.b1).some(Boolean);
    if (visible) out.push({ kind: "change", run });
    run = undefined;
  };
  for (const op of ops) {
    if (op.kind === "same") {
      close();
      if (ka[op.i]) out.push({ kind: "same", i: op.i, j: op.j });
      continue;
    }
    if (!run) run = { a0: op.i, a1: op.i, b0: op.j, b1: op.j };
    if (op.kind === "a") run.a1 = op.i + 1;
    else run.b1 = op.j + 1;
  }
  close();
  return out;
}

/** The change runs of a text diff, by change id. Used to reject one change. */
export function changeRuns(a: string[], b: string[]): Run[] {
  return entriesOf(a, b)
    .filter((e): e is Extract<Entry, { kind: "change" }> => e.kind === "change")
    .map((e) => e.run);
}

/** Side-by-side blocks. Unchanged lines far from a change fold into "skip" blocks. */
export function diffBlocks(a: string[], b: string[], context = 2): DiffBlock[] {
  const entries = entriesOf(a, b);
  const para = (lines: string[], k: number): DiffPara => ({ n: k + 1, text: lines[k] });
  const near = entries.map((_, k) => {
    for (let d = -context; d <= context; d++) if (entries[k + d]?.kind === "change") return true;
    return false;
  });
  const out: DiffBlock[] = [];
  let skipped = 0;
  let hunk = 0;
  entries.forEach((e, k) => {
    if (e.kind === "same" && !near[k]) {
      skipped++;
      return;
    }
    if (skipped) out.push({ kind: "skip", count: skipped });
    skipped = 0;
    if (e.kind === "same") out.push({ kind: "same", staging: para(a, e.i), studio: para(b, e.j) });
    else {
      const pick = (lines: string[], from: number, to: number) =>
        Array.from({ length: to - from }, (_, x) => para(lines, from + x)).filter((p) => norm(p.text));
      out.push({ kind: "change", hunk: hunk++, staging: pick(a, e.run.a0, e.run.a1), studio: pick(b, e.run.b0, e.run.b1) });
    }
  });
  if (skipped) out.push({ kind: "skip", count: skipped });
  return out;
}

const changeCount = (blocks: DiffBlock[]) => blocks.filter((b) => b.kind === "change").length;

function linePart(id: ReviewPart["id"], label: string, a: string[], b: string[]): ReviewPart | undefined {
  const blocks = diffBlocks(a, b);
  const changes = changeCount(blocks);
  return changes ? { id, label, changes, blocks } : undefined;
}

/** The text lines Compare shows for a chapter's main text. */
export const textLines = (nodes: SlateElement[] | undefined) => slateLines(nodes || []);

/* ---------- notes and drafts, matched by id ---------- */

const clip = (s: string, max = 320) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const where = (n: ChapterAnnotation) => (n.general ? "General note" : n.anchor ? `¶${n.anchor.anchor.path[0] + 1}` : "Not attached to text");

const noteSide = (n: ChapterAnnotation): ReviewItemSide => ({
  ...(n.general ? {} : { quote: clip(n.quote || "", 200) }),
  body: n.content,
  meta: where(n),
});

const date = (iso: string | undefined) => (iso ? iso.slice(0, 16).replace("T", " ") : "");
const draftSide = (d: ChapterDraft): ReviewItemSide => ({
  body: clip(plainParagraphs(d.text).filter((p) => p.trim()).join(" ")),
  meta: [`${countWords(d.text).toLocaleString()} words`, `${(d.annotations || []).length} notes`, d.updatedAt ? `updated ${date(d.updatedAt)}` : ""]
    .filter(Boolean)
    .join(" · "),
});

function itemChanges<T extends { id: string }>(
  staging: T[] | undefined,
  studio: T[] | undefined,
  describe: (x: T) => { title: string; side: ReviewItemSide },
  blocksOf?: (a: T, b: T) => DiffBlock[] | undefined,
): ReviewItemChange[] {
  const a = new Map((staging || []).map((x) => [x.id, x]));
  const b = new Map((studio || []).map((x) => [x.id, x]));
  const out: ReviewItemChange[] = [];
  for (const [id, x] of a) {
    const y = b.get(id);
    if (!y) out.push({ id, change: "added", title: describe(x).title, staging: describe(x).side });
    else if (hashOf(x) !== hashOf(y))
      out.push({ id, change: "edited", title: describe(x).title, staging: describe(x).side, studio: describe(y).side, blocks: blocksOf?.(x, y) });
  }
  for (const [id, y] of b) if (!a.has(id)) out.push({ id, change: "removed", title: describe(y).title, studio: describe(y).side });
  return out;
}

const noteTitle = (n: ChapterAnnotation) => (n.general ? "General note" : `Note on ${where(n)}`);

function itemPart(id: "notes" | "drafts", label: string, items: ReviewItemChange[]): ReviewPart | undefined {
  return items.length ? { id, label, changes: items.length, items } : undefined;
}

/* ---------- parts per item ---------- */

const EMPTY_CHAPTER: ChapterContent = { name: "", format: "prose", text: [], planning: {} };

function detailLines(c: ChapterContent): string[] {
  if (!c.name) return [];
  return [
    `Title: ${c.name}`,
    `Format: ${c.format}`,
    ...slateLines(c.description, "Description: "),
    ...(c.mainSourceDraftId ? [`Main text comes from draft ${c.mainSourceDraftId}`] : []),
  ];
}

const planningLines = (c: ChapterContent) =>
  PLANNING_KINDS.flatMap((k) => Object.entries(c.planning?.[k] || {}).map(([n, note]) => `${k.replace(/s$/, "")} · ${n}${note ? `: ${note}` : ""}`));

/**
 * What differs in a chapter. null means the chapter is missing on that side.
 * Notes, drafts and the task board are compared only when Staging tracks them:
 * a field the staged chapter leaves out is not pushed.
 */
export function chapterParts(staging: ChapterContent | null, studio: ChapterContent | null): ReviewPart[] {
  const a = staging || EMPTY_CHAPTER;
  const b = studio || EMPTY_CHAPTER;
  const whole = !staging || !studio;
  const parts: (ReviewPart | undefined)[] = [
    linePart("text", "Text", textLines(a.text), textLines(b.text)),
    whole || a.annotations !== undefined
      ? itemPart("notes", "Notes", itemChanges(a.annotations, b.annotations, (n) => ({ title: noteTitle(n), side: noteSide(n) })))
      : undefined,
    whole || a.drafts !== undefined
      ? itemPart(
          "drafts",
          "Drafts",
          itemChanges(
            a.drafts?.map((d) => ({ ...d, chapterId: "" })),
            b.drafts?.map((d) => ({ ...d, chapterId: "" })),
            (d) => ({ title: `Draft “${d.name}”`, side: draftSide(d) }),
            (x, y) => diffBlocks(textLines(x.text), textLines(y.text)),
          ),
        )
      : undefined,
    linePart("details", "Details", detailLines(a), detailLines(b)),
    linePart("planning", "Planning", planningLines(a), planningLines(b)),
    whole || a.taskBoard !== undefined ? linePart("tasks", "Tasks", taskBoardLines(a.taskBoard), taskBoardLines(b.taskBoard)) : undefined,
  ];
  return parts.filter((p): p is ReviewPart => !!p);
}

export function entityParts(staging: EntityContent | null, studio: EntityContent | null): ReviewPart[] {
  const part = linePart("content", "Content", staging ? entityLines(staging) : [], studio ? entityLines(studio) : []);
  return part ? [part] : [];
}

export function bookParts(staging: BookContent, studio: BookContent): ReviewPart[] {
  const part = linePart("content", "Settings", bookLines(staging), bookLines(studio));
  return part ? [part] : [];
}

/** Fingerprint of a change, so an accept no longer counts once the change itself changes. */
export const reviewPrint = (key: string, parts: ReviewPart[]) => hashOf({ key, parts });
