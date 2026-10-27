# Desktop reader conversation tabs

Implementation: `main` (initially developed on `codex/desktop-chat-tabs`). The tab strip appears at viewport widths of 1100 CSS pixels and above. Below that, the existing single visible conversation layout remains available.

`ReaderChatWorkspace` owns independent tab state and requests for one account and book. `useReaderChat` adapts that store to React with `useSyncExternalStore`; it lives in the book controller, outside the conditional chat panel. Switching tabs or closing the panel does not cancel requests. Closing a tab does not delete a conversation. A separate confirmed delete action remains in the searchable conversation drawer.

The workspace stores open tab order, active tab, drafts, selected passages, spoiler preferences, read markers, scroll positions and panel width under an account/book-specific local-storage key. Saved message transcripts are loaded from the existing server API, not duplicated in storage. Pending request metadata is retained to reconcile responses after reload or retry the same request ID and original reading boundary. Restoration never automatically resends a message. The former active-conversation key is migrated when no workspace is present.

Sending is locked independently per conversation. The UI admits up to three in-flight sends in one workspace; this is a local UI guard, not an account-wide server concurrency quota. The server's existing rate limits, ownership checks and conversation locks remain in force. Provider capacity and production AI calls have not been load-tested by this change.

The implementation keeps the existing quote presentation, selection-only questions, follow-up source links, summary notices and retry semantics. Asking about a newly selected passage opens another tab and preserves existing drafts. A pristine empty tab is reused. RTL/LTR arrow navigation, Home/End, Delete to close a focused tab, modal focus management, background-answer indicators, and pointer/keyboard panel resizing are included. Browser Ctrl+T/Ctrl+W shortcuts are untouched.

Chat, table of contents, search and settings share `ReaderPanelResize` and one preferred width for the current account and book. Resizing any panel updates the width used by all the others; switching panels or reloading retains it. The common minimum is 440px, with a default of 480px. The width is stored as `panelWidth` in browser localStorage, not in the database, and does not sync between devices. Existing installations reuse their saved chat width as the shared width; obsolete per-panel widths are dropped on the next save.

On desktop resizing has two stages. Up to 760px, widening the chat reduces the reader's width as in the original split layout. Once the chat reaches 760px, the reader's position and width stop changing; additional chat width overlays the book up to the workspace edge. On narrower desktops the split stage stops earlier if needed to retain the existing 480px minimum reader width. Dragging back below the split threshold resumes resizing both panes. Preferred chat width is saved locally and clamped visually to the available workspace, with pointer, Arrow keys, Home and End using the same rules. The sheet close button remains layered above the positioned chat content so the visible control receives clicks.

## Validation

- `node --test scripts/reader-chat.test.cjs scripts/reader-chat-workspace.test.cjs scripts/reader-chat-presentation.test.cjs`
- `node --test scripts/reader-chat-tabs.browser.test.cjs scripts/reader-chat-quotes.browser.test.cjs`
- `npm run build` in `frontend`
- ESLint on the changed TypeScript files.

The browser suites run real React components and the real hook against intercepted reader API responses, in English and Hebrew, including desktop widths 1100/1280/1440/1920 and a mobile layout regression check. Set `PLAYWRIGHT_MODULE` to an installed Playwright package and optionally `CHAT_TABS_SCREENSHOT_DIR` for screenshots. They require an installed Edge browser by default; `PLAYWRIGHT_CHANNEL` can override it. No live AI request is issued.

The initial tabs implementation started at `fb9dd8b` in an isolated worktree and preserved the reader quote presentation changes. It was subsequently merged into `main`; the shared resizing updates are maintained on `main`.


## Split tab groups

Desktop now supports one or two tab groups. The Split beside action creates an empty second group and ensures at least 720px for two readable columns. Each group owns its selected tab, while the workspace owns the focused group and internal ratio. Only AI conversations are internal tabs. Book search, contents and reading settings remain standalone panels with their original simple views; they share only the outer width and resize behavior with chat. Normal opening focuses an existing tab; Open beside or Move beside moves it explicitly without making a duplicate. Closing the last tab collapses that group; undo recreates it. Merge keeps all tabs and the focused selection.

Group layout and ratio are stored with the existing account/book localStorage record; older records migrate into one group, preserving tab order and the shared outer width. The original two-stage outer resize remains: split resizing through 760px (or the responsive minimum-reader bound), then overlay expansion. The internal separator only redistributes space within the panel.

`ReaderWorkspace` renders a stable keyed list of views into a grid. Moving a tab changes its grid position rather than unmounting it, so conversation drafts and scroll state survive movement and selection changes. Conversation actions are bound to a specific tab key. Both visible conversations are tracked as visible independently of focus; responses to hidden/closed tabs retain unread markers. Mobile uses the original single-view panel while retaining the desktop group layout.

Additional validation: `node --test scripts/reader-split-groups.browser.test.cjs` exercises two real visible chats, independent requests and focus, native tab dragging, standalone book-panel isolation, split/merge/undo, restore, internal resize, four desktop widths, and mobile fallback in English and Hebrew. The browser fixture uses intercepted server responses and a deterministic book search document, not a live AI provider.
