import { booksDir, chapterPreview, detail, listSlugs, loadBook, summarize } from "./lib/bookFiles";
import { connectionInfo } from "./lib/config";
import { applyOrder, readListPrefs, writeListPrefs } from "./lib/listPrefs";
import { prodStatus, testConnection, upload, validateLocal } from "./lib/sync";
import type { Logger } from "./lib/sync";
import { pull } from "./lib/pull";
import type { BookListPrefs, PullOptions, UploadOptions } from "../../shared/types/stagingRoom";

export function stagingRoomHandlers(root: string, openPath: (path: string) => Promise<string>) {
  let syncing = false;

  function requireBook(slug: string) {
    if (typeof slug !== "string" || !listSlugs(root).includes(slug)) {
      throw new Error("Staging Room project could not be found.");
    }
  }

  async function sync<T>(slug: string, action: () => Promise<T>): Promise<T> {
    requireBook(slug);
    if (syncing) throw new Error("A Staging Room sync is already in progress.");
    syncing = true;
    try {
      return await action();
    } finally {
      syncing = false;
    }
  }

  return {
    "books:list": () =>
      applyOrder(listSlugs(root).map(slug => summarize(loadBook(root, slug))), readListPrefs(root).order),
    "books:prefs:get": () => readListPrefs(root),
    "books:prefs:set": (_log: Logger, prefs: BookListPrefs) => writeListPrefs(root, prefs),
    "books:get": async (_log: Logger, slug: string) => {
      requireBook(slug);
      const book = detail(loadBook(root, slug));
      if (!book.errors.length) book.errors = await validateLocal(root, slug);
      return book;
    },
    "books:chapter": (_log: Logger, slug: string, file: string) => {
      requireBook(slug);
      return chapterPreview(loadBook(root, slug), file);
    },
    "db:info": () => connectionInfo(root),
    "db:test": async (log: Logger) => {
      log("info", "Testing the database connection…");
      const result = await testConnection(root);
      log(result.ok ? "ok" : "error", result.message);
    },
    "prod:status": (log: Logger, slug: string) => {
      requireBook(slug);
      log("info", `Checking prod for "${slug}"…`);
      return prodStatus(root, slug);
    },
    "prod:upload": (log: Logger, slug: string, options: UploadOptions) =>
      sync(slug, () => upload(root, slug, options, log)),
    "prod:pull": (log: Logger, slug: string, options: PullOptions) =>
      sync(slug, async () => {
        const result = await pull(root, slug, options, log);
        log("ok", `Pulled ${result.chapters} chapter(s) and ${result.entities} story element(s).`);
        return result;
      }),
    "shell:openBooks": async () => {
      const error = await openPath(booksDir(root));
      if (error) throw new Error(error);
    },
  };
}
