/**
 * The staging row (staging_room_projects) for Staging Room v2, and the way an older
 * full-copy project or an imported folder becomes a list of pending changes.
 * Shared by the Staging Room router and the Claude connector.
 */
import { randomUUID } from "node:crypto";
import type {
  EntityKind,
  LiveCopy,
  LocalBookFile,
  LocalChapterFile,
  PublishState,
  RichText,
  StagedChange,
} from "../../../../shared/types/stagingRoom";
import { ELEMENT_KINDS, elementHash, textHash } from "./changes";
import { asSlate, DEFAULT_COLOR } from "./fullData";
import { countWords } from "./slate";

export interface ProjectRow {
  _id: string;
  owner: string;
  slug: string;
  version: 2;
  bookName: string;
  /** owner of the live book */
  userId: string;
  language: string;
  /** the Writing Studio book; missing until the book is created by an approval */
  liveBookId?: string;
  /** read-only copy of the live book, for the connector (which can't read live books) */
  live?: LiveCopy;
  changes: StagedChange[];
  revision: number;
  /** set while an approval is writing */
  lease?: { id: string; until: Date };
}

/** A project row from before v2: a full copy of the book. */
export interface LegacyCopy {
  book: LocalBookFile;
  chapters: { file: string; data: LocalChapterFile }[];
  state?: PublishState;
}

export const isV2 = (row: { version?: unknown } | null | undefined): row is ProjectRow => row?.version === 2;

const importName = (d = new Date()) => `Imported · ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

function localElement(kind: EntityKind, value: RichText | [string, RichText]) {
  if (kind === "themes" || kind === "plotlines") {
    const [color, desc] = value as [string, RichText];
    return { color: color || DEFAULT_COLOR, text: asSlate(desc) };
  }
  return { color: undefined, text: asSlate(value as RichText) };
}

/**
 * What a full copy adds to the live book, as pending changes. Nothing is removed:
 * a chapter whose text differs becomes a new draft, a missing chapter a new chapter,
 * and a new or different story element an element change.
 */
export function changesFromCopy(copy: LegacyCopy, live: LiveCopy | undefined): StagedChange[] {
  const now = new Date().toISOString();
  const base = () => ({ id: randomUUID(), createdAt: now, updatedAt: now, by: "import" as const });
  const out: StagedChange[] = [];
  const used = new Set<string>();
  let previous: string | null = null;
  const chapters = [...copy.chapters].sort((a, b) => a.data.number - b.data.number);
  for (const { file, data } of chapters) {
    const savedId = copy.state?.chapters?.[file];
    const match =
      live?.chapters.find((c) => c.id === savedId && !used.has(c.id)) ??
      live?.chapters.find((c) => c.name === data.name && !used.has(c.id));
    if (match) {
      used.add(match.id);
      previous = match.id;
      if (countWords(data.text) && textHash(data.text) !== match.mainHash)
        out.push({ ...base(), kind: "draft", chapterId: match.id, name: importName(), text: data.text, baseHash: match.mainHash });
      continue;
    }
    const change: StagedChange = { ...base(), kind: "chapter", name: data.name, afterId: previous, text: data.text };
    out.push(change);
    previous = change.id;
  }
  for (const kind of ELEMENT_KINDS) {
    const source = (copy.book[kind] || {}) as Record<string, RichText | [string, RichText]>;
    for (const [name, value] of Object.entries(source)) {
      const { color, text } = localElement(kind, value);
      const current = live?.[kind].find((x) => x.name === name);
      if (current && current.hash === elementHash(color, text)) continue;
      out.push({ ...base(), kind: "element", element: kind, name, ...(color ? { color } : {}), text, baseHash: current?.hash ?? null });
    }
  }
  return out;
}
