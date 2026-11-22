/**
 * History of a staged project: every step that changed it, who made it, and which
 * items it touched. Kept on the project itself (newest last), so both the Staging
 * Room and the AI connector can write it without another collection.
 */
import { randomUUID } from "node:crypto";
import type { ChangeSource, EntityKind, HistoryEvent, LocalBookFile, PublishState } from "../../../../shared/types/stagingRoom";
import type { LoadedChapter } from "./bookFiles";
import { hashOf } from "./fullData";

export const HISTORY_LIMIT = 200;
/** Editor saves within this time join the previous editor step. */
const EDITOR_SESSION_MS = 20 * 60_000;
const ENTITY_KINDS: EntityKind[] = ["characters", "themes", "plotlines", "notes"];
const BOOK_SETTINGS = ["bookName", "wordGoal", "taskBoard", "publishing", "audiobookNarrator"] as const;
const BOOK_EDITS = ["replaceText", "archiveInProd", "syncChapterOrder", "language", "userId"] as const;

type Snapshot = { book: LocalBookFile; chapters: LoadedChapter[]; state?: PublishState };

const same = (a: unknown, b: unknown) => hashOf(a ?? null) === hashOf(b ?? null);

/** Item keys that differ between two versions of a staged project. */
export function changedKeys(before: Snapshot, after: Snapshot): string[] {
  const keys = new Set<string>();
  const a = new Map(before.chapters.map((c) => [c.file, c.data]));
  const b = new Map(after.chapters.map((c) => [c.file, c.data]));
  for (const file of new Set([...a.keys(), ...b.keys()])) {
    if (same(a.get(file), b.get(file))) continue;
    keys.add(file);
    // A removed chapter shows in Compare under its Writing Studio id.
    const prodId = before.state?.chapters?.[file];
    if (!b.has(file) && prodId) keys.add(`prod:${prodId}`);
  }
  for (const kind of ENTITY_KINDS) {
    const x = (before.book[kind] || {}) as Record<string, unknown>;
    const y = (after.book[kind] || {}) as Record<string, unknown>;
    for (const name of new Set([...Object.keys(x), ...Object.keys(y)])) if (!same(x[name], y[name])) keys.add(`${kind}:${name}`);
  }
  if (BOOK_SETTINGS.some((f) => !same(before.book[f], after.book[f]))) keys.add("book:settings");
  if (BOOK_EDITS.some((f) => !same(before.book[f], after.book[f]))) keys.add("book:edits");
  return [...keys];
}

/** Adds a step. An editor save joins the last editor step when it is recent. */
export function addEvent(history: HistoryEvent[] | undefined, event: Omit<HistoryEvent, "id" | "at">): HistoryEvent[] {
  const list = [...(history || [])];
  const now = new Date();
  const last = list[list.length - 1];
  if (
    event.source === "editor" &&
    last?.source === "editor" &&
    now.getTime() - Date.parse(last.at) < EDITOR_SESSION_MS
  ) {
    const keys = [...new Set([...last.keys, ...event.keys])];
    list[list.length - 1] = { ...last, at: now.toISOString(), keys, summary: event.summary };
  } else list.push({ ...event, id: randomUUID(), at: now.toISOString() });
  return list.slice(-HISTORY_LIMIT);
}

/** True when the next editor save starts a new step (and so needs its own backup). */
export function startsEditorStep(history: HistoryEvent[] | undefined): boolean {
  const last = history?.[history.length - 1];
  return !(last?.source === "editor" && Date.now() - Date.parse(last.at) < EDITOR_SESSION_MS);
}

const SOURCE_NAMES: Record<HistoryEvent["source"], string> = {
  connector: "AI connector",
  import: "Folder import",
  editor: "Staging editor",
  pull: "Pull from Writing Studio",
  push: "Push",
  reject: "Reject",
  restore: "Restore",
};

export const sourceName = (e: HistoryEvent, clients: Map<string, string>) =>
  e.name || (e.clientId && clients.get(e.clientId)) || SOURCE_NAMES[e.source];

/**
 * The step that made an item what it is now: the newest one that touched it.
 * Items nobody touched since the project was made come from the step that made it.
 */
export function sourceOf(history: HistoryEvent[] | undefined, key: string, clients: Map<string, string>): ChangeSource | undefined {
  const list = history || [];
  let event: HistoryEvent | undefined;
  for (let i = list.length - 1; i >= 0 && !event; i--) if (list[i].keys.includes(key)) event = list[i];
  event ??= list.find((e) => e.keys.length === 0 && (e.source === "import" || e.source === "connector"));
  return event && { kind: event.source, name: sourceName(event, clients), at: event.at, summary: event.summary };
}
