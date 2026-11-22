/** Types shared by the Electron main process and the React renderer. Type-only. */

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
  taskBoard?: TaskBoard;
}

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
  /** book name + word goal + task board at the last sync */
  bookPrint?: string;
}

export interface ChapterSummary {
  file: string;
  number: number;
  name: string;
  words: number;
  paragraphs: number;
  /** chapter notes (annotations) in the local file */
  notes: number;
  drafts: number;
  errors: string[];
}

export interface EntitySummary {
  name: string;
  color?: string;
  text: string;
}

export interface BookSummary {
  slug: string;
  bookName: string;
  language: string;
  userId: string;
  chapterCount: number;
  words: number;
  errors: string[];
  prodBookId?: string;
  lastUploadAt?: string;
}

export interface BookListPrefs {
  /** Slugs in the order shown in the sidebar. Books not listed go last. */
  order: string[];
  hidden: string[];
  showHidden: boolean;
}

export interface BookDetail extends BookSummary {
  chapters: ChapterSummary[];
  characters: EntitySummary[];
  themes: EntitySummary[];
  plotlines: EntitySummary[];
  notes: EntitySummary[];
}

export interface ChapterPreview {
  file: string;
  name: string;
  description: string[];
  paragraphs: { text: string; align?: string }[];
  planning: { kind: string; name: string; note: string }[];
  notes: { general: boolean; quote: string; content: string; attached: boolean }[];
}

export type EntityKind = "characters" | "themes" | "plotlines" | "notes";

/** One line of a paragraph diff: only local, only in Roza, unchanged, or a run of hidden unchanged paragraphs. */
export interface DiffLine {
  kind: "same" | "local" | "roza" | "skip";
  text?: string;
  count?: number;
}

export interface ProdChapterStatus {
  /** chapter file name, or "prod:<id>" for chapters that only exist in Roza */
  key: string;
  /** for "differs": which side changed since the last sync */
  direction?: "pull" | "push" | "conflict";
  /** paragraph diff, for chapters that differ */
  diff?: DiffLine[];
  /** short report of what differs, one line per part (text, notes, planning, ...) */
  summary?: string[];
  file?: string;
  name: string;
  status: "new" | "same" | "differs" | "prod-only";
  localWords?: number;
  prodWords?: number;
}

export interface ProdStatus {
  reviewToken?: string;
  dbName: string;
  host: string;
  bookExists: boolean;
  prodBookId?: string;
  prodUpdatedAt?: string;
  chapters: ProdChapterStatus[];
  entities: { kind: EntityKind; name: string; status: "new" | "exists" }[];
  /** reorder / archive / replace-text edits the next upload will make (book.json) */
  edits: string[];
  /** story elements that are new locally, only in Roza, or different */
  entityChanges?: {
    kind: EntityKind;
    name: string;
    status: "new" | "prod-only" | "differs";
    direction?: "pull" | "push" | "conflict";
    diff?: DiffLine[];
    summary?: string[];
  }[];
  /** the book's own fields (name, word goal, task board) differ. Synced with the key "book:settings". */
  bookChange?: { direction: "pull" | "push" | "conflict"; diff: DiffLine[]; summary: string[] };
}

export interface PullOptions {
  reviewToken?: string;
  /** chapter keys (file name, or "prod:<id>") */
  chapters: string[];
  /** "kind:name", or "book:settings" for the book's name, word goal and task board */
  entities: string[];
}

export interface PullResult {
  chapters: number;
  entities: number;
  backupDir?: string;
}

export interface UploadOptions {
  reviewToken?: string;
  /** existing story elements ("kind:name") whose Roza version should be replaced by the local one; "book:settings" for the book's own fields */
  updateEntities?: string[];
  /** chapter files whose prod text should be replaced by the local version */
  overwriteChapters: string[];
}

export interface UploadResult {
  created: boolean;
  prodBookId: string;
  added: Record<"chapters" | EntityKind, number>;
  overwritten: number;
  /** existing story elements replaced with the local version */
  updatedEntities?: number;
  /** reorder / archive / replace-text edits that were applied */
  edits: string[];
  backupPath?: string;
}

export interface ConnectionInfo {
  configured: boolean;
  source: string;
  dbName?: string;
  host?: string;
  error?: string;
}

export interface LogLine {
  at: string;
  level: "info" | "ok" | "warn" | "error";
  text: string;
}

export interface StagingProjectInput {
  slug: string;
  book: LocalBookFile;
  chapters: { file: string; data: LocalChapterFile; mtimeMs?: number }[];
  bookMtimeMs?: number;
  state?: PublishState;
}

export interface StagingRoomApi {
  importProject(project: StagingProjectInput): Promise<{ created: boolean }>;
  listBooks(): Promise<BookSummary[]>;
  getListPrefs(): Promise<BookListPrefs>;
  setListPrefs(prefs: BookListPrefs): Promise<BookListPrefs>;
  getBook(slug: string): Promise<BookDetail>;
  getChapter(slug: string, file: string): Promise<ChapterPreview>;
  connectionInfo(): Promise<ConnectionInfo>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  prodStatus(slug: string): Promise<ProdStatus>;
  upload(slug: string, options: UploadOptions): Promise<UploadResult>;
  pull(slug: string, options: PullOptions): Promise<PullResult>;
  onLog(listener: (line: LogLine) => void): () => void;
}
