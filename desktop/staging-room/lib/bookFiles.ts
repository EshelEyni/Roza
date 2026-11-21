import fs from "fs";
import path from "path";
import type {
  BookDetail,
  BookSummary,
  ChapterPreview,
  EntityKind,
  EntitySummary,
  LocalBookFile,
  LocalChapterFile,
  PublishState,
} from "../../../shared/types/stagingRoom";
import { asSlate } from "./fullData";
import { checkSlate, countWords, elementText, plainParagraphs } from "./slate";

export interface LoadedChapter {
  file: string;
  data: LocalChapterFile;
  /** last time the chapter file changed on disk */
  mtimeMs?: number;
}

export interface LoadedBook {
  slug: string;
  dir: string;
  book: LocalBookFile;
  chapters: LoadedChapter[];
  state: PublishState;
  errors: string[];
  /** last time book.json changed on disk */
  bookMtimeMs?: number;
}

export const booksDir = (root: string) => path.join(root, "books");

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

export function listSlugs(root: string): string[] {
  const dir = booksDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "book.json")))
    .map((d) => d.name)
    .sort();
}

function safeSlug(root: string, slug: string): string {
  const dir = path.resolve(booksDir(root), slug);
  if (path.dirname(dir) !== path.resolve(booksDir(root))) throw new Error(`Invalid book: ${slug}`);
  return dir;
}

export function loadBook(root: string, slug: string): LoadedBook {
  const dir = safeSlug(root, slug);
  const book = readJson<LocalBookFile>(path.join(dir, "book.json"));
  const errors: string[] = [];
  const chaptersDir = path.join(dir, "chapters");
  const chapters: LoadedChapter[] = [];
  if (fs.existsSync(chaptersDir)) {
    for (const file of fs.readdirSync(chaptersDir).filter((f) => f.endsWith(".json"))) {
      try {
        const full = path.join(chaptersDir, file);
        chapters.push({ file, data: readJson<LocalChapterFile>(full), mtimeMs: fs.statSync(full).mtimeMs });
      } catch (e) {
        errors.push(`${file}: not valid JSON (${(e as Error).message})`);
      }
    }
  }
  chapters.sort((a, b) => (a.data.number ?? 0) - (b.data.number ?? 0) || a.file.localeCompare(b.file));
  const statePath = path.join(dir, ".publish-state.json");
  const state = fs.existsSync(statePath) ? readJson<PublishState>(statePath) : {};
  errors.push(...validateBook(book, chapters));
  const bookMtimeMs = fs.statSync(path.join(dir, "book.json")).mtimeMs;
  return { slug, dir, book, chapters, state, errors, bookMtimeMs };
}

export function saveState(loaded: LoadedBook, state: PublishState) {
  fs.writeFileSync(path.join(loaded.dir, ".publish-state.json"), JSON.stringify(state, null, 2) + "\n");
}

