# Roza writing studio — review guide

## Isolation

- Branch: `feature/writing-studio-overhaul`
- Base: `969b4cd` on `main`.
- Worktree: `C:\Users\אריק\Documents\ChatGPT\book reader\roza-writing-studio`
- No merge, push, deployment, production restart, or production data access was performed.
- Existing worktrees and unrelated reading features were left in place.

## Before and after

The previous flow separated book details, category lists, and individual edit forms. Chapter descriptions appeared before the manuscript; the editor had a short internal scroll area, dense controls, no history plugin, and no save feedback. Render-created debounces sent stale whole-book snapshots without sequencing or conflict checks.

The library now opens directly into a dedicated writing workspace. A persistent sidebar keeps chapters and planning pages within reach. The paper-like editing surface uses a comfortable line length, serif typography and restrained sage/warm-paper colors. Focus mode hides navigation and formatting controls; reading preview disables editing. Mobile has an explicit chapter drawer; tablet and RTL layouts use logical positioning. The app header remains on other routes.

Screenshots use synthetic manuscripts, not personal books:

- [Library](screenshots/library-desktop.png)
- [Desktop studio](screenshots/studio-desktop.png)
- [Night writing](screenshots/studio-dark.png)
- [Mobile studio](screenshots/studio-mobile.png)
- [Tablet with Hebrew content](screenshots/studio-tablet-rtl.png)

The original implementation was audited in source; no before screenshot was captured. See [architecture and UX audit](audit.md).

## Improved existing functionality

- Book creation with pending/error states; title search and recent/title/word-count sorting.
- Direct entry into writing; legacy `/book/:id` details and chapter PDF remain available through Details.
- Book and chapter titles are editable in context.
- Chapters, characters, plotlines, themes and notes retain their existing Slate structures and IDs.
- Chapter descriptions become optional chapter notes.
- Rich text retains headings, emphasis, lists, quotations, and stored alignment. Undo/redo now uses the already installed Slate history plugin.
- Visible saved/pending/saving/error states, explicit retry and Ctrl/Cmd+S.
- Archive confirmation for books/pages, with failure feedback. Chapter/page archival can be undone during the current workspace session; archived records are retained in storage.

## New functionality

- Keyboard-accessible chapter reordering via Move up/down, duplication, and per-page word counts.
- Manuscript search across titles and content within the chosen category.
- Last selected chapter, text size, light/dark appearance and manuscript target remembered on this browser.
- Manuscript word-goal progress, reading-time estimate, focus mode and read-only preview.
- Explicit local draft recovery after refresh or navigation. Recovery never auto-overwrites a newer server version.
- Full-fidelity JSON download of the current book, including planning content and locally available archived items.
- Escaped, formatted HTML manuscript export in chapter order. Open the HTML in a browser and print/save as PDF. This does not depend on a paid service.

## Architecture and data integrity

`WritingStudio` owns a manuscript session. `DraftStore` manages its local snapshot, a 700 ms debounce, one request at a time, and revision tracking. A server response only advances the base timestamp; it never replaces newer local edits. The next queued save uses the confirmed timestamp. Chapter switching does not unmount the session or drop edits.

Drafts are persisted synchronously on edits under an account/book-scoped localStorage key. Storage failure produces a visible warning. Unload warns while dirty; unmount retains pending content. Returning to the studio offers recovery, download, or explicit discard. A stale recovery draft is downloadable but cannot be restored over a changed server revision. A late response removes only the local draft owned by that request's session/revision.

Book PATCH now whitelists writable fields, uses the existing `updatedAt` as a compare-and-swap condition, and returns HTTP 409 on a stale version or racing write. Array replacements require a base timestamp. Partial metadata updates without arrays remain compatible with the legacy API. Mongo timestamps advance by at least one millisecond. Client-generated 24-character item IDs map to Mongo subdocument IDs, allowing offline chapter creation and continued editing before acknowledgment.

The controller reads raw storage to retain archived children that Mongoose's existing response middleware hides. Later saves no longer discard hidden archived items. Ownership remains part of both read and update predicates. There is no schema migration. Frontend and backend changes should be integrated together.

Book write requests have a scoped 20-second timeout. Ambiguous saves retain the recovery draft; retries still pass through the server version guard. Book API reads use NetworkOnly in the service worker to avoid using cached manuscript snapshots as current versions. Existing reader caching rules remain unchanged.

The old, unused `DataBookItemEdit` form was removed. Shared Slate/review editing and reader components were not rewritten. No package or lockfile changes were necessary.

## Verification

Executed successfully:

