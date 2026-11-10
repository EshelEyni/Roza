# Chapter preview review workspace

Branch: codex/chapter-preview-review. Dedicated worktree: roza-chapter-preview-review. No merge or deployment.

The preview includes a collapsible summary with Edit Summary / Add Summary and a multiline textarea. Each keystroke updates the existing Chapter.description rich-text property through DraftStore; edited summaries become plain paragraph nodes. Untouched rich summaries and all manuscript formatting remain intact. Pending edits are retained in the shared store and its existing local recovery storage. Navigation and close flush the existing serialized save queue without blocking reading; failures offer retry and do not erase local changes.

Previous Chapter / Next Chapter and unmodified Left/Right arrows use the current unarchived book.chapters order. The position label updates with the chapter. Editable fields suppress navigation and Escape. Outside editable fields, Escape closes the dialog. Each chapter remounts the reading pane to reset scroll; focus moves to the close button so keyboard navigation keeps working when a clicked boundary button becomes disabled. The fixed header/footer frame the independently scrolling reading pane. No chapter requests or new summary fields were added.

Validation:
- Frontend TypeScript and Vite production build: passed.
- Frontend ESLint: passed, seven existing warnings.
- writing-studio.test.cjs: all seven tests passed.
- PREVIEW_ONLY=1 node --test scripts/writing-studio.browser.test.cjs: passed in Edge using the existing mocked book API. Covers inline editing, save persistence after reload, typing guards, Escape, both chapter directions, boundaries, scroll reset, and mobile dialog bounds/editing.
- Full browser suite: preview checks passed, then timed out in the keyboard drag reorder assertion at the existing organization stage.
- writing-studio-details.test.cjs: renderer check passed; palette check fails on the existing #0001 in .ws-category-options, also present in HEAD.

The browser fixture uses PLAYWRIGHT_MODULE to locate the bundled runtime. No production API was used. Physical devices and production persistence were not exercised.
