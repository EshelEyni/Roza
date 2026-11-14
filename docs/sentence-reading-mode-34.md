# Ticket #34: Sentence Mode

Branch: `feat/sentence-reading-mode-34`

Worktree: `C:\dev\Roza-worktrees\ticket-34-sentence-mode`, based on local `main` at `8cdc24b`.

Sentence Mode appears beside RSVP. The scan-line header, pale beige palette, serif sentence, progress row, stacked Back/Next controls and five compact action tiles follow the supplied HTML demo. The text area scrolls independently while the controls remain visible, including at 320 × 568. Left/Right navigate sentences; on desktop Down/Up highlight the next/previous word within the current sentence using the reader selection colors. Down continues from the last word to the next sentence’s first word; Up continues from the first word to the previous sentence’s last word. Without a highlight, Up starts at the current sentence’s final word. Left/Right and button navigation clear the word highlight; Escape only dismisses open side panels and translation popups; the X button exits Sentence Mode.

Only the current EPUB spine section is extracted. Inline nodes are joined before sentence segmentation; paragraphs and line breaks remain boundaries. Each sentence retains its original DOM-range CFI. `Intl.Segmenter` and the existing segmentation fallback are reused, with common English honorifics joined when ICU separates them. Nonlinear spine sections and empty sections are skipped when navigating chapters. Sentence Mode shares the exact reading anchor and hidden-rendition input guard with RSVP, without using RSVP timers or speed. Closing displays the sentence CFI and resumes normal chapter/page tracking. The existing reader state saver persists progress.

Translate uses the existing dictionary endpoint and Google Translate service, with explicit `passage: true` and `provider: "google"`. Existing single-word validation, cache, quota protection, credentials and attribution remain in use. Passage translations retain the original text and do not create vocabulary events. The existing 20,000-character passage limit also applies to sentence translation and AI; content remains readable and copyable beyond that limit. Translation remains English-to-Hebrew, matching the current reader integration.

Ask AI creates a passage chat in the existing workspace and preserves spoiler protection at the end of the current sentence. Annotate opens the existing annotation editor with the sentence range; Copy copies its complete text. Panel passage navigation exits Sentence Mode before navigating normally.

Ticket #25 is absent from this base. Flag is visibly disabled and labeled as requiring Save for Later. No flag storage, endpoints, or alternate annotation-based flag system were added. Integrating #25 should connect this tile to its existing save action with the current sentence's `text` and `cfi` (the same selection shape used by other actions).

## Changed files

- `frontend/src/components/Reader/ReaderSentenceMode.tsx`: sentence screen, controls and existing action integrations.
- `frontend/src/hooks/reader/useReaderSentenceMode.ts`: incremental extraction, navigation and position synchronization.
- `frontend/src/services/readerSentences.ts`: DOM-backed sentence extraction.
- `frontend/src/services/readerSentenceSpans.ts`: common honorific boundary handling.
- `frontend/src/hooks/reader/useEpubReader.ts`: controller composition and sentence passage actions.
- `frontend/src/hooks/reader/useEpubRuntime.ts`: documents the shared focus anchor.
- `frontend/src/components/Reader/EpubReader.tsx`: mode rendering and preserved viewport lifecycle.
- `frontend/src/components/Reader/ReaderToolbar.tsx`: entry point and close header.
- `frontend/src/components/Reader/ReaderDictionary.tsx`: explicit passage translation support.
- `frontend/src/styles/app/_reader.scss`: approved layout, responsive controls and independent scrolling.
- `shared/types/readerDictionary.ts`: optional passage discriminator.
- `backend/src/controllers/reader/readerDictionaryController.ts`: validated sentence translation using the existing provider without vocabulary writes.
- `backend/src/services/reader/googleTranslateService.ts`: bounded explicit passage support using existing request/caching infrastructure.
- Corresponding backend controller/provider tests, `scripts/reader-sentence-spans.test.cjs`, `scripts/reader-sentence-mode.browser.test.cjs`, and `scripts/fixtures/reader-rsvp.tsx`.
- This implementation and validation record.

## Validation

- Frontend TypeScript build and backend TypeScript check passed.
- Local Vite production build and PWA service-worker generation passed. Existing Browserslist and large-chunk warnings remain.
- Backend dictionary controller and Google Translate suites: 25 tests passed.
- Sentence segmentation, native selection, chat workspace and backend development runtime: 36 tests passed.
- Sentence Mode real-EPUB browser fixture: desktop and iPhone touch viewports passed on Edge and WebKit. Covers inline-node CFIs, sentence actions, saved annotation text/range, copy, keyboard navigation, chapter transitions over nonlinear content, exact reopen location, progress after reload, normal-reader chapter synchronization, and long-sentence scrolling with controls visible.
- Existing RSVP real-EPUB suite: desktop and mobile touch passed on Edge.

Browser fixtures use intercepted APIs, not live Google/AI calls. WebKit is a desktop automation build with iPhone-sized touch emulation; physical iPhone Safari and an installed iOS PWA still require device verification. PWA packaging was built locally; installed/offline PWA behavior was not exercised. No merge, push, or deployment was performed.

To run browser tests, set `PLAYWRIGHT_MODULE` to the installed Playwright package. Use `RSVP_WEBKIT=1` for WebKit; otherwise the fixtures use installed Edge. Run `node --test scripts/reader-sentence-mode.browser.test.cjs` and `node --test scripts/reader-rsvp.browser.test.cjs` from the worktree root.

Sentence action shortcuts: T translates, A opens Ask AI, C copies the complete sentence, and N opens Annotate. F remains unavailable with the disabled Flag action. Shortcuts use the same button handlers and disabled checks, ignore key repeat, and are inactive inside editable fields, dialogs, and open panels. Escape only dismisses panels/popups.

Highlight layout regression: cloned inline box decoration disabled balanced wrapping in Chromium, shifting line breaks when a word was marked. The highlight now changes only background/text color and corner rounding. A regression uses the reported Janis sentence and checks every word rectangle before/after highlighting each word at five widths and two font sizes.
