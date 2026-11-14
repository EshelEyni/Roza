# Ticket #25 — Flag words and passages for review

Implemented on branch `feat/reader-flag-review-25` from local main `72719b6`.
Worktree: `C:\Users\אריק\Documents\ChatGPT\book reader\roza-ticket-25-flag-review`.

## Behavior

- Lucide flag action toggles a saved flag without opening dictionary or AI dialogs. Ctrl+S saves the native or Ticket #29 keyboard selection, keeps it selected, prevents browser save when handled, and ignores editable controls and dialogs.
- Flags persist in a user/book-scoped MongoDB collection with text, paragraph context, chapter, start/end CFI, timestamps and review status. A unique user/book/CFI/end-CFI index and idempotent upsert prevent duplicate records, including racing requests. Different selections can save concurrently.
- Each book has a Review later flag tab beside Annotations in the reader toolbar, using the existing side panel/mobile sheet. Pending, reviewed and translated-vocabulary filters contain only that book’s content. Location jumps and AI passage handoff happen inside the current reader; the separate global review page is removed.
- Existing vocabulary and lookup history provide translations and the best location already stored for historical lookups. Review translation neither creates lookup events nor changes lookup statistics. Removing vocabulary from review hides it without deleting its history. Vocabulary reviewed/hidden book-ID sets keep review preferences independent for each book without duplicating vocabulary or migrating history. Review API reads and writes verify ownership of the current book.
- AI review opens the existing chat with the saved passage and waits for a user message. Existing AI size limits remain enforced. English and Hebrew labels are included.

## Validation

- `node frontend/node_modules/typescript/bin/tsc -b shared backend frontend` — passed.
- `npm run build` in frontend — passed (existing bundle-size/Browserslist warnings).
- `npx jest --runInBand --watch=false src/controllers/reader/readerReviewController.test.ts src/routers/reader/readerRouter.test.ts` in backend — 87 tests passed.
- `node --test --test-force-exit scripts/reader-flag-review.browser.test.cjs` — passed in Edge/Chromium. Covers keyboard/native selections, handled Ctrl+S, input exclusion, no dictionary requests from flagging, duplicate prevention, toolbar removal, reload and font-change persistence, navigation back from another chapter, pending/reviewed/vocabulary filters, translation, vocabulary actions, AI quote handoff without auto-send, and iPhone touch emulation at 390×844. Also verifies the in-reader review toolbar tab and isolation when switching between two books. The test uses a dynamically allocated port to avoid competing with the user’s dev server. Mobile screenshot visually inspected.
- `node --test --test-force-exit scripts/reader-keyboard-groups.browser.test.cjs` — passed; Ticket #29 grouping/navigation regression.
- `git diff --check` — passed.

Browser tests use the existing PLAYWRIGHT_MODULE / PLAYWRIGHT_CHANNEL environment overrides. API tests mock the persistence/provider boundaries; browser tests use an in-memory HTTP fixture. Live MongoDB restart, live translation/AI providers, and physical iPhone Safari were not exercised. Existing historical vocabulary locations can be page anchors rather than exact selected-word CFIs.

## Changed files

- `backend/src/models/reader/schemas/readerVocabularySchema.ts`
- `backend/src/routers/reader/readerRouter.ts`
- `frontend/public/locales/en/translation.json`
- `frontend/public/locales/he/translation.json`
- `frontend/src/App.tsx`
- `frontend/src/components/Reader/EpubReader.tsx`
- `frontend/src/components/Reader/ReaderDictionary.tsx`
- `frontend/src/hooks/reader/useEpubBook.ts`
- `frontend/src/hooks/reader/useEpubReader.ts`
- `frontend/src/hooks/reader/useReaderSelection.ts`
- `frontend/src/pages/Reader/ReaderPage.tsx`
- `frontend/src/routes.ts`
- `frontend/src/services/readerWordNavigation.ts`
- `frontend/src/styles/app/_reader.scss`
- `backend/src/controllers/reader/readerReviewController.test.ts`
- `backend/src/controllers/reader/readerReviewController.ts`
- `backend/src/models/reader/readerFlagModel.ts`
- `frontend/src/hooks/reader/useReaderFlags.ts`
- `frontend/src/components/Reader/ReaderReview.tsx`
- `frontend/src/components/Reader/ReaderPanels.tsx`
- `frontend/src/components/Reader/ReaderToolbar.tsx`
- `frontend/src/types/reader.ts`
- `scripts/fixtures/reader-flag-review.tsx`
- `scripts/fixtures/reader-review-page.tsx`
- `scripts/reader-flag-review.browser.test.cjs`
- `shared/types/readerReview.ts`

The feature was pushed to its dedicated remote branch, then integrated into main at the user’s explicit request. No deployment was performed.

## Main integration validation

Merged against main `0945366`, preserving reading-progress settings and sentence mode. Additive conflicts were resolved without dropping either feature; normal-toolbar sizing excludes the dedicated sentence-mode toolbar. Invalid flag-list responses now show a loading error instead of crashing the reader.

- Shared/backend/frontend TypeScript project build and frontend production build passed.
- 129 API tests passed across review, access, progress, annotations and keyboard settings.
- Seven helper/runtime tests passed, including the real CommonJS development loader.
- Flag/review, sentence-mode and reading-progress browser regressions passed on desktop and mobile emulation. Existing progress/sentence harnesses ran from temporary copies with isolated ports.
