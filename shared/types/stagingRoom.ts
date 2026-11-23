/** Types shared by the Electron main process and the React renderer. Type-only. */
import type { BookPublishing } from "./books";
import type { ReaderAudiobookNarrator } from "./reader";

export interface SlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface SlateElement {
  type: string;
  align?: "left" | "center" | "right" | "justify";
  children: (SlateText | SlateElement)[];
}

/** Planning links in local files use entity *names*; ids are resolved at upload. */
export interface LocalPlanning {
  characters?: Record<string, string>;
  themes?: Record<string, string>;
  plotlines?: Record<string, string>;
}

/** Rich text: plain text (newlines become paragraphs) or Roza's Slate nodes (keeps formatting). */
export type RichText = string | SlateElement[];

/** A note on a chapter (Writing Studio "Add note" and general notes). Same shape as Roza. */
export interface ChapterAnnotation {
  id: string;
  general?: boolean;
  content: string;
  quote: string;
  anchor: { anchor: { path: number[]; offset: number }; focus: { path: number[]; offset: number } } | null;
}

export interface ChapterDraft {
  id: string;
  /** "main-backup": the Writing Studio's copy of the main text, made when a draft became the main text. */
  kind?: "main-backup";
  summary?: string;
  chapterId: string;
  name: string;
  text: SlateElement[];
  createdAt: string;
  updatedAt: string;
  annotations?: ChapterAnnotation[];
  format?: "prose" | "screenplay";
}

/** Roza's task board (book level and chapter level), kept as Roza stores it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaskBoard = { lists: any[] };

/** books/<slug>/book.json */
export interface LocalBookFile {
  bookName: string;
  userId: string;
  language?: string;
  /** Roza's word goal for the book. null = remove it from Roza on push. */
  wordGoal?: number | null;
  taskBoard?: TaskBoard;
  /** EPUB publishing settings, as Roza stores them. Dates are ISO strings. null = remove from Roza on push. */
  publishing?: StagedPublishing | null;
  /** The book's audiobook narrator. null = remove from Roza on push. */
  audiobookNarrator?: ReaderAudiobookNarrator | null;
  /** name -> description */
  characters?: Record<string, RichText>;
  /** name -> [hex color, description] */
  themes?: Record<string, [string, RichText]>;
  plotlines?: Record<string, [string, RichText]>;
  /** name -> text */
  notes?: Record<string, RichText>;
  /** Edits applied to the existing prod book on every upload (see electron/lib/prodEdits.ts). */
  /** find/replace pairs applied to all text of the prod book */
  replaceText?: [string, string][];
  /** prod chapter names to archive */
  archiveInProd?: string[];
  /** reorder prod chapters to match the local chapter numbers */
  syncChapterOrder?: boolean;
}

/** books/<slug>/chapters/NN.json */
export interface LocalChapterFile {
  number: number;
  name: string;
  format?: "prose" | "screenplay";
  description?: SlateElement[];
  text: SlateElement[];
  planning?: LocalPlanning;
  /**
   * The fields below mirror Roza. Left out = not tracked here: push leaves Roza's version alone
   * (and when the text changes, Roza's notes are re-attached to the new text by their quote).
   */
  annotations?: ChapterAnnotation[];
  drafts?: ChapterDraft[];
  /** Id of the draft the main text came from (Writing Studio "Make main"). */
  mainSourceDraftId?: string;
  taskBoard?: TaskBoard;
}

/** Roza's publishing settings. chapterIds are live chapter ids. */
export type StagedPublishing = BookPublishing;

/** books/<slug>/.publish-state.json — written after each successful upload. */
export interface PublishState {
  prodBookId?: string;
  dbName?: string;
  lastUploadAt?: string;
  /** chapter file name -> prod chapter _id */
  chapters?: Record<string, string>;
  /** last upload or pull */
  lastSyncAt?: string;
  /** chapter file name -> fingerprint of the text both sides had at the last sync */
  prints?: Record<string, string>;
  /** "kind:name" -> fingerprint of the story element at the last sync */
  entityPrints?: Record<string, string>;
  /** Full-data fingerprints (every field, formatting and notes included). Used before the two above. */
  fullPrints?: Record<string, string>;
  fullEntityPrints?: Record<string, string>;
  /** book settings (name, word goal, task board, publishing, narrator) at the last sync */
  bookPrint?: string;
}

/** A legacy staged project folder, as Import folder reads it. */
export interface StagingProjectInput {
  slug: string;
  book: LocalBookFile;
  chapters: { file: string; data: LocalChapterFile; mtimeMs?: number }[];
  bookMtimeMs?: number;
  state?: PublishState;
}

export type EntityKind = "characters" | "themes" | "plotlines" | "notes";