export function writeBackup(loaded: LoadedBook, prodDoc: unknown): string {
  const dir = path.join(loaded.dir, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `prod-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(prodDoc, null, 2));
  return file;
}

const HEX = /^#[0-9a-f]{6}$/i;
const objectId = /^[a-f0-9]{24}$/i;

/** Local checks that run without a database. */
export function validateBook(book: LocalBookFile, chapters: LoadedChapter[]): string[] {
  const errors: string[] = [];
  if (!book.bookName?.trim()) errors.push("book.json: bookName is missing");
  if (!objectId.test(book.userId || "")) errors.push("book.json: userId must be a 24-character Mongo id");
  for (const kind of ["themes", "plotlines"] as const)
    for (const [name, value] of Object.entries(book[kind] || {})) {
      if (!Array.isArray(value) || !HEX.test(value[0] || ""))
        errors.push(`book.json: ${kind} "${name}" needs ["#rrggbb", "description"]`);
      else errors.push(...checkRich(value[1], `book.json: ${kind} "${name}"`));
    }
  for (const kind of ["characters", "notes"] as const)
    for (const [name, value] of Object.entries(book[kind] || {}))
      errors.push(...checkRich(value, `book.json: ${kind} "${name}"`));
  if (book.wordGoal != null && (!Number.isInteger(book.wordGoal) || book.wordGoal < 1 || book.wordGoal > 10_000_000))
    errors.push("book.json: wordGoal must be a whole number from 1 to 10,000,000 (or null to remove it)");
  if (book.taskBoard !== undefined && !Array.isArray(book.taskBoard?.lists))
    errors.push('book.json: taskBoard must look like { "lists": [...] }');

  if (book.replaceText !== undefined && (!Array.isArray(book.replaceText) ||
      book.replaceText.some((p) => !Array.isArray(p) || p.length !== 2 || typeof p[0] !== "string" || !p[0] || typeof p[1] !== "string")))
    errors.push('book.json: replaceText must look like [["old", "new"], ...]');
  if (book.archiveInProd !== undefined && (!Array.isArray(book.archiveInProd) || book.archiveInProd.some((n) => typeof n !== "string")))
    errors.push('book.json: archiveInProd must be a list of chapter names');
  if (book.syncChapterOrder !== undefined && typeof book.syncChapterOrder !== "boolean")
    errors.push("book.json: syncChapterOrder must be true or false");
  for (const { file, data } of chapters)
    if ((book.archiveInProd || []).includes(data.name))
      errors.push(`chapters/${file}: "${data.name}" is also listed in archiveInProd`);

  const names = new Set<string>();
  const numbers = new Set<number>();
  for (const { file, data } of chapters) {
    const where = `chapters/${file}`;
    if (!data.name?.trim()) errors.push(`${where}: name is missing`);
    else if (names.has(data.name)) errors.push(`${where}: duplicate chapter name "${data.name}"`);
    names.add(data.name);
    if (!Number.isInteger(data.number)) errors.push(`${where}: number must be an integer`);
    else if (numbers.has(data.number)) errors.push(`${where}: duplicate chapter number ${data.number}`);
    numbers.add(data.number);
    errors.push(...checkSlate(data.text, `${where} text`));
    if (data.description) errors.push(...checkSlate(data.description, `${where} description`));
    if (data.format !== undefined && data.format !== "prose" && data.format !== "screenplay")
      errors.push(`${where}: format must be "prose" or "screenplay"`);
    for (const field of ["annotations", "drafts"] as const)
      if (data[field] !== undefined && !Array.isArray(data[field])) errors.push(`${where}: ${field} must be a list`);
    const noteIds = new Set<string>();
    for (const a of Array.isArray(data.annotations) ? data.annotations : []) {
      if (!a || typeof a.id !== "string" || !a.id) errors.push(`${where}: every note needs an id`);
      else if (noteIds.has(a.id)) errors.push(`${where}: duplicate note id "${a.id}"`);
      else noteIds.add(a.id);
    }
    if (data.taskBoard !== undefined && !Array.isArray(data.taskBoard?.lists))
      errors.push(`${where}: taskBoard must look like { "lists": [...] }`);
    for (const kind of ["characters", "themes", "plotlines"] as const)
      for (const name of Object.keys(data.planning?.[kind] || {}))
        if (!(name in (book[kind] || {})))
          errors.push(`${where}: planning ${kind} "${name}" is not defined in book.json`);
  }
  return errors;
}

const checkRich = (value: unknown, where: string) =>
  typeof value === "string" ? [] : Array.isArray(value) ? checkSlate(value, where) : [`${where}: must be text or Slate paragraphs`];

const richText = (v: unknown) => plainParagraphs(asSlate(v as string)).join("\n");

const entityList = (record: Record<string, unknown> | undefined, colored: boolean): EntitySummary[] =>
  Object.entries(record || {}).map(([name, v]) =>
    colored && Array.isArray(v) ? { name, color: v[0] as string, text: richText(v[1]) } : { name, text: richText(v) },
  );

export function summarize(loaded: LoadedBook): BookSummary {
  const { book, chapters, state } = loaded;
  return {
    slug: loaded.slug,
    bookName: book.bookName,
    language: book.language || "en",
    userId: book.userId,
    chapterCount: chapters.length,
    words: chapters.reduce((sum, c) => sum + countWords(c.data.text), 0),
    errors: loaded.errors,
    prodBookId: state.prodBookId,
    lastUploadAt: state.lastUploadAt,
  };
}

export function detail(loaded: LoadedBook): BookDetail {
  const { book } = loaded;
  return {
    ...summarize(loaded),
    chapters: loaded.chapters.map(({ file, data }) => ({
      file,
      number: data.number,
      name: data.name,
      words: countWords(data.text),
      paragraphs: (data.text || []).length,
      notes: (data.annotations || []).length,
      drafts: (data.drafts || []).length,
      errors: loaded.errors.filter((e) => e.startsWith(`chapters/${file}`)),
    })),
    characters: entityList(book.characters, false),
    themes: entityList(book.themes, true),
    plotlines: entityList(book.plotlines, true),
    notes: entityList(book.notes, false),
  };
}

export function chapterPreview(loaded: LoadedBook, file: string): ChapterPreview {
  const chapter = loaded.chapters.find((c) => c.file === file);
  if (!chapter) throw new Error(`Chapter not found: ${file}`);
  const { data } = chapter;
  const planning = (["characters", "themes", "plotlines"] as EntityKind[]).flatMap((kind) =>
    Object.entries(data.planning?.[kind as "characters"] || {}).map(([name, note]) => ({ kind, name, note })),
  );
  return {
    file,
    name: data.name,
    description: plainParagraphs(data.description),
    paragraphs: (data.text || []).map((el) => ({ text: elementText(el), align: el.align })),
    planning,
    notes: (data.annotations || []).map((a) => ({
      general: !!a.general,
      quote: a.quote || "",
      content: a.content || "",
      attached: !!a.anchor,
    })),
  };
}
