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

/** A paragraph in a review diff. n is its 1-based place in that side's text (the ¶ number). */
export interface DiffPara {
  n: number;
  text: string;
}

/**
 * One block of a side-by-side diff. "staging" is the staged copy, "studio" is the live
 * Writing Studio book. A "change" block has an id: Reject can undo that one change.
 */
export type DiffBlock =
  | { kind: "same"; staging: DiffPara; studio: DiffPara }
  | { kind: "skip"; count: number }
  | { kind: "change"; hunk: number; staging: DiffPara[]; studio: DiffPara[] };

/** One side of a changed note or draft. */
export interface ReviewItemSide {
  quote?: string;
  body: string;
  meta?: string;
}

/** A note or draft that was added, removed or edited in Staging. Matched by id. */
export interface ReviewItemChange {
  id: string;
  /** added = only in Staging, removed = only in Writing Studio */
  change: "added" | "removed" | "edited";
  title: string;
  staging?: ReviewItemSide;
  studio?: ReviewItemSide;
  /** text diff, for an edited draft */
  blocks?: DiffBlock[];
}

export type ReviewPartId = "text" | "notes" | "drafts" | "details" | "planning" | "tasks" | "content";

/** One part of an item that differs: the chapter text, its notes, its drafts, ... */
export interface ReviewPart {
  id: ReviewPartId;
  label: string;
  /** number of changes in this part */
  changes: number;
  blocks?: DiffBlock[];
  items?: ReviewItemChange[];
}

export type HistorySourceKind = "connector" | "import" | "editor" | "pull" | "push" | "reject" | "restore";

/** Where a staged change came from, taken from the project's history. */
export interface ChangeSource {
  kind: HistorySourceKind;
  name: string;
  at: string;
  summary: string;
}

/** Review fields shared by every changed item in Compare. */
export interface ReviewFields {
  /** what differs, split into parts */
  parts?: ReviewPart[];
  /** fingerprint of the change. An accept is kept only while the change stays the same. */
  print?: string;
  accepted?: boolean;
  /** latest history event that touched this item */
  source?: ChangeSource;
}

export interface ProdChapterStatus extends ReviewFields {
  /** chapter file name, or "prod:<id>" for chapters that only exist in Roza */
  key: string;
  /** for "differs": which side changed since the last sync */
  direction?: "pull" | "push" | "conflict";
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
  entityChanges?: EntityChange[];
  /** the book's own fields (name, word goal, task board) differ. Synced with the key "book:settings". */
  bookChange?: BookChange;
}

export interface EntityChange extends ReviewFields {
  kind: EntityKind;
  name: string;
  status: "new" | "prod-only" | "differs";
  direction?: "pull" | "push" | "conflict";
  summary?: string[];
}

export interface BookChange extends ReviewFields {
  direction: "pull" | "push" | "conflict";
  summary: string[];
}

/** What to reject. key is a chapter key, "kind:name", or "book:settings". */
export interface RevertTarget {
  key: string;
  /** only this part of a chapter. Left out: the whole item. */
  part?: ReviewPartId;
  /** only this change of the text part */
  hunk?: number;
  /** only this note or draft */
  itemId?: string;
}

export interface RevertOptions {
  reviewToken?: string;
  targets: RevertTarget[];
}

export interface RevertResult {
  reverted: number;
  backupDir?: string;
}

/** One step that changed a staged project. */
export interface HistoryEvent {
  id: string;
  at: string;
  source: HistorySourceKind;
  /** OAuth client id, for connector steps. The router turns it into a name. */
  clientId?: string;
  /** "Claude", "ChatGPT", "Staging editor", ... */
  name?: string;
  summary: string;
  /** item keys the step changed (chapter keys, "kind:name", "book:settings") */
  keys: string[];
  /** backup of what the step replaced */
  backupId?: string;
  /** what the backup holds: one chapter or the book ("item"), or the whole project ("project") */
  backupScope?: "item" | "project";
}

export interface ChapterSaveInput {
  revision: number;
  text: SlateElement[];
  annotations?: ChapterAnnotation[];
}

export interface ChapterDraftView {
  slug: string;
  bookName: string;
  revision: number;
  file: string;
  name: string;
  number: number;
  format: "prose" | "screenplay";
  text: SlateElement[];
  annotations?: ChapterAnnotation[];
  chapters: { file: string; number: number; name: string }[];
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
  revert(slug: string, options: RevertOptions): Promise<RevertResult>;
  setReview(slug: string, key: string, print: string, accepted: boolean): Promise<void>;
  history(slug: string): Promise<HistoryEvent[]>;
  restore(slug: string, eventId: string): Promise<void>;
  getChapterDraft(slug: string, file: string): Promise<ChapterDraftView>;
  saveChapterDraft(slug: string, file: string, input: ChapterSaveInput): Promise<{ revision: number }>;
  onLog(listener: (line: LogLine) => void): () => void;
}