/* ------------------------------------------------------------------ */
/* Staging Room v2: a basket of changes on top of the live book.       */
/* See docs/staging-room-prd.md.                                       */
/* ------------------------------------------------------------------ */

/** A task Claude adds to the book's task board. */
export interface StagedTask {
  title: string;
  description?: string;
  /** live chapter id the card links to */
  chapterId?: string;
}

interface ChangeBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** who made it: the connector app (Claude, ChatGPT...), the Staging editor, or Import folder */
  by: "connector" | "editor" | "import";
  clientId?: string;
}

/**
 * One pending change. Text changes remember the hash of the live Main they were based on,
 * so approving never overwrites manual work done in Writing Studio meanwhile.
 */
export type StagedChange = ChangeBase &
  (
    | {
        kind: "draft";
        /** live chapter id */
        chapterId: string;
        name: string;
        text: SlateElement[];
        /** hash of the chapter's Main text when the draft was started */
        baseHash: string;
        notes?: ChapterAnnotation[];
      }
    | { kind: "main"; chapterId: string; text: SlateElement[]; baseHash: string; notes?: ChapterAnnotation[] }
    | {
        kind: "chapter";
        name: string;
        /** live chapter id (or the id of a pending new chapter) to insert after; null = at the end */
        afterId: string | null;
        text: SlateElement[];
        notes?: ChapterAnnotation[];
      }
    | {
        kind: "element";
        element: EntityKind;
        name: string;
        color?: string;
        text: SlateElement[];
        /** hash of the live element when it was read; null = a new element */
        baseHash: string | null;
      }
    | { kind: "notes"; chapterId: string; notes: ChapterAnnotation[] }
    | { kind: "tasks"; tasks: StagedTask[] }
  );

export type StagedChangeKind = StagedChange["kind"];

/** The read-only copy of the live book kept on the staging row (the connector can't read live books). */
export interface LiveChapter {
  id: string;
  name: string;
  format: "prose" | "screenplay";
  text: SlateElement[];
  /** hash of the Main text */
  mainHash: string;
  /** notes on the Main text (missing in copies made before they were kept) */
  annotations?: ChapterAnnotation[];
  drafts: { id: string; name: string; words: number }[];
}
export interface LiveElement {
  name: string;
  color?: string;
  text: SlateElement[];
  hash: string;
}
export interface LiveCopy {
  bookId: string;
  name: string;
  updatedAt: string;
  chapters: LiveChapter[];
  characters: LiveElement[];
  themes: LiveElement[];
  plotlines: LiveElement[];
  notes: LiveElement[];
  copiedAt: string;
}

/** One row in the book list. */
export interface StagedBookSummary {
  slug: string;
  bookName: string;
  language: string;
  /** false: the book is not in Writing Studio yet; approving creates it */
  linked: boolean;
  chapters: number;
  words: number;
  pending: number;
  pinned: boolean;
}

export type ChangeGroup =
  | { type: "chapter"; chapterId: string; name: string; order: number }
  | { type: "elements" }
  | { type: "tasks" };

/** A pending change as the Changes screen shows it. */
export interface ChangeView {
  id: string;
  kind: StagedChangeKind;
  group: ChangeGroup;
  /** e.g. NEW DRAFT, 2 NOTES, CHANGED */
  tag: string;
  tone: "new" | "changed";
  title: string;
  meta: string;
  readable: boolean;
  editable: boolean;
  /** set when Writing Studio changed since Claude read it */
  warning?: string;
  updatedAt: string;
}

export interface StagedBookView {
  slug: string;
  bookName: string;
  linked: boolean;
  revision: number;
  changes: ChangeView[];
  /** the newest connector save, to show "Claude is editing" */
  lastClaudeSave?: { at: string; title: string };
}

/** The reading view: text with new words marked. Removed text is not shown. */
export interface ReadView {
  id: string;
  title: string;
  subtitle: string;
  words: number;
  editable: boolean;
  paragraphs: { align?: string; segments: { text: string; isNew: boolean }[] }[];
}

/** The editor's copy of a text change. */
export interface ChangeTextView {
  id: string;
  slug: string;
  bookName: string;
  title: string;
  subtitle: string;
  format: "prose" | "screenplay";
  text: SlateElement[];
  updatedAt: string;
}

export interface ApproveResult {
  approved: number;
  messages: string[];
  /** changes whose live version changed since Claude read it; nothing was written. Approve again with confirm. */
  conflicts?: { id: string; title: string }[];
}

export interface StagingPrefs {
  order: string[];
  pinned: string[];
  filter: "pinned" | "unpinned" | "all";
}

export interface LiveBookOption {
  id: string;
  name: string;
  staged: boolean;
}
