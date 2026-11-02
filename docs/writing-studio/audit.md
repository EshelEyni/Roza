# Writing studio audit and direction

## Existing architecture and journeys

`routes.ts` mounts BooksProvider at `/books`, and BookProvider at `/book/:id` and `/book-edit/:id`, with optional item type/ID segments. BooksContext combines login, server search/sort and intersection pagination. BookContext derives the selected item and sends full Book objects through React Query mutations. Creation starts in BookList's modal; viewing and editing are separate screens. BookEdit shows a category list, then DataBookItemEdit mounts separate description and manuscript editors.

Book documents embed ordered arrays of chapters, characters, themes, plotlines and notes. Slate trees are stored directly in MongoDB. Chapter descriptions already provide a planning area. Express book routes use the authenticated user ID; Mongoose schemas preserve rich text and timestamps. Archival is represented by flags, but find middleware removes archived children from responses. Existing PATCH replaces supplied arrays, which can permanently remove those hidden archived children on the next save.

The shared Slate editor renders marks, headings, lists, quotations and alignment. It does not install the already available slate-history plugin. Ctrl+F unexpectedly toggles fullscreen. PDFCreator supports a chapter PDF through the old details screen; no manuscript backup/import workflow exists. Reading EPUBs is a separate reader subsystem and must stay untouched.

## Experience and weaknesses

- Writers navigate list → details → edit instead of entering a persistent workspace.
- Description appears before manuscript, toolbars are dense, and editing is constrained to a short scrolling box.
- No visible save state, recovery flow, or conflict detection. Debounces are allocated during renders and close over old whole-book snapshots; chapter switching and overlapping requests can lose updates.
- Refetching an uncontrolled Slate initialValue does not reliably reconcile its internal state.
- Word counting splits individual formatting leaves, overcounting words spanning marks.
- Chapter creation/navigation and separate metadata screens compete with writing. Small screens inherit desktop form layouts.
- Archive is not clearly reversible from the user interface. Search relies on a Mongo text index over structured text; query strings are not encoded.

## Implementation priorities

1. Keep the storage format and Slate. Introduce an owned local draft, serialized/debounced requests, account/book-scoped recovery, explicit save errors and atomic timestamp conflict checks. Retain archived children server-side.
2. Replace the edit route with a persistent workspace: manuscript navigation, restrained warm palette, generous typography, focused writing, reading preview, notes, keyboard controls and mobile drawer.
3. Redesign the library with search, sorting, word/chapter counts, clear creation and direct writing entry.
4. Add reorder, duplicate, reversible chapter archive, resume position, goals, full-fidelity JSON backup and formatted HTML/print export. Use existing formats without a migration or new dependency.
5. Verify delayed/failing requests, navigation, recovery, long text, exports and responsive layouts with isolated browser fixtures and controller tests.

## AI assessment

Existing AI routes are reader-book/conversation scoped, with reader context extraction, usage controls and provider configuration. Writing books have a different model and ownership path. Reusing those routes directly would conflate manuscripts with EPUB context. Defer AI until a shared context adapter is designed; no model calls, cost, or automatic rewriting are added here.

## Deliberate boundaries

No storage migration, replacement editor, new AI architecture, DOCX/EPUB parser, scene hierarchy, or unrelated reader changes. Retain legacy book details and chapter PDF access. Local recovery is a safety net on this browser, not server version history. Conflict recovery must never automatically overwrite a newer server manuscript.
