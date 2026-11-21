/**
 * Edits to a book that already exists in prod, declared in book.json:
 *   "replaceText":      [["Old Name", "New Name"]]  find/replace in all text of the prod book
 *   "archiveInProd":    ["The Two Women"]       archive prod chapters by name
 *   "syncChapterOrder": true                    order prod chapters like the local numbers
 *
 * Pure: takes the raw prod document and returns the new arrays plus a description
 * of what would change. The caller writes them (with backup + updatedAt guard).
 */
import type { LocalBookFile } from "../../../shared/types/stagingRoom";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Item = Record<string, any>;

export interface ProdEditPlan {
  messages: string[];
  changed: boolean;
  next: { chapters: Item[]; characters: Item[]; themes: Item[]; plotlines: Item[]; notes: Item[] };
}

const KINDS = ["chapters", "characters", "themes", "plotlines", "notes"] as const;

export function planProdEdits(
  book: LocalBookFile,
  prod: Item,
  /** prod chapter id -> local chapter number, for chapters matched to local files */
  localNumbers: Map<string, number>,
  now = new Date(),
): ProdEditPlan {
  const messages: string[] = [];
  const pairs = (book.replaceText || []).filter(([from]) => from);
  const next = Object.fromEntries(KINDS.map((k) => [k, [...(prod[k] || [])]])) as ProdEditPlan["next"];

  /* 1. find/replace */
  if (pairs.length) {
    let hits = 0;
    const rep = (s: unknown) => {
      if (typeof s !== "string") return s;
      let out = s;
      for (const [from, to] of pairs) {
        const n = out.split(from).length - 1;
        if (n) {
          hits += n;
          out = out.split(from).join(to);
        }
      }
      return out;
    };
    const slate = (nodes: unknown): unknown =>
      Array.isArray(nodes)
        ? nodes.map((n) => {
            if (!n || typeof n !== "object") return n;
            const o: Item = { ...n };
            if (typeof o.text === "string") o.text = rep(o.text);
            if (Array.isArray(o.children)) o.children = slate(o.children);
            return o;
          })
        : nodes;
    for (const kind of KINDS) {
      next[kind] = next[kind].map((item) => {
        const before = hits;
        const o: Item = { ...item };
        o.name = rep(o.name);
        if (o.description) o.description = slate(o.description);
        if (o.text) o.text = slate(o.text);
        if (Array.isArray(o.annotations))
          o.annotations = o.annotations.map((a: Item) => ({ ...a, content: rep(a.content), quote: rep(a.quote) }));
        if (o.planning && typeof o.planning === "object") {
          o.planning = { ...o.planning };
          for (const k of ["characters", "themes", "plotlines"])
            if (Array.isArray(o.planning[k]))
              o.planning[k] = o.planning[k].map((l: Item) => ({ ...l, note: rep(l.note) }));
        }
        if (hits !== before) o.updatedAt = now;
        return hits !== before ? o : item;
      });
    }
    if (hits)
      messages.push(
        `Replace text in Roza: ${pairs.map(([f, t]) => `“${f}” → “${t}”`).join(", ")} (${hits} place(s) in chapters, characters, themes, plotlines and notes)`,
      );
  }

  /* 2. archive chapters by name */
  const archiveNames = new Set(book.archiveInProd || []);
  if (archiveNames.size) {
    const archived: string[] = [];
    next.chapters = next.chapters.map((c) => {
      if (c.isArchived === true || !archiveNames.has(c.name)) return c;
      if (localNumbers.has(String(c._id))) return c; // never archive a chapter we upload
      archived.push(c.name);
      return { ...c, isArchived: true, updatedAt: now };
    });
    if (archived.length) messages.push(`Archive in Roza: ${archived.join(", ")}`);
  }

  /* 3. order chapters like the local numbering; anything not uploaded keeps its order at the end */
  if (book.syncChapterOrder) {
    const before = next.chapters.map((c) => String(c._id));
    const matched = next.chapters
      .filter((c) => localNumbers.has(String(c._id)))
      .sort((a, b) => localNumbers.get(String(a._id))! - localNumbers.get(String(b._id))!);
    const rest = next.chapters.filter((c) => !localNumbers.has(String(c._id)));
    const live = rest.filter((c) => c.isArchived !== true);
    next.chapters = [...matched, ...rest];
    const moved = next.chapters.some((c, i) => String(c._id) !== before[i]);
    if (moved)
      messages.push(
        `Reorder chapters in Roza to match the local numbers` +
          (live.length ? ` (not uploaded, placed at the end: ${live.map((c) => c.name).join(", ")})` : ""),
      );
  }

  return { messages, changed: messages.length > 0, next };
}
