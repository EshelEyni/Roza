# Ticket #24: RSVP reading

RSVP is optional and starts at the current EPUB CFI. It tokenizes only the requested spine section, joining inline text while keeping UTF-16 DOM boundaries for every word. Script, style, hidden, and SVG text are excluded; block and line breaks retain pause boundaries.

The EPUB renderer stays mounted beneath the RSVP view. While RSVP is active, renderer relocation and page-key events cannot overwrite its exact word position. Each word uses the existing reader state/cache/server persistence path. On return, the renderer displays the collapsed word CFI; the exact range remains the saved anchor while its page is visible. A normal page turn clears that anchor.

Playback defaults to 300 WPM, supports 100–1,000 WPM, and adds comma (1.5x), sentence (2x), and paragraph (2.5x) delays. It pauses at section boundaries and when the page becomes hidden. Chapter navigation loads the next/previous linear spine item and remains paused. Word and sentence navigation also pause playback.

Tap the word to pause and open the existing dictionary controls, including the dictionary and Google Translate providers. Closing translation keeps playback paused until Play is pressed. Normal reader appearance and preferences are preserved; RSVP also reuses the theme and font family. Speed is an optional local preference.

Validation commands:

- `npm run build --prefix frontend`
- `node --test scripts/reader-content-security.test.cjs scripts/reader-selection.test.cjs scripts/reader-jump-history.test.cjs scripts/reader-touch.test.cjs`
- `node --test --test-force-exit scripts/reader-rsvp.browser.test.cjs`

The browser suite requires Playwright via `PLAYWRIGHT_MODULE` (or normal module resolution). It uses installed Edge by default; set `RSVP_WEBKIT=1` and, if needed, `PLAYWRIGHT_BROWSERS_PATH` to run WebKit. Tests generate a real EPUB and mock server responses, including translation responses; they do not call a paid translation service. Mobile browser emulation does not replace a final check on a physical iPhone.

Verification results: production frontend build passed; all 30 targeted reader unit checks passed; the RSVP browser suite passed on Edge and WebKit, each with desktop and mobile touch viewports. Coverage includes CFI round trips, inline markup and line breaks, speed limits and punctuation delays, pause/resume, both translation providers (mocked), paused translation dismissal, chapter boundaries and non-linear section skipping, resizing, mode switching, server persistence, cache clearance, and reopening.

Existing browser regression failures were reproduced with the baseline reader hooks from commit `0d9fd2b`: navigation preview reports page 51 but lands on page 52; desktop selection expects an unavailable “Next page or section” control; mobile selection also has existing assertion/translation-control failures. No unrelated fixes were made. A physical iPhone Safari check remains manual.

RSVP words are measured in the selected font before painting and reduced only as needed to fit the stage on one line, including punctuation. ResizeObserver and font-loading events recalculate sizing. Regression coverage includes boardinghouse, a 45-letter token, and a synthetic 200-character token at desktop, mobile, and 320px widths.
