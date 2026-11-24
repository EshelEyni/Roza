// Browser-test mock of a Writing Studio save. A save sends only the changes
// (PATCH /api/book/:id/changes); this replays them like the server does.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../../frontend/node_modules/typescript");

const file = path.join(__dirname, "../../frontend/src/components/WritingStudio/bookChanges.ts");
const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const bookChanges = { exports: {} };
new Function("module", "exports", "require", outputText)(bookChanges, bookChanges.exports, require);

/** The book after a save request. Accepts the changes body or, for old callers, a whole book. */
function applySave(saved, incoming) {
  return Array.isArray(incoming.changes)
    ? bookChanges.exports.applyBookChanges(saved, incoming.changes)
    : incoming;
}

/** Mock of GET /api/book/manuscripts, the library page. */
function manuscriptsPage(books) {
  const manuscripts = books.filter(book => !book.isArchived).map(book => {
    const chapters = (book.chapters || []).filter(chapter => !chapter.isArchived);
    return { id: book.id, name: book.name, updatedAt: book.updatedAt, chapterCount: chapters.length,
      wordCount: 0, wordGoal: book.wordGoal, cover: book.publishing?.cover, readerBookId: book.publishing?.readerBookId };
  });
  const writing = manuscripts.filter(book => book.chapterCount > 0).length;
  return { manuscripts, total: manuscripts.length, nextOffset: null,
    counts: { all: manuscripts.length, writing, blank: manuscripts.length - writing, epub: 0 } };
}

module.exports = { applySave, manuscriptsPage };
