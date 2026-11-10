# Screenplay mode

Branch: feature/screenplay-mode. Base: origin/main at 04f07d4342fac11188b8b5af3ba348ef7fe1897e.
Worktree: C:/Users/אריק/Documents/ChatGPT/book reader/roza-screenplay-mode.

## Editor and data

The existing Slate/React editor, slate-history, annotation operation transforms, DraftStore debounce, conflict detection, recovery, and chapter storage are reused. No separate editor or AI service was added.

Chapters have an optional format (prose or screenplay); Mongoose defaults missing values to prose. Existing text, summaries, annotations, marks, and planning metadata are retained. A book can mix formats. Changing to Prose converts all screenplay blocks to normal paragraphs and removes screenplay alignment, preserving text leaves, inline marks, summaries, annotations and their paths. The editor reloads the converted tree. Changing to Screenplay keeps existing content and enables script tools; authors assign individual element types. The Chapter Format modal explains the conversion before applying it.

Six semantic block types are added to the shared Slate union: scene_heading, action, character, dialogue, parenthetical, transition. Dialogue attribution follows the preceding character cue in document order. No indentation spaces are inserted in stored text. Styles and semantic rendering are shared by editor, previews, and HTML export.

Enter follows scene/action, character/dialogue, parenthetical/dialogue, dialogue/character, and transition/scene conventions. Shift+Enter inserts a line break. Ctrl/Cmd+Enter cycles elements. Tab and Shift+Tab retain normal browser focus navigation; the editor does not intercept them. Composition events are left to the browser.

Character cues accept names typed directly in the manuscript; the toolbar contains only the element and scene dropdowns. Scene headings populate a scene-navigation dropdown with a scene count. Plain-text multiline paste recognizes common screenplay patterns; internal Slate clipboard data keeps its existing structure. Paste remains undoable and uses Slate operations to transform annotation ranges.

## Exports and AI contract

Options provides Fountain, direct screenplay PDF, existing HTML, and JSON backup. PDF/Fountain include active screenplay chapters only. HTML/JSON include the mixed manuscript. PDF uses Letter paper, 12pt Courier, 1.5-inch left / 1-inch right margins, narrowed dialogue, parenthetical/cue indentation, page numbers after page one, and cue/heading pagination heuristics. HTML supports browser print-to-PDF with semantic styles. Fountain uses explicit markers to disambiguate scene headings, action, character cues, and transitions.

The planned AI integration can consume the exact structured block tree. validateScreenplayEdit rejects block-count/type changes and scene/cue changes; a future AI approval/diff UI must call this guard before showing a proposal, preserve character voice, and require explicit author approval before applying it. There is no active manuscript AI editing feature in this change.

## Validation

- 23 Node tests: screenplay transitions/history, scene recognition, paste parsing, Fountain/HTML safety, schema defaults and semantic round trip, PDF dimensions/font/pagination; existing autosave/recovery and annotation suites.
- Existing full studio Edge browser regression suite passed, including chapter drag-and-drop (one timing-sensitive drag run needed a rerun).
- Edge screenplay browser test: actual studio controls, semantic typing, undo/redo, autosave and reload, native Tab navigation and the scene dropdown, structured paste, 390px mobile overflow. Desktop/mobile screenshots are in docs/writing-studio/screenshots/screenplay-*.png.
- Frontend production build and TypeScript check; backend build and no-emit TypeScript check.
- ESLint on changed frontend components and helpers.

## Limitations

- PDF uses jsPDF's built-in Courier font, which does not support every writing system. Use HTML/browser print for scripts needing Unicode fonts.
- Pagination is heuristic, without production-layout CONT'D/MORE handling or a live page-boundary view. Very long cue/parenthetical blocks can still span pages.
- Scene reordering and Final Draft FDX are deferred.
- Prose conversion removes screenplay structure; returning to Screenplay requires assigning element types again. Plain-text paste uses recognizable screenplay conventions, so ambiguous all-caps action may need an element-selector correction.
- AI protection is a contract/helper for the planned editor, not an active AI workflow.
- Browser API persistence is verified with the existing local mock server; schema round-trip tests cover Mongoose casting, not a production database.

No merge, push, or deployment has been performed.
