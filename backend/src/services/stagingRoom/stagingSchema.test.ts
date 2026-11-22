import mongoose, { Model, Types } from "mongoose";
import type { LocalChapterFile } from "../../../../shared/types/stagingRoom";
import { bookSchema as writingStudioBookSchema } from "../../models/books/schemas/bookSchema";
import type { LoadedBook } from "./bookFiles";
import { validateBook } from "./bookFiles";
import { bookPrint, chapterPrint, liveNames, localChapterContent, prodBookContent, prodChapterContent } from "./fullData";
import { bookModelFor, bookSchema } from "./rozaSchema";
import { validateProject } from "./sync";

const userId = "6a5e5e65ac5019850b04a505";
const para = (text: string, align?: "center") => ({ type: "paragraph", ...(align ? { align } : {}), children: [{ text }] });
const longQuote = "q".repeat(600);

const chapter: LocalChapterFile = {
  number: 1,
  name: "One",
  format: "prose",
  text: [para("Hello Ann."), para("* * *", "center")],
  planning: { characters: { Ann: "POV" } },
  annotations: [{ id: "n1", content: "note", quote: longQuote, anchor: null }],
  drafts: [
    {
      id: "d1",
      kind: "main-backup",
      summary: "Before the rewrite",
      chapterId: "x",
      name: "Main text backup",
      text: [para("Old text")],
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:00:00.000Z",
    },
  ],
  mainSourceDraftId: "d2",
};

const publishing = {
  title: "Ann and Allan",
  author: "",
  language: "en" as const,
  includeTitlePage: false,
  includeToc: true,
  chapterIds: [],
  cover: "",
  identifier: "urn:uuid:1",
};

function loadedBook(): LoadedBook {
  const book = {
    bookName: "Ann and Allan",
    userId,
    language: "en",
    characters: { Ann: "The lead." },
    publishing,
    audiobookNarrator: { engine: "kokoro" as const, voice: "af_heart", name: "Heart", lang: "en" },
  };
  const chapters = [{ file: "01.json", data: chapter }];
  return { slug: "ann", book, chapters, state: {}, errors: validateBook(book, chapters) };
}

describe("Staging Room uses the Writing Studio book schema", () => {
  it("is the Writing Studio schema itself", () => {
    expect(bookSchema).toBe(writingStudioBookSchema);
  });

  it("accepts every Writing Studio field, including long note quotes", async () => {
    expect(await validateProject(loadedBook())).toEqual([]);
  });

  it("keeps draft kind and summary, mainSourceDraftId and publishing flags when casting for Push", () => {
    const Book = bookModelFor(mongoose.connection) as Model<any>;
    const bookId = new Types.ObjectId();
    const doc = new Book({
      _id: bookId,
      userId: new Types.ObjectId(userId),
      name: "Ann and Allan",
      chapters: [{ ...chapter, planning: undefined, bookId }],
      publishing,
    });
    const cast = doc.toObject({ virtuals: false, transform: false } as never) as any;
    expect(cast.chapters[0].drafts[0]).toMatchObject({ kind: "main-backup", summary: "Before the rewrite" });
    expect(cast.chapters[0].mainSourceDraftId).toBe("d2");
    expect(cast.chapters[0].annotations[0].quote).toBe(longQuote);
    expect(cast.publishing.includeTitlePage).toBe(false);
  });
});

describe("Compare sees the new fields", () => {
  it("reads mainSourceDraftId and draft kind from the live chapter", () => {
    const live = { ...chapter, planning: {}, _id: new Types.ObjectId() };
    const content = prodChapterContent(live, liveNames(null));
    expect(content.mainSourceDraftId).toBe("d2");
    expect(content.drafts?.[0].kind).toBe("main-backup");
    expect(chapterPrint(localChapterContent({ ...chapter, planning: {} }))).toBe(chapterPrint(content));
    expect(chapterPrint(localChapterContent({ ...chapter, planning: {}, mainSourceDraftId: "other" }))).not.toBe(chapterPrint(content));
  });

  it("keeps includeTitlePage false, and treats a missing flag like true", () => {
    const live = prodBookContent({ name: "B", publishing: { ...publishing, _id: new Types.ObjectId() } });
    expect(live.publishing?.includeTitlePage).toBe(false);
    const withFlag = (includeTitlePage?: boolean) => {
      const p: Record<string, unknown> = { ...publishing };
      if (includeTitlePage === undefined) delete p.includeTitlePage;
      else p.includeTitlePage = includeTitlePage;
      return bookPrint({ name: "B", publishing: p as never });
    };
    expect(withFlag(false)).not.toBe(withFlag(undefined));
    expect(withFlag(true)).toBe(withFlag(undefined));
  });

  it("reads the narrator from the live book", () => {
    const narrator = { engine: "kokoro", voice: "af_heart", name: "Heart", lang: "en" };
    expect(prodBookContent({ name: "B", audiobookNarrator: { ...narrator, _id: new Types.ObjectId() } }).audiobookNarrator).toEqual(narrator);
  });
});
