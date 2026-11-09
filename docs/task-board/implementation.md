# Book task board

Implemented in `codex/book-task-board`, in the `roza-task-board` worktree. No merge, push, or deployment was performed.

## Using the board

Open a book in the Writing Studio and choose **More → Tasks / משימות**. A Tasks shortcut is also available when the manuscript has no pages. **Return to manuscript** restores the mounted writing view, selected chapter, editor state, and scroll position.

New boards start with To Do, In Progress, and Done. List titles are editable inline. Add arbitrary lists and quick-create cards by entering a title and pressing Enter. Drag using the dedicated grips; ordinary card clicks open details. Pointer dragging activates after 8 pixels; touch grips use a short hold and preserve normal scrolling elsewhere. Keyboard grips use Space to pick up/drop and arrow keys to move. List arrows and card detail move controls provide alternatives.

Card details support titles, multiline descriptions, checklist items and completion, editable colored labels, due dates, and created/updated timestamps. Cards display labels, due dates, description indicators, and checklist counts. Deleting a card or list asks for confirmation and identifies the affected list/card count. The native modal provides focus containment and Escape dismissal. The board scrolls horizontally without overflowing the page, and uses the studio's light/dark theme.

## Storage and reliability

The optional `Book.taskBoard` field contains ordered `lists`, each containing ordered `cards`. Cards contain `id`, `title`, `description`, `dueDate`, `checklist`, `labels`, `createdAt`, and `updatedAt`. Checklist items and labels have stable IDs. Array order is authoritative; there is no separate order counter. Mongoose schemas validate titles, bounded text, IDs, label color, and due-date format. Existing books need no migration; defaults are created on opening and stored with the first board edit.

The existing authenticated book API scopes reads and writes to the owner. Board writes require the book's base `updatedAt`, and use the existing atomic compare-and-swap update. Board and manuscript edits share the existing DraftStore: local recovery, debounced and serialized saves, visible save errors, explicit retry, unload protection, and downloadable JSON backups. A conflict never silently overwrites another session. A stale recovery draft must be downloaded for comparison when its server base has changed.

## Verification

- Frontend TypeScript and Vite production build passed.
- Shared and backend TypeScript build: `node frontend/node_modules/typescript/bin/tsc -b shared backend` passed.
- Full frontend lint passed with seven existing warnings and no errors.
- `node --test scripts/task-board.test.cjs scripts/writing-studio.test.cjs`: 10 passed (ordering, empty-list moves, isolation, recovery, schema round trip and validation, serialized and failed saves, export).
- Book controller Jest suite: 7 passed, including ownership scoping, missing versions, stale writes, atomic conflicts, and protection of manuscript content.
- Task board browser test passed: More-menu navigation, task details, checklists, labels, dates, refresh persistence, keyboard list sorting, custom lists, pointer card movement, mobile containment, deletion, and return to the manuscript.
- Existing manuscript browser regression passed: writing, recovery, organization, export, library, and responsive layouts.
- Desktop and mobile screenshots are in `screenshots/` and were visually inspected.

Browser/Supertest checks use a local fixture and required unsandboxed loopback/browser access in this environment. They do not access production. Existing installed dependencies are linked into this worktree; no dependency or lockfile changes were necessary.

## Limits

Descriptions are multiline plain text. Labels are customized per card. Storage uses the existing whole-book save path, so simultaneous sessions editing tasks and manuscript can produce a visible version conflict. No live MongoDB round-trip or physical iOS/Android touch-device testing was performed; persistence was verified through schema round trips and the browser's version-checked fixture API. Browser build warnings about existing large chunks and outdated Browserslist data remain.
