import fs from "fs";
import path from "path";
import type { BookListPrefs } from "../../../shared/types/stagingRoom";
import { booksDir } from "./bookFiles";

// Sidebar order / hidden books, kept next to the books themselves.
// A plain file (not a folder) so listSlugs never mistakes it for a book.
const prefsFile = (root: string) => path.join(booksDir(root), "_list.json");

export function readListPrefs(root: string): BookListPrefs {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsFile(root), "utf8")) as Partial<BookListPrefs>;
    return {
      order: Array.isArray(raw.order) ? raw.order.filter((s) => typeof s === "string") : [],
      hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((s) => typeof s === "string") : [],
      showHidden: !!raw.showHidden,
    };
  } catch {
    return { order: [], hidden: [], showHidden: false };
  }
}

export function writeListPrefs(root: string, prefs: BookListPrefs): BookListPrefs {
  const clean: BookListPrefs = {
    order: [...new Set(prefs.order.map(String))],
    hidden: [...new Set(prefs.hidden.map(String))],
    showHidden: !!prefs.showHidden,
  };
  fs.mkdirSync(booksDir(root), { recursive: true });
  fs.writeFileSync(prefsFile(root), JSON.stringify(clean, null, 2) + "\n", "utf8");
  return clean;
}

/** Saved order first, then any new books alphabetically at the end. */
export function applyOrder<T extends { slug: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((s, i) => [s, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.slug) ?? Infinity;
    const rb = rank.get(b.slug) ?? Infinity;
    return ra !== rb ? ra - rb : a.slug.localeCompare(b.slug);
  });
}