| Check | Result |
| --- | --- |
| Frontend `npm run build` | TypeScript + Vite + PWA build passed |
| Backend `npm run build` and TypeScript no-emit check | Passed; generated build artifacts excluded from commits |
| ESLint on changed frontend source and configuration | Passed |
| `node --test scripts/writing-studio.test.cjs` | 6 passed |
| Jest `bookStudio.test.ts` | 6 passed, mocked model + real Express request handling |
| Playwright `writing-studio.browser.test.cjs` | Passed in Edge, with real React/Slate components, Strict Mode and a local mock API |

Browser coverage includes library/open/create, editing two chapters before autosave, delayed responses while continuing to type, failure and refresh recovery, undo/redo, adding/renaming/reordering/duplicating/archiving/restoring chapters, export download contents, focus shortcuts, read-only preview, mobile navigation, refresh persistence, empty book creation, a 20,000-word chapter, 390 px mobile and 820 px tablet overflow checks, Hebrew text/RTL, conflicting server versions and confirmed book archival. Desktop viewport was 1365 × 900. Screenshots were inspected visually. No uncaught browser errors were reported.

Unit coverage includes marked-leaf word counts, nested-list export, HTML escaping, archived-chapter exclusion, localStorage quota failure, navigation draft retention, serialization, conflicts and late acknowledgment ownership.

Build warnings remain for the repository's outdated Browserslist database and existing large shared bundle. The complete legacy lint suite and database-backed integration suite were not claimed or run. The new controller tests mock MongoDB; this review did not exercise a live development database, authentication cookies end to end, physical mobile keyboards, Safari or Firefox. Browser fixture tests use the new components in isolation rather than the entire application shell.

## Run locally

Use the worktree above. Its frontend/backend dependency directories are local junctions to the existing installed packages; no dependency versions were changed. On a fresh checkout run `npm ci --prefix frontend` and `npm ci --prefix backend`.

Configure `backend/.env` with a **development** database and the authentication settings described in the repository README. No secrets were copied to the worktree. Do not point review sessions at a production database.

In separate PowerShell terminals, from the worktree:

```powershell
npm --prefix backend run dev
```

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5175
```

Open `http://127.0.0.1:5175/books`. The backend currently uses the repository's fixed port 3030, so arrange for that port to be available before starting it; do not stop another developer's server automatically. Login with a development account and try a copy of a manuscript. Existing manuscripts require no conversion.

Test commands, from the worktree:

```powershell
node --test scripts/writing-studio.test.cjs
node backend/node_modules/jest/bin/jest.js --config backend/jest.config.ts --runInBand --watchAll=false --runTestsByPath backend/src/controllers/book/bookStudio.test.ts
$env:PLAYWRIGHT_MODULE = 'C:/Users/אריק/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node --test scripts/writing-studio.browser.test.cjs
```

`PLAYWRIGHT_MODULE` may instead point to your installed Playwright package. The fixture starts and closes its own ephemeral server; no database or credentials are needed. Edge is the default browser channel. This Windows environment required running browser and Supertest checks outside the sandbox because browser launch/loopback connections were blocked inside it.

## Deliberate exclusions and remaining limitations

- No AI feature: reader AI is tied to EPUB books and conversation/context services; a manuscript adapter needs a separate design. No external usage costs were introduced.
- No imports, DOCX/EPUB output, automatic merge, server revision history, daily activity tracking, scene hierarchy, drag-and-drop, or find-and-replace. Reordering uses accessible buttons; browser Find remains intact.
- HTML print output replaces neither a typesetting engine nor the existing chapter PDF workflow. JSON is an inspectable portable backup, not an implemented restore/import interface.
- Local recovery is one draft per account/book/browser, not durable cloud backup or simultaneous offline collaboration. Download backups for independent copies. Clearing browser data removes local drafts; storage errors are surfaced.
- Library queries still retrieve full book documents (up to 10,000) under the existing API. Very large libraries and whole-book network payloads deserve a metadata endpoint and chapter-level patches.
- New studio labels are English. Hebrew manuscript content and RTL layout are supported and tested; complete Hebrew UI translation remains follow-up work.
- Whole-book archive restoration and chapter restoration after leaving the studio need a future archive browser. Nothing is hard-deleted by the new UI.
- Legacy details/PDF screens remain available and retain their prior visual design. They are not the normal editing path.

## Recommended next steps

1. Verify the branch against a dedicated development MongoDB and exercise authenticated, multi-tab sessions before integration.
2. Add server revision history and an archive/recovery browser, then a validated JSON import into a new manuscript.
3. Localize studio labels and test physical iOS/Android keyboard behavior.
4. Introduce library metadata summaries and chapter-level conditional updates for large projects.
5. Add author-requested DOCX/EPUB output and optional AI context adapters only after the core workflow is reviewed.
