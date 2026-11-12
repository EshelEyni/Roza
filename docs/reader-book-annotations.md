# Ticket 18: Book annotations and highlights

Implemented on `feature/book-annotations` in
`C:\Users\אריק\Documents\ChatGPT\book reader\roza-book-annotations`.

Selection actions now offer Highlight and Add Note. Saved passages support yellow,
green, blue, and pink; editing, removing notes, and deleting annotations use the
existing reader sheet/sidebar. The Annotations toolbar button lists the current
book's annotations in CFI reading order and navigates to their passages.

Saved marks use epub.js's native annotation manager, with its `underline` type
styled as a filled highlight and an extra underline for notes. This separates
saved annotation ownership from the reader's temporary `highlight` marks for
selection, search, AI, and translation. No EPUB text nodes are wrapped or changed.
The renderer restores SVG overlays when views are recreated. Extended selections
reuse the existing CFI range splitter to register one overlay per spine section.
Identical passage selections update one database record. Overlapping passages
remain independent; shared section ranges are drawn once and retain their other
owner when an annotation is removed. All annotations remain accessible in the
library, including passages covered by another overlay.

## Persistence and migrations

No data migration or dependency change is required. Mongoose creates the new
`reader_annotations` collection and its unique compound index over
`userId, bookId, cfi, endCfi` using the existing application connection/index
conventions. The API checks book ownership before every operation and includes
both authenticated user and book in every annotation query. Client-supplied
ownership fields are ignored. GET responses disable caching.

Endpoints: `GET /api/reader/:id/annotations`,
`PUT /api/reader/:id/annotations` (create/update exact passage), and
`DELETE /api/reader/:id/annotations/:annotationId`.

## Validation

- Frontend and backend production builds passed.
- ESLint passed for the new frontend hook and component.
- 49 API tests passed: new annotation routes plus existing reader routes, covering
  authentication, feature access, user/book scoping, colors, notes, deletion,
  cross-section references, malformed input, and existing position/preferences.
  Models are mocked; these tests do not connect to a live MongoDB instance.
- 56 focused reader regression tests passed for selection, dictionary Ask AI,
  independent translation failures, popup placement, touch navigation, passage
  marks, and jump history.
- The new real-renderer browser suite passed in desktop Chromium (Edge channel)
  and iPhone-sized touch WebKit: selection popup highlighting, unchanged text and
  layout dimensions, navigation/restoration, reload, note creation/edit/removal,
  color changes, font changes, resize, library navigation, overlapping passages,
  cross-chapter restoration, user/book isolation, deletion, and desktop fullscreen.
  Its API fixture stores records in memory across page reloads. WebKit emulation
  does not replace a physical iPhone Safari check, which remains unperformed.
- Broader existing checks were also attempted. Four tests in
  `frontend/tests/readerChatDraft.test.cjs` fail because their mock does not resolve
  `readerChatWorkspace`. Existing navigation browser tests fail waiting for the
  return button to expire; selection browser tests fail looking for the old
  “Translate with Google” button. These checks were left unchanged and are not
  counted among passing tests.

Focused commands from the worktree root:

```powershell
npm run build --prefix frontend
npm run build --prefix backend
$env:NODE_ENV = 'test'
node backend/node_modules/jest/bin/jest.js --config backend/jest.config.ts --runInBand --watchAll=false --runTestsByPath backend/src/routers/reader/readerAnnotationsRouter.test.ts backend/src/routers/reader/readerRouter.test.ts
node --test frontend/tests/readerDictionaryAskAi.test.cjs frontend/tests/readerJumpBlur.test.cjs frontend/tests/readerMobilePopupPosition.test.cjs frontend/tests/readerTranslationFailures.test.cjs scripts/reader-touch.test.cjs scripts/reader-selection.test.cjs scripts/reader-passage-marker.test.cjs scripts/reader-selection-edge.test.cjs scripts/reader-jump-history.test.cjs
# Set PLAYWRIGHT_MODULE if Playwright is installed outside this repository.
# Install WebKit if needed: node <playwright-package>/cli.js install webkit
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node --test scripts/reader-annotations.browser.test.cjs
```

## Changed files

- `.gitignore`: ignore local annotation browser cache and downloaded test browsers.
- `shared/types/readerAnnotations.ts`: shared annotation and color types.
- `backend/src/models/reader/readerAnnotationModel.ts`: annotation collection/index.
- `backend/src/controllers/reader/readerAnnotationController.ts`: scoped CRUD.
- `backend/src/routers/reader/readerRouter.ts`: annotation endpoints.
- `backend/src/routers/reader/readerAnnotationsRouter.test.ts`: API tests.
- `frontend/src/hooks/reader/useReaderAnnotations.ts`: persistence and overlays.
- `frontend/src/hooks/reader/useEpubReader.ts`: reader composition.
- `frontend/src/components/Reader/ReaderAnnotations.tsx`: library and note editor.
- `frontend/src/components/Reader/EpubReader.tsx`: connect selection and panels.
- `frontend/src/components/Reader/ReaderDictionary.tsx`: selection actions.
- `frontend/src/components/Reader/ReaderPanels.tsx`: reuse the existing sheet.
- `frontend/src/components/Reader/ReaderToolbar.tsx`: annotations button.
- `frontend/src/types/reader.ts`: annotations panel type.
- `frontend/src/styles/app/_reader.scss`: overlays and annotation editor styling.
- `frontend/public/locales/en/translation.json`: English strings.
- `frontend/public/locales/he/translation.json`: Hebrew strings.
- `scripts/fixtures/reader-annotations.tsx`: real reader browser fixture.
- `scripts/reader-annotations.browser.test.cjs`: Chromium/WebKit coverage.
- `docs/reader-book-annotations.md`: implementation and validation handoff.

No merge, cherry-pick, main branch switch, deployment, or integration is included.
