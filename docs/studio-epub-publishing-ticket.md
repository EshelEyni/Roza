# Ticket #74: Publish Studio books as EPUBs

Design: `docs/studio-epub-publishing.md`

## Status
Implemented in the working tree. Not committed. Not yet checked in the running app.

## Objective
Let the user turn a Writing Studio book into an EPUB and read it in the Reading Room like any uploaded book.

## Decisions
- Publishing is a **Publish EPUB** item in the Studio "•••" menu that opens a dialog. There is no separate Publishing Desk page. The owner rejected that design.
- **Archive book** moves from the library card into the same menu, below Options.
- After a save, the library card shows the EPUB cover and a **Read EPUB** link.
- Saving again updates the same Reading Room book, so its reading state and notes stay attached.
- Publish EPUB uses the Reading Room access check. Users without reader access do not see it.

## Requirements

### Backend
- [x] `studioEpubService.ts` builds an EPUB 3 file with adm-zip: `mimetype` first and uncompressed, `container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, optional cover and title pages, one `chapter-<id>.xhtml` per chapter, `book.css`.
- [x] Slate → XHTML: paragraphs, headings, quotes, lists, alignment, bold/italic/underline, scene breaks, screenplay blocks. All text XML-escaped. Stable block ids `b-<index>`.
- [x] `lang` and `dir` on every page. Hebrew books set `page-progression-direction="rtl"`.
- [x] Main chapter text only. Archived chapters and Studio-only data stay out.
- [x] Every build passes `parseEpub` before it is stored or returned.
- [x] Shared types imported with `import type` only (AGENTS.md).
- [x] `publishing` subdocument on the Studio book, saved with `timestamps: false`.
- [x] `POST /api/reader/studio/:bookId/epub` returns the file and stores nothing.
- [x] `PUT /api/reader/studio/:bookId/publication` creates the library book, or replaces the files of the existing one and removes unused old files.
- [x] Both routes are behind `checkReaderAccess` and load only the user's own book.
- [x] Covers: PNG or JPEG data URL, at most 2 MiB, checked by file signature.
- [x] The request sanitizer skips the two endpoints, because the builder escapes text itself.

### Frontend
- [x] **Publish EPUB** and **Archive book** in the Studio menu.
- [x] `PublishDialog.tsx`: status line, title, author, language (`ReaderSelect`), cover upload with preview, chapter checklist with word counts, title page and contents options, Download .epub, Save/Update EPUB, Open in Reading Room.
- [x] The dialog saves pending edits before building, and stops if they cannot be saved.
- [x] `publishing` is kept out of the draft store and out of autosave requests.
- [x] Library card: cover image, Read EPUB link, no Archive button.

## Acceptance criteria
1. Publish EPUB appears in the Studio menu only with reader access. — not yet checked in the app
2. Save EPUB adds the book to the Reading Room, and it opens with correct chapters and formatting. — not yet checked in the app
3. A Hebrew book reads right to left. — package covered by tests; reading not yet checked
4. Text with `<`, `&` or quotes shows as plain text. — covered by tests
5. After a Studio edit, the dialog says the manuscript changed. Update EPUB keeps the same library book. — not yet checked in the app
6. Download .epub returns a valid file and stores nothing. — not yet checked in the app
7. After a save, the library card shows the cover and a Read EPUB link. — not yet checked in the app
8. Archive book in the Studio menu archives the book and returns to the library. — covered by the browser test
9. Another user's book cannot be built or published. — enforced by the user filter; no dedicated test

## Tests
- [x] `backend/src/services/reader/studioEpubService.test.ts` (9 tests) passes.
- [x] `scripts/studio-epub-runtime.test.cjs` passes.
- [x] `scripts/writing-studio.browser.test.cjs` with `STUDIO_LIBRARY_ONLY=1` passes, including archiving from the menu.
- [ ] Full `writing-studio.browser.test.cjs` fails at the old "More" menu step inside `.ws-writing`. That step was already broken by fba1d7f.
- [ ] Manual check with a Hebrew and an English book.

## Out of scope / follow-ups
- Re-anchoring annotations after an update, and marking changed ones "detached".
- Clearing the Read EPUB link when the library copy is deleted.
- Choosing a draft per chapter.
- A generated cover when none is uploaded.
- Front and back matter from Studio notes.
- Do not deploy to production as part of this ticket.
