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

/** A task Claude adds to a task board. */
export interface StagedTask {
  title: string;
  description?: string;
  /** live chapter id the card links to */
  chapterId?: string;
  /** true: add the card to that chapter's own board instead of the book board */
  onChapterBoard?: boolean;
  /** the list to add it to, by title; made when missing. Default: the board's first list. */
  list?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  /** checklist item titles */
  checklist?: string[];
}

/** One link from a chapter to a character, theme or plotline (the chapter's planning). */
export interface PlanningLink {
  entityId: string;
  note: string;
}
export type PlanningKind = "characters" | "themes" | "plotlines";
export type ChapterPlanningLinks = Record<PlanningKind, PlanningLink[]>;

/** New values for an existing task card. Left out = unchanged. */
export interface TaskEdit {
  title?: string;
  description?: string;
  completed?: boolean;
  /** YYYY-MM-DD, or "" to clear */
  dueDate?: string;
  /** the full new checklist */
  checklist?: { title: string; done: boolean }[];
  /** move the card to this list, by title; made when missing */
  list?: string;
  /** link the card to this live chapter id; "" = no chapter */
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
    | {
        kind: "summary";
        /** live chapter id */
        chapterId: string;
        /** the new chapter summary (the Bible's Summary tab) */
        text: SlateElement[];
        /** hash of the chapter's summary when it was read */
        baseHash: string;
      }
    | {
        kind: "planning";
        chapterId: string;
        /** the new links for each kind given; kinds left out stay as they are */
        planning: Partial<ChapterPlanningLinks>;
        /** hash of the chapter's planning when it was read */
        baseHash: string;
      }
    | {
        kind: "chapterSettings";
        chapterId: string;
        name?: string;
        format?: "prose" | "screenplay";
        /** move the chapter after this live chapter id; null = first */
        move?: { afterId: string | null };
      }
    | { kind: "tasks"; tasks: StagedTask[] }
    | {
        kind: "taskEdit";
        cardId: string;
        /** the chapter whose own board holds the card; left out = the book board */
        boardChapterId?: string;
        /** the card's title when it was read */
        cardTitle: string;
        edit: TaskEdit;
        /** hash of the card when it was read */
        baseHash: string;
      }
    | {
        kind: "delete";
        target: DeleteTarget;
        /** hash of the live item when it was read; null = not checked (drafts) */
        baseHash: string | null;
      }
  );

/** What a pending delete removes from the live book when approved. */
export type DeleteTarget =
  | {
      type: "task";
      cardId: string;
      /** the chapter whose own board holds the card; left out = the book board */
      boardChapterId?: string;
      title: string;
    }
  | { type: "element"; element: EntityKind; name: string }
  | { type: "draft"; chapterId: string; draftId: string; name: string };

export type StagedChangeKind = StagedChange["kind"];

/** A draft in Writing Studio. Text is missing in copies made before drafts were kept. */
export interface LiveDraft {
  id: string;
  name: string;
  words: number;
  text?: SlateElement[];
  annotations?: ChapterAnnotation[];
  summary?: string;
  format?: "prose" | "screenplay";
}

/** The read-only copy of the live book kept on the staging row (the connector can't read live books). */
export interface LiveChapter {
  id: string;
  name: string;
  format: "prose" | "screenplay";
  text: SlateElement[];
  /** hash of the Main text */
  mainHash: string;
  /** the chapter summary (the Bible's Summary tab; missing in copies made before it was kept) */
  summary?: SlateElement[];
  summaryHash?: string;
  /** links to characters, themes and plotlines */
  planning?: ChapterPlanningLinks;
  planningHash?: string;
  /** the chapter's own task board */
  taskBoard?: TaskBoard;
  /** notes on the Main text (missing in copies made before they were kept) */
  annotations?: ChapterAnnotation[];
  drafts: LiveDraft[];
}
export interface LiveElement {
  /** live element id (missing in old copies) */
  id?: string;
  name: string;
  color?: string;
  text: SlateElement[];
  hash: string;
}
export interface LiveCopy {
  /** what this copy holds; older copies are refreshed when the Staging Room opens */
  copyVersion?: number;
  bookId: string;
  name: string;
  updatedAt: string;
  chapters: LiveChapter[];
  characters: LiveElement[];
  themes: LiveElement[];
  plotlines: LiveElement[];
  notes: LiveElement[];
  /** the book task board */
  taskBoard?: TaskBoard;
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
  tone: "new" | "changed" | "removed";
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

/** Browse book: the live book's contents, read only. */
export interface BrowseOutline {
  /** false: the book is not in Writing Studio yet, so there is nothing to browse */
  linked: boolean;
  chapters: {
    id: string;
    name: string;
    words: number;
    /** changes waiting for this chapter */
    waiting: number;
    drafts: { id: string; name: string; words: number }[];
  }[];
  elements: Record<EntityKind, { name: string; words: number }[]>;
}

/** Browse book: one chapter version or story element, read only. */
export interface BrowseText {
  title: string;
  subtitle: string;
  words: number;
  paragraphs: { align?: string; text: string }[];
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
