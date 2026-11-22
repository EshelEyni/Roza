# Studio to EPUB publishing

Status: Implemented, not committed, not yet checked in the running app
Date: 2026-11-21
Ticket: #74
Scope: Writing Studio books → Reading Room

## 1. Goal

Turn a Writing Studio book into an EPUB and read it in the Reading Room like any uploaded book. Progress, annotations, chat, dictionary and the audiobook all work on it.

There is no separate page. Publishing is a dialog opened from the Studio "•••" menu. An earlier draft planned a top-level Publishing Desk page. The owner rejected it in favour of the menu.

## 2. User flow

1. In the Studio, open the "•••" menu. Under STUDIO, choose **Publish EPUB**.
2. Check the title, author and language. Optionally add a cover image.
3. Tick the chapters to include. Studio order is the reading order.
4. Choose whether to include a title page and a table of contents.
5. Press **Save EPUB**. The Studio saves pending edits, builds the EPUB, and adds it to the Reading Room.
6. Back in the Studio library, the book's card shows the cover and a **Read EPUB** link.
7. After more writing, open the dialog again. It says the manuscript changed since the last save. Press **Update EPUB** to replace the text of the same library book.

**Download .epub** builds the file without saving anything. **Open in Reading Room** opens the published book.

## 3. Studio menu

The STUDIO section of the "•••" menu now holds, in order:

- Toggle full screen
- **Publish EPUB** — shown only when the account has Reading Room access
- Options
- **Archive book** — moved here from the library card

Archive book asks for confirmation, saves pending edits, archives the book with a `PATCH { isArchived: true }`, and returns to the library.

## 4. The Publish EPUB dialog

File: `frontend/src/components/WritingStudio/PublishDialog.tsx`

| Part | Behaviour |
| --- | --- |
| Status line | "Not published yet", or "Saved <date> · up to date", or "· the manuscript changed since" |
| Title | Defaults to the book name |
| Author | Defaults to the profile's full name |
| Language | `ReaderSelect`: Hebrew (right to left) or English (left to right). First guess comes from the share of Hebrew letters. |
| Cover | Optional PNG, JPEG or WebP. Scaled to at most 1200×1800 and stored as JPEG under about 1.9 MiB. |
| Chapters | Checklist with word counts and a screenplay tag. Empty chapters start unticked. On reopening, the last choice is kept and chapters created since the last save are ticked. |
| Include | Title page, table of contents |
| Actions | Open in Reading Room (after the first save), Download .epub, Save EPUB / Update EPUB |

Before building, the dialog flushes the draft store. If the manuscript cannot be saved, it stops and says so. The server always builds from the saved manuscript.

## 5. Library card

File: `frontend/src/pages/Books/BooksPage.tsx`

- When `book.publishing.cover` is set, the cover shows on the inline-end side of the card.
- When `book.publishing.readerBookId` is set, a **Read EPUB** link opens `/reader/<id>`.
- The Archive button was removed from the card.

## 6. What goes into the EPUB

### 6.1 Text

Each included chapter uses its main text (`chapter.text`). Studio-only data stays out: annotations, drafts, planning, task boards, characters, themes, plotlines and notes. The model's find hooks already drop archived chapters.

### 6.2 Slate to XHTML

| Slate element | XHTML |
| --- | --- |
| `paragraph` | `<p>`. Empty paragraphs are skipped. |
| `heading-one` / `heading-two` | `<h2>` / `<h3>`. The chapter title is the `<h1>`. |
| `block-quote` | `<blockquote><p>…</p></blockquote>` |
| `bulleted-list` / `numbered-list` | `<ul>` / `<ol>` with `<li>` |
| `align` | `class="align-center"` and so on |
| `bold` / `italic` / `underline` | `<strong>` / `<em>` / `<span class="u">` |
| A paragraph that is only `***`, `* * *`, `~~~` or `#` | `<hr class="scene-break"/>`, drawn as `* * *` |
| Screenplay blocks | `<p class="sp sp-<type>">` with screenplay CSS |

All text is XML-escaped. Each block gets an id `b-<index>`. Each chapter is one file, `chapter-<chapterId>.xhtml`. Stable names keep most reader positions valid after edits inside a chapter.

### 6.3 Package

EPUB 3 with an EPUB 2 `toc.ncx`:

