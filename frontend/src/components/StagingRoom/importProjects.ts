import type { LocalBookFile, LocalChapterFile, PublishState } from "../../../../shared/types/stagingRoom";
import { api, errorText } from "./api";

async function json<T>(file: File): Promise<T> {
  return JSON.parse((await file.text()).replace(/^\uFEFF/, "")) as T;
}

export async function importProjects(files: File[]) {
  const byPath = new Map(files.map(file => [file.webkitRelativePath, file]));
  const books = files.filter(file => file.name === "book.json" &&
    !file.webkitRelativePath.split("/").some(part => part === "local-backups" || part === "backups"));
  if (!books.length) throw new Error("Select the books folder or a project folder containing book.json.");
  let created = 0;
  let existing = 0;
  const failures: string[] = [];
  for (const file of books) {
    const prefix = file.webkitRelativePath.slice(0, -"book.json".length);
    const slug = prefix.slice(0, -1).split("/").pop() ?? "";
    try {
      const chapterPrefix = prefix + "chapters/";
      const chapterFiles = files.filter(chapter => chapter.webkitRelativePath.startsWith(chapterPrefix) &&
        !chapter.webkitRelativePath.slice(chapterPrefix.length).includes("/") && chapter.name.endsWith(".json"));
      const state = byPath.get(prefix + ".publish-state.json");
      const result = await api.importProject({
        slug,
        book: await json<LocalBookFile>(file),
        chapters: await Promise.all(chapterFiles.map(async chapter => ({
          file: chapter.name, data: await json<LocalChapterFile>(chapter), mtimeMs: chapter.lastModified,
        }))),
        bookMtimeMs: file.lastModified,
        state: state ? await json<PublishState>(state) : undefined,
      });
      if (result.created) created++;
      else existing++;
    } catch (error) {
      failures.push(slug + " — " + errorText(error));
    }
  }
  return { created, existing, failures };
}
