# Chapter overview

Implemented on `codex/chapter-overview`, based on `feature/writing-studio-overhaul` at `cde873d`. No merge or deployment performed.

## Behavior

Open Overview in the chapter sidebar. The board keeps the sidebar visible on desktop and uses a single sortable sequence, so chapter order and insertion positions stay unambiguous. On mobile the navigation drawer supplies the same entry point.

Cards show position, title, truncated summary and word count. Use the handle for pointer/touch dragging, Space and arrow keys for keyboard dragging, or the menu's Move up/down commands. Reordering updates the sidebar immediately. Context menus provide rename, duplicate and confirmed deletion (the existing soft archive, preserving the chapter data). A new chapter opens its summary panel.

Click the title/summary area to read a chapter in a native modal reading panel, with previous/next and Edit chapter actions. Escape, Done and the close control return to the board without resetting its scroll. Native dialog provides focus containment; the triggering control regains focus. Preview uses the existing export renderer with escaped text, explicit element tags and allowlisted paragraph alignment, without mounting an editor for chapter text.

Summary editing reuses `Chapter.description`, the actual existing rich-text Chapter Notes field. There is no `summary` property in this branch's chapter entity. Both studio and overview label it Chapter summary. Summaries autosave through the existing DraftStore, preserving rich formatting.

The main manuscript editor stays mounted while hidden behind the board, preserving unsaved text, Slate selection/history and its scroll container. The summary editor refreshes when returning from the board, so an already-open summary cannot show an obsolete value. The initial chapter selection is now remembered as well as explicitly clicked chapters.

## Persistence and scope

All edits use the existing DraftStore and authenticated book-update API. Saves are serialized, use the existing revision conflict checks and never replace newer local edits with stale response data. Failed operations remain visible locally with the existing error/retry, recovery storage and backup controls. No server schema, ownership rules or API changes.

The existing book API loads/saves the complete book. The board adds no chapter fetches and renders full rich text only for the open preview/summary. Word counts and summary text are memoized per card. It does not add virtualization, a density toggle or a new per-chapter API; exceptionally large manuscripts retain the existing full-book API/storage cost. The board does not persist view preference: refresh opens writing while retaining the selected chapter. Deletion follows the existing archival semantics rather than permanently destroying content.

## Verification

- `npm --prefix frontend run build`: passed (TypeScript and Vite/PWA). Existing outdated Browserslist and large-bundle warnings remain.
- `npm --prefix frontend run lint`: passed, no errors; seven warnings in unchanged files.
- `node --test scripts/writing-studio.test.cjs`: save serialization, failure/retry, recovery/conflict, export and preview escaping checks.
- `node --test scripts/writing-studio.browser.test.cjs`: passed against real components with a local mocked API in Edge. Includes pointer and keyboard dragging, menu reorder, reload persistence, failed reorder and retry, summary autosave, preview previous/next, unsaved writing context, desktop/mobile screenshots and the existing studio regression flow.
- `git diff --check`: passed.

Browser fixture uses `PLAYWRIGHT_MODULE` to locate the installed Playwright runtime, as described in `implementation.md`. Windows Edge requires running that fixture outside the sandbox. No production service is used by the fixture. Physical touchscreen behavior and live production persistence were not tested.

Screenshots: `screenshots/chapter-overview-desktop.png`, `screenshots/chapter-overview-mobile.png`, `screenshots/chapter-preview-mobile.png`.
