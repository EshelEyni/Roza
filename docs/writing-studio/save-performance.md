# Writing Studio save performance

Date: 2026-11-24.

## The problem

A save in the Writing Studio took about 8 seconds for "Ann and Allan".
Every save sent the whole book: about 1.15 MB of JSON, even for one new task.
The server then sent the whole book back.

## Where the time went (old full-book save)

Measured on a synthetic book with the same shape: 30 chapters, about 3,200
paragraphs, 1.0 MB of JSON. The real book is larger, so its numbers are higher.
Database: the same Atlas cluster as production.

| Step | Time |
| --- | --- |
| Upload 0.9 MB to production (from a fast line; 401 probe, no data) | ~0.25 s |
| JSON parse | 2 ms |
| express-mongo-sanitize | 4 ms |
| sanitize-html on all ~10,700 strings | 35–60 ms |
| Read the whole book (raw driver) | 100–160 ms |
| `validatePlanning` | <1 ms |
| `findOneAndUpdate` with `runValidators: true`, `new: true` | **3.0–3.9 s** |
| …the same write without update validators | ~0.5 s |
| …the same write through the raw driver | ~0.19 s |
| Serialize the whole book for the response | 13–18 ms |
| Response size | ~1 MB before gzip |

The main cost is Mongoose **update validators** on `$set` of whole arrays of
subdocuments. They take about 3.3 s of the 3.75 s write.

The cost grows faster than the book. Validators alone, measured without a database:

| Chapters | Paragraphs | Validators |
| --- | --- | --- |
| 5 | 495 | 0.16 s |
| 10 | 990 | 0.36 s |
| 20 | 1,980 | 1.1 s |
| 40 | 3,960 | 3.9 s |

Doubling the book makes this step about 3.5× slower. At 120k words a save
would take far more than the 20-second client timeout. Saves would start to fail.

The rest of the 8 s is upload time on slower connections, download of the
returned book, and a larger real book (more, shorter paragraphs).

## Other answers

- **Response:** the old save returned the whole book (~1 MB before gzip).
- **Compression:** responses are gzipped (`compression()`). Requests are not.
  The browser cannot gzip a request body without extra code.
- **Body limit:** `express.json({ limit: "5000kb" })`. The old save would hit it
  at about 4–5× the current size.
- **Paragraph ids:** every Slate paragraph had a Mongo `_id`. That is about
  33 bytes per paragraph, ~10% of the text. Nothing reads them.
- **What triggers a save:** every `store.edit` in the Writing Studio. That covers
  chapter text, drafts, notes, characters, themes, plotlines, tasks, planning
  links, annotations, the book name and the word goal.
- **Debounce and overlap:** `DraftStore` waits 1.5 s after the last edit. It runs
  one save at a time. Saves never overlap. Edits made during a save go into the
  next one.
- **Local recovery draft:** each edit writes the whole book to `localStorage`.
  That is a synchronous `JSON.stringify` of the whole book on every keystroke.
  `localStorage` holds about 5 MB (UTF-16), so a 2.5 MB book will no longer fit.
  This is part of the offline work in ticket #62.
- **16 MB limit:** the book document is about 1 MB in BSON now. At 120k words,
  with drafts, it may reach 4–5 MB. That is still under 16 MB. But drafts grow
  without limit: every "Main backup" copies a whole chapter. Moving drafts to
  their own collection is the safe long-term step.
- **Sanitizer bug (not fixed here):** `requestSanitizer` runs sanitize-html on
  manuscript text. It stores `&` as `&amp;` and `<` as `&lt;`. The studio then
  shows `&amp;` after a reload. The new save path keeps this behavior unchanged.

## The new save

`PATCH /api/book/:id/changes` with `{ updatedAt, changes }`.

The browser keeps the last version the server confirmed. Each save sends only
the changes since that version (`diffBook` in
`frontend/src/components/WritingStudio/bookChanges.ts`). Change types:

- `book`: set name, filterBy, isReadMode, wordGoal or the task board.
- `item`: create a chapter, character, theme, plotline or note, or set some of its fields.
- `order`: the new order of a collection. Unlisted archived items stay.
- `draft`: create a chapter draft, or set some of its fields.
- `draftOrder`: the new order of a chapter's drafts. Unlisted drafts are removed.

Paragraph ids are not sent, and the schema no longer adds them.

The server (`backend/src/controllers/book/bookChangesController.ts`):

1. Reads a small index of the book: ids, names, planning links, task boards and
   draft names. It never reads chapter text.
2. Checks updatedAt (409 if the book changed).
3. Validates each change with the book schema, on the changed item only.
4. Checks links (`validatePlanning`) against the index.
5. Writes all changes in one atomic pipeline update, guarded by updatedAt.
6. Returns only `{ id, updatedAt, wordGoal }`.

Every change is idempotent. A retry after a lost response gets a 409, as before.

### Results (same synthetic book, same Atlas cluster)

| Save | Request | Server time |
| --- | --- | --- |
| Rename a note | 151 B | ~160 ms |
| Add a task | 8 KB (whole task board) | ~170 ms |
| Edit chapter Main text | 10 KB (that chapter's text) | ~165 ms |
| Edit a draft | 6 KB (that draft's text) | ~165 ms |
| Move a chapter | 0.9 KB | ~160 ms |
| Old full-book save | 1,000 KB | ~3,100 ms |

The server time is two Atlas round trips (~75 ms each). It does not grow with
the book size.

## Server-Timing

All `/api/book` responses from the save routes now carry a `Server-Timing`
header: `pre` (upload, parse and sanitizers), `read`, `validate`, `write`,
`json`, `total`. Browser dev tools show it under Network > Timing. The server
logs a warning for saves over 1 s.

## Tests

- `node --test scripts/book-changes.test.cjs`: the browser diff. No database needed.
- `node --test scripts/book-changes.integration.test.cjs`: the endpoint against
  MongoDB. It uses `BOOK_TEST_MONGO_URI` when set, or mongodb-memory-server.
  It creates and drops its own short-named database (Atlas allows 38 bytes).

## Follow-ups

- Move drafts (and maybe chapter text) to their own collection before the book
  nears the 16 MB limit.
- Stop sanitize-html from escaping manuscript text (the `&amp;` bug).
- Ticket #62: queue `BookChange` lists offline and replay them with
  `applyBookChanges`. Replace the whole-book `localStorage` draft with that queue.
- The old full-book `PATCH /api/book/:id` still works (it archives books and
  serves old desktop builds). It still runs update validators.
