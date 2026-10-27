# Cross-page text selection

Worktree: `roza-cross-page-text-selection`

Branch: `feature/cross-page-text-selection`

## Behavior

Select text normally, then use the selection toolbar's previous/next arrows to extend the selection one page at a time. On desktop, holding a text drag near the left/right viewport edge also advances pages. Shift+PageUp/PageDown extends the selection with the keyboard. These actions use epub.js navigation and CFIs.

While extending, selecting text on the current page refines the moving endpoint. The initial opposite endpoint stays anchored. Close the selection toolbar (or press Escape) to start a fresh selection. Ordinary page navigation and chapter/search navigation dismiss the selection as before.

The Copy button copies the entire passage, including chapters no longer rendered. Native copy events in the book iframe also use the complete extended passage. Copy has no 3,000-character limit; AI actions retain that limit. Word lookup and Google translation retain their existing behavior.

## Implementation

epub.js keeps a section's paginated columns in one iframe, but its default manager replaces that iframe when crossing a spine boundary. Browser ranges cannot span those documents. `readerSelectionRange.ts` reads one CFI-bounded DOM range per spine item, in reading order, and joins sections with a newline. It does not concatenate screen-page fragments. epub.js annotations highlight each selected section.

AI conversations now accept an optional `passageEndCfi` and store `passage.endCfi`. The backend reconstructs the passage from its owned EPUB, validates its total length, and checks its final endpoint against the reading boundary. Existing single-section conversations remain compatible.

## Changed files

- Selection state and extraction: `frontend/src/hooks/reader/useReaderSelection.ts`, `frontend/src/services/readerSelectionRange.ts`, `frontend/src/types/reader.ts`.
- Reader integration and gestures: `frontend/src/hooks/reader/useEpubBook.ts`, `frontend/src/hooks/reader/useEpubReader.ts`, `frontend/src/services/bindReaderContents.ts`.
- Selection toolbar and localization: `frontend/src/components/Reader/EpubReader.tsx`, `frontend/src/components/Reader/ReaderDictionary.tsx`, `frontend/src/styles/app/_reader.scss`, `frontend/public/locales/en/translation.json`, `frontend/public/locales/he/translation.json`.
- AI passage transport: `frontend/src/hooks/reader/useReaderPanels.ts`, `frontend/src/hooks/useReaderChat.ts`, `frontend/src/services/readerChatApiService.ts`, `shared/types/readerChat.ts`.
- AI validation and persistence: `backend/src/controllers/reader/readerChatController.ts`, `backend/src/models/reader/schemas/readerConversationSchema.ts`, `backend/src/services/reader/readerContextService.ts`, `backend/src/types/iTypes.ts`.
- Tests: `scripts/fixtures/reader-selection.tsx`, `scripts/reader-selection.browser.test.cjs`, `backend/src/services/reader/readerContextService.test.ts`, `backend/src/routers/reader/readerChatRouter.test.ts`.

## Validation

- Frontend production build and ESLint on changed frontend source files pass.
- Backend build/type check passes.
- Existing selection, touch and iframe regression tests: 23 pass.
- Backend context and conversation tests: 20 pass.
- Browser regression: desktop and mobile touch contexts pass in headless Edge. Covers repeated forward/backward extension across three chapters, exact text order, clipboard events and the Copy button, endpoint refinement, cancellation, desktop edge dragging, AI handoff and limits, and dictionary/Google translation requests. Translation responses are mocked; no paid AI calls are made.

Run existing gesture tests from the repository root:

```powershell
node --test scripts/reader-selection.test.cjs scripts/reader-touch.test.cjs scripts/reader-contents.test.cjs
```

The browser regression requires a Playwright installation. Set `PLAYWRIGHT_MODULE` to its package directory if it is not on Node's module path. Set `PLAYWRIGHT_CHANNEL=msedge` to use installed Edge, or leave it unset to use Playwright Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node --test scripts/reader-selection.browser.test.cjs
```

Run backend tests from `backend`:

```powershell
npx jest --runInBand --watchAll=false --runTestsByPath src/services/reader/readerContextService.test.ts src/routers/reader/readerChatRouter.test.ts
```

Physical iOS Safari and Android selection-handle behavior still needs device testing. Check long-press selection, endpoint refinement after crossing a chapter, portrait/landscape rotation, and Copy. Browser mobile emulation does not reproduce native OS handles.

The feature was developed in a separate worktree and combined with the newer mobile navigation and selection-dismissal fixes on main. Remove the feature worktree only after the user confirms it is no longer needed.
