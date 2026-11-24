import type {
  Book,
  BookChange,
  BookCollection,
  BookFieldChanges,
  ChapterDraft,
} from "../../../../shared/types/books";

// A save sends only what changed since the last version the server confirmed.
// diffBook() lists those changes; applyBookChanges() replays them on a book,
// the same way the server does. Both are pure, so an offline queue can reuse them.

type Doc = Record<string, unknown>;

export const bookCollections: BookCollection[] = ["chapters", "characters", "themes", "plotlines", "notes"];
const bookFields = ["name", "filterBy", "isReadMode", "wordGoal", "taskBoard"] as const;
// The server sets these itself. Chapter drafts are diffed one by one.
const skippedItemFields = new Set(["id", "_id", "bookId", "type", "drafts"]);
const skippedDraftFields = new Set(["id", "chapterId"]);

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Drops Mongo ids from paragraph nodes. Nothing reads them, and they add ~10% to the text. */
export function withoutNodeIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutNodeIds) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const copy: Doc = {};
  for (const [key, child] of Object.entries(value)) if (key !== "_id") copy[key] = withoutNodeIds(child);
  return copy as T;
}

function fieldChanges(before: Doc | undefined, after: Doc, skipped: Set<string>) {
  const set: Doc = {};
  const unset: string[] = [];
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after)])) {
    if (skipped.has(key)) continue;
    const value = after[key];
    if (value === undefined) {
      if (before?.[key] !== undefined) unset.push(key);
    } else if (!before || !same(before[key], value)) set[key] = withoutNodeIds(value);
  }
  return { set, unset };
}

const changed = ({ set, unset }: { set: Doc; unset: string[] }) =>
  Object.keys(set).length > 0 || unset.length > 0;

function draftChanges(chapterId: string, before: ChapterDraft[] = [], after: ChapterDraft[] = []) {
  const changes: BookChange[] = [];
  const previous = new Map(before.map(draft => [draft.id, draft]));
  for (const draft of after) {
    const fields = fieldChanges(previous.get(draft.id) as Doc | undefined, draft as unknown as Doc, skippedDraftFields);
    if (changed(fields))
      changes.push({ type: "draft", chapterId, id: draft.id, set: fields.set, ...(fields.unset.length && { unset: fields.unset }) });
  }
  const ids = after.map(draft => draft.id);
  if (needsOrder(before.map(draft => draft.id), ids)) changes.push({ type: "draftOrder", chapterId, ids });
  return changes;
}

/** New entries are appended by the server, so only removals and moves need an order change. */
function needsOrder(before: string[], after: string[]) {
  const kept = before.filter(id => after.includes(id));
  const appended = after.filter(id => !before.includes(id));
  return kept.length !== before.length || !same([...kept, ...appended], after);
}

export function diffBook(before: Book, after: Book): BookChange[] {
  const changes: BookChange[] = [];
  const set: BookFieldChanges = {};
  for (const field of bookFields)
    if (after[field] !== undefined && !same(before[field], after[field]))
      (set as Doc)[field] = after[field];
  if (Object.keys(set).length) changes.push({ type: "book", set });

  for (const collection of bookCollections) {
    const previousItems = (before[collection] || []) as unknown as Doc[];
    const items = (after[collection] || []) as unknown as Doc[];
    const previous = new Map(previousItems.map(item => [String(item.id), item]));
    for (const item of items) {
      const id = String(item.id);
      const old = previous.get(id);
      const fields = fieldChanges(old, item, old ? skippedItemFields : new Set(["id", "_id", "bookId", "type"]));
      if (changed(fields))
        changes.push({ type: "item", collection, id, set: fields.set, ...(fields.unset.length && { unset: fields.unset }) });
      if (old && collection === "chapters")
        changes.push(...draftChanges(id, old.drafts as ChapterDraft[] | undefined, item.drafts as ChapterDraft[] | undefined));
    }
    const ids = items.map(item => String(item.id));
    if (needsOrder(previousItems.map(item => String(item.id)), ids))
      changes.push({ type: "order", collection, ids });
  }
  return changes;
}

const merge = (base: Doc, set: Doc, unset: string[] = []) => {
  const next = { ...base, ...set };
  for (const key of unset) delete next[key];
  return next;
};

/** Replays changes on a book, like the server. Used by tests and offline replay. */
export function applyBookChanges(book: Book, changes: BookChange[]): Book {
  const next = { ...book } as unknown as Doc;
  for (const change of changes) {
    if (change.type === "book") Object.assign(next, change.set);
    else if (change.type === "item") {
      const items = (next[change.collection] || []) as Doc[];
      next[change.collection] = items.some(item => item.id === change.id)
        ? items.map(item => (item.id === change.id ? merge(item, change.set, change.unset) : item))
        : [...items, { ...change.set, id: change.id, bookId: book.id, type: change.collection }];
    } else if (change.type === "order") {
      const items = (next[change.collection] || []) as Doc[];
      next[change.collection] = [
        ...change.ids.map(id => items.find(item => item.id === id)).filter(Boolean),
        ...items.filter(item => item.isArchived && !change.ids.includes(String(item.id))),
      ];
    } else {
      next.chapters = (next.chapters as Doc[]).map(chapter => {
        if (chapter.id !== change.chapterId) return chapter;
        const drafts = (chapter.drafts || []) as Doc[];
        if (change.type === "draftOrder")
          return { ...chapter, drafts: change.ids.map(id => drafts.find(draft => draft.id === id)).filter(Boolean) };
        const draft = drafts.find(entry => entry.id === change.id);
        return {
          ...chapter,
          drafts: draft
            ? drafts.map(entry => (entry === draft ? merge(entry, change.set as Doc, change.unset) : entry))
            : [...drafts, { ...change.set, id: change.id, chapterId: change.chapterId }],
        };
      });
    }
  }
  return next as unknown as Book;
}
