# First review fixes: palette, details page, and scrolling

These changes address the three issues raised in the first visual review. They build on the writing-studio implementation and supersede its notes about retaining the legacy details screen and isolated-component-only browser testing.

## App colors

The library, studio, details page, dark appearance, menus, placeholders and progress bar now use Roza's existing `app-100` through `app-900` colors. The stylesheet resolves values through Tailwind's `theme()` function, so it follows the application's palette rather than maintaining a separate set of hex colors. The green/gray/off-white palette and varied pastel book covers were removed. A regression test rejects literal hex/RGB/HSL colors and checks that every referenced palette token exists in the app configuration.

## Book details

`/book/:id` is now a book overview with title, word/chapter/planning counts, modification date, searchable chapter/planning lists, preview excerpts, and direct writing links. It supports renaming, adding chapters/planning pages, full-manuscript reading, HTML/JSON exports and confirmed archival. Mutations display errors and navigate only after a successful save.

Existing `/book/:id/:dataItemType/:dataItemId` URLs show redesigned read-only pages, with edit links, chapter notes, previous/next navigation, and the existing chapter PDF download. The read-only renderer preserves nested lists, alignment and combined text marks without making the text editable or rendering it as raw HTML. No backend, schema or manuscript-data changes were made in this follow-up.

## One scrolling surface

The app shell no longer forces an outer scrollbar around book screens. In the editor it owns the viewport and prevents document scrolling; the writing pane owns the long-text scroll. Header/navigation stay in place. The route-scoped document class is removed when leaving the editor, so the library and overview scroll normally. Other application routes retain their previous layout behavior.

## Verification

- Frontend TypeScript/Vite/PWA build passed.
- ESLint on changed frontend source passed.
- Eight focused Node tests passed, including the new palette and rich-text preview tests.
- Full-app Playwright regression passed in Edge with the actual `App`, routes, header, global Sass, Tailwind and fonts, using a local mock API.
- Browser checks cover overview navigation, counts, title rename failure/retry, category switching, search, chapter reading/PDF download, manuscript preview, mobile overflow, existing studio/save/recovery workflows, and a 20,000-word chapter.
- Scroll assertions verify the document and outer shell remain within the viewport while the manuscript pane scrolls, and normal overview document scrolling works after navigation.
- Desktop and mobile screenshots were inspected. Build warnings about Browserslist data and the existing PDF/font payload remain.
- This is not a live-database, physical-device or production test. No production change was performed.

## Screenshots

- [Book overview, desktop](screenshots/book-overview-desktop.png)
- [Book overview, mobile](screenshots/book-overview-mobile.png)
- [Studio, desktop](screenshots/studio-desktop.png)
- [Studio, mobile](screenshots/studio-mobile.png)
- [Dark appearance](screenshots/studio-dark.png)

Run the focused checks with:

```powershell
node --test scripts/writing-studio-details.test.cjs scripts/writing-studio.test.cjs
$env:PLAYWRIGHT_MODULE = 'C:/Users/אריק/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node --test scripts/writing-studio.browser.test.cjs
```