- `mimetype`, first and uncompressed (adm-zip with `noSort`)
- `META-INF/container.xml`
- `OEBPS/content.opf`: title, creator, language, `dcterms:modified`, a `urn:uuid` identifier that stays the same across updates, and the cover
- `OEBPS/nav.xhtml` (hidden when the table of contents is off) and `OEBPS/toc.ncx`
- `OEBPS/cover.xhtml` and `OEBPS/images/cover.jpg|png` when there is a cover
- `OEBPS/title.xhtml` when the title page is on
- One `OEBPS/chapter-<id>.xhtml` per chapter
- `OEBPS/styles/book.css`

Every `<html>` carries `lang` and `dir`. Hebrew books set `page-progression-direction="rtl"` on the spine.

## 7. Backend

### 7.1 Files

- `backend/src/services/reader/studioEpubService.ts` — request validation, cover check, Slate rendering, EPUB build. Imports shared types with `import type` only.
- `backend/src/controllers/reader/studioPublicationController.ts` — the two endpoints below.
- `backend/src/models/books/schemas/bookSchema.ts` — the `publishing` subdocument.
- `backend/src/middlewares/HTMLSanitizer/HTMLSanitizerMiddleware.ts` — skips the two endpoints. The builder escapes text itself, and HTML escaping would turn `&` into `&amp;` in titles.

### 7.2 API

Both routes sit under the reader router, after the Reader, Writing Studio, and Studio Publishing feature gates. Both load the Studio book by id and the logged-in user.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/reader/studio/:bookId/epub` | Build and return the EPUB file. Stores nothing. |
| PUT | `/api/reader/studio/:bookId/publication` | Build, store and add to the Reading Room. Returns the new `publishing` record. |

The request body is `BookPublishingRequest`: title, author, language, includeTitlePage, includeToc, chapterIds and cover (a data URL or an empty string). The server keeps only chapter ids that exist, in Studio order.

### 7.3 Saving

1. Build the EPUB and run it through `parseEpub`, the same check uploads use.
2. Save the original and the sanitized file to GridFS.
3. If `publishing.readerBookId` points to an existing library book of this user, replace its files, title, author and cover, and remove the old files when nothing else uses them. Reading state, annotations, flags, chats and vocabulary stay attached.
4. Otherwise create a new library book, with reader preferences copied from the user's latest book.
5. Save `publishing` on the Studio book with `timestamps: false`, like the narrator settings, so it does not clash with the manuscript's autosave version check.

The title and author saved on the library book are the ones from the dialog. `parseEpub` keeps XML entities in titles, so its parsed title would show `&amp;`.

### 7.4 Data model

```ts
// shared/types/books.ts
interface Book {
  publishing?: BookPublishing;
}
interface BookPublishing extends BookPublishingOptions {
  cover: string;            // data URL or ""
  identifier: string;       // urn:uuid, constant across updates
  readerBookId?: string;
  publishedAt?: string;
  sourceUpdatedAt?: string; // manuscript updatedAt at build time
}
```

The frontend keeps `publishing` out of the Studio draft store. The store copies the manuscript into browser storage on every edit, and a cover is large. `bookApi.update` also strips `publishing`, so autosave never sends the cover.

## 8. Tests

- `backend/src/services/reader/studioEpubService.test.ts` — 9 tests: escaping, marks, lists, scene breaks, screenplay blocks, language guess, request validation, cover checks, `mimetype` first, RTL spine, chosen chapters only, hidden contents page, and passing `parseEpub`.
- `scripts/studio-epub-runtime.test.cjs` — loads the service, controller and reader router with the ts-node dev runner. Ticket #23 showed that type checks and Jest alone miss module-loading crashes.
- `scripts/writing-studio.browser.test.cjs` — the library-only run now archives from the Studio menu and checks the card has no Archive button. It passes.

Known failure, not caused by this work: the full Studio browser test stops at a step that looks for a "More" menu inside `.ws-writing`. The header change in fba1d7f removed that menu.

## 9. Known gaps

- Not yet checked in the running app.
- Annotations are not re-anchored after an update, and changed ones are not marked "detached". Edits inside chapters keep most positions. Reordering chapters can move the saved place.
- If the library copy is deleted in the Reading Room, the card's Read EPUB link still points to it. Saving again from the dialog creates a new copy.
- No per-chapter draft choice. The main text is always used.
- No generated cover. Without an uploaded image, the card stays as before.

## 10. Possible next steps

1. Check the flow in the running app with a Hebrew and an English book.
2. Re-anchor annotations by their saved quote after an update, and mark the rest "detached".
3. Clear `publishing.readerBookId` when its library book is deleted.
4. Let each chapter use a named draft instead of the main text.
