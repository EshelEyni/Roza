# Chapter planning (Ticket 8)

Branch: `feature/chapter-planning`, based on verified `origin/main` commit `04f07d4342fac11188b8b5af3ba348ef7fe1897e`.

## Connected workspaces

In Chapters, the Chapter Bible button immediately after More switches the manuscript page to a chapter workspace with Characters, Themes, Plotlines, Tasks and Summary navigation. Press it again, or choose Read/Summary/Annotations, to return to writing. Chapter Preview retains its collapsible Chapter Planning inspector. Both views edit the same shared records. A muted chapter number and name sit above the Chapter Bible heading, the page matches manuscript editor width, and save state is shown only in the app header. Summary editing preserves rich text; character and plotline contribution notes are plain text stored on the chapter association.

The Characters tab presents searchable cards; Themes and Plotlines use searchable rows. Header actions create new shared entries, and opening a card/row exposes its shared description and separate chapter contribution. Link existing opens a searchable checkbox modal; checking an entry links it immediately. Trash icons and unchecking linked entries open a confirmation explaining that removal only affects the chapter association and preserves the shared entry. The explanation is shown in the confirmation rather than beneath the tab. Summary retains its rich-text editor.

The Tasks tab embeds the existing Trello-style board, scoped to this chapter. It supports card creation, editing, completion/reopening, deletion, drag between columns, and linking existing book tasks. Chapter and book task boards share list creation, renaming, sorting and deletion controls. Lists and their tasks are shared; chapter deletion confirmations identify that scope, including tasks outside the chapter. Tasks are existing book task-board cards, extended with optional `chapterId` and `completed`. The chapter board and preview inspector edit these same cards; Open in book board opens the original card and list. The board supports chapter assignment/removal and a chapter filter. Completion is explicit, independent of editable board list names.

Characters, themes and plotlines reuse the existing book libraries. The separate book-wide Story Bible UI has been removed. Shared entities remain accessible through the existing Characters, Themes and Plotlines category editors. Chapter Bible references open those existing editors. Backend fields for role/general notes and optional colors remain preserved. Chapters link to entity IDs, with separate contribution notes for plotlines and characters. Theme tags and compact counts appear on overview cards; filters cover all three libraries and unfinished tasks. Reordering is disabled while filtering to avoid ambiguous moves, while chapter editing remains available.

## Database migration and API

This is an additive, backward-compatible Mongoose schema migration. No bulk rewrite or production database command is required or performed. Existing manuscripts, IDs, rich text, descriptions and task-board cards remain in place. Chapters without `planning` behave as empty plans. Existing task cards default to incomplete; no status is guessed from renamed/localized list titles. Planning and task fields are initialized when first edited and saved using the existing book PATCH API.

Added fields:

- `chapters[].planning.{themes,plotlines,characters}[]`: `{ entityId, note? }`.
- `taskBoard.lists[].cards[].chapterId?`, `completed?`.
- `characters[].role?`, `notes?`.
- `themes[].color?`, `plotlines[].color?`.

The existing authenticated owner-scoped book API, serialized autosave, optimistic `updatedAt` conflict check and browser recovery store are reused. Server validation runs before updates and rejects unknown book-local references, duplicate associations, mismatched item `bookId` values and malformed collections. Schema validation enforces colors and note lengths. Chapter and entity archive actions preserve records and references; archived entities are hidden from active pickers. Hard removal of a referenced record is rejected until its references are removed. Archiving a chapter never deletes shared entities or board tasks.

For rollout, release the backend schema and frontend together (or backend first). An older backend does not know the new fields. Rollback should retain the additive database fields and avoid saving planning-bearing books through an older backend. No deployment was performed.

## Verification

- Frontend production build / TypeScript check.
- Shared and backend TypeScript project build (`tsc -b shared backend`).
- Frontend lint: zero errors; existing repository warnings only.
- Backend lint for all touched source files.
- 26 focused Node tests: chapter planning/schema, task board, draft saving/recovery, annotations and rendering.
- 9 book API tests: authorization scoping, atomic conflict handling, archive preservation, invalid cross-book planning and tasks.
- Browser integration: entity creation/reuse, separate contribution notes, board context, completion/reopening in preview, persisted refresh, overview filters, keyboard reordering, desktop/tablet/mobile widths and Hebrew/English text. API responses are supplied by the test fixture; schema round trips separately cover Mongoose persistence shape.
- Existing task-board and writing-studio browser regressions.

Screenshots are in `docs/chapter-planning/screenshots/`.

Known baseline issue: `scripts/writing-studio-details.test.cjs` has a palette-only assertion that fails on hard-coded shadow colors already present in `origin/main`'s `writingStudio.css`; the rendering test in that file passes. Vite also reports the existing large-chunk and outdated Browserslist warnings.

## Limits

No live production database or touch hardware was used. Shared elements are archived, not permanently deleted; restoring archived elements has no new UI. The entire book still uses the existing whole-document save architecture, with its version conflict protection. Large-book optimization and translations of new interface labels are outside this ticket; Hebrew and English content and direction are supported.

Reproduce the main checks from the worktree:

```powershell
node frontend/node_modules/typescript/bin/tsc -b shared backend
node --test scripts/chapter-planning.test.cjs scripts/task-board.test.cjs scripts/writing-studio.test.cjs scripts/writing-annotations.test.cjs scripts/writing-annotations-schema.test.cjs
# From frontend/: npm run lint; npm run build
# From backend/: node node_modules/jest/bin/jest.js --runInBand --watchAll=false src/controllers/book/bookStudio.test.ts
# With PLAYWRIGHT_MODULE pointing to an installed Playwright package:
node --test --test-concurrency=1 scripts/chapter-planning.browser.test.cjs scripts/task-board.browser.test.cjs scripts/writing-studio.browser.test.cjs
```

Run browser checks after builds finish: a concurrent Vite build can trigger a fixture page reload. The browser suites launch local test servers and Edge; they do not contact production.
