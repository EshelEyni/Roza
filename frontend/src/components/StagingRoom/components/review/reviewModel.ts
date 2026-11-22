import type {
  BookDetail,
  ChangeSource,
  EntityKind,
  ProdStatus,
  ReviewPart,
  RevertTarget,
} from "../../../../../../shared/types/stagingRoom";

export const BOOK_KEY = "book:settings";

/** One changed item in the review list: a chapter, a story element, or the book settings. */
export interface ReviewEntry {
  key: string;
  kind: "chapter" | EntityKind | "book";
  group: string;
  title: string;
  /** chapter number, file name, or what kind of element */
  meta: string;
  number?: number;
  /** staged chapter file, for the editor */
  file?: string;
  /** added = only in Staging, removed = only in Writing Studio */
  change: "added" | "removed" | "edited";
  direction?: "push" | "pull" | "conflict";
  parts: ReviewPart[];
  summary: string[];
  print?: string;
  accepted: boolean;
  source?: ChangeSource;
  /** Push sends it only when ticked. New items are always sent. */
  pushable: boolean;
  /** single parts, notes, drafts and text changes can be rejected alone */
  partReject: boolean;
}

const GROUPS: Record<string, string> = {
  chapter: "Chapters",
  characters: "Characters",
  themes: "Themes",
  plotlines: "Plotlines",
  notes: "Notes",
  book: "Book",
};
export const groupOrder = Object.values(GROUPS);

export function reviewEntries(status: ProdStatus | undefined, book: BookDetail | undefined): ReviewEntry[] {
  if (!status) return [];
  const numbers = new Map((book?.chapters || []).map((c) => [c.file, c.number]));
  const out: ReviewEntry[] = [];
  for (const c of status.chapters) {
    if (c.status === "same") continue;
    const change = c.status === "new" ? "added" : c.status === "prod-only" ? "removed" : "edited";
    const number = c.file ? numbers.get(c.file) : undefined;
    out.push({
      key: c.key,
      kind: "chapter",
      group: GROUPS.chapter,
      title: c.name,
      meta: [number !== undefined ? `Chapter ${number}` : "", c.file || "only in Writing Studio"].filter(Boolean).join(" · "),
      number,
      file: c.file,
      change,
      direction: c.direction,
      parts: c.parts || [],
      summary: c.summary || [],
      print: c.print,
      accepted: !!c.accepted,
      source: c.source,
      pushable: change === "edited",
      partReject: change === "edited",
    });
  }
  for (const e of status.entityChanges || []) {
    const change = e.status === "new" ? "added" : e.status === "prod-only" ? "removed" : "edited";
    out.push({
      key: `${e.kind}:${e.name}`,
      kind: e.kind,
      group: GROUPS[e.kind],
      title: e.name,
      meta: e.kind.replace(/s$/, ""),
      change,
      direction: e.direction,
      parts: e.parts || [],
      summary: e.summary || [],
      print: e.print,
      accepted: !!e.accepted,
      source: e.source,
      pushable: change === "edited",
      partReject: false,
    });
  }
  const b = status.bookChange;
  if (b)
    out.push({
      key: BOOK_KEY,
      kind: "book",
      group: GROUPS.book,
      title: "Book settings",
      meta: "name, word goal, task board, publishing, narrator",
      change: "edited",
      direction: b.direction,
      parts: b.parts || [],
      summary: b.summary,
      print: b.print,
      accepted: !!b.accepted,
      source: b.source,
      pushable: true,
      partReject: false,
    });
  return out;
}

/** A short word for where the item stands. */
export function stateOf(e: ReviewEntry): { label: string; tone: "ok" | "warn" | "danger" | "neutral" | "info" } {
  if (e.change === "added") return { label: "New in Staging", tone: "info" };
  if (e.change === "removed") return { label: "Only in Writing Studio", tone: "neutral" };
  if (e.direction === "conflict") return { label: "Changed in both", tone: "danger" };
  if (e.direction === "pull") return { label: "Changed in Writing Studio", tone: "neutral" };
  return { label: "Changed in Staging", tone: "warn" };
}

export const letterOf = (e: ReviewEntry) =>
  e.direction === "conflict" ? "!" : e.change === "added" ? "A" : e.change === "removed" ? "D" : "M";

/** Items that still need a decision. An item missing from Staging needs none: Push leaves it alone. */
export const needsReview = (e: ReviewEntry) => !e.accepted && e.change !== "removed";

export const markOf = (e: ReviewEntry) => (e.accepted ? "Accepted" : e.change === "removed" ? "Not pushed" : "To review");

export const changeCount = (e: ReviewEntry) => e.parts.reduce((n, p) => n + p.changes, 0);

export const wholeTarget = (e: ReviewEntry): RevertTarget => ({ key: e.key });

/** What Reject does to a whole item, in words. */
export function rejectWords(e: ReviewEntry): string {
  if (e.change === "added") return `“${e.title}” only exists in Staging. Rejecting removes it from Staging.`;
  if (e.change === "removed") return `“${e.title}” is missing from Staging. Rejecting copies it back from Writing Studio.`;
  return `Staging gets Writing Studio's version of “${e.title}”.`;
}

export const sourceInitial = (s?: ChangeSource) => (s ? s.name.trim().charAt(0).toUpperCase() || "?" : "?");
