# Desktop reader conversation tabs

Implementation: `main` (initially developed on `codex/desktop-chat-tabs`). The tab strip appears at viewport widths of 1100 CSS pixels and above. Below that, the existing single visible conversation layout remains available.

`ReaderChatWorkspace` owns independent tab state and requests for one account and book. `useReaderChat` adapts that store to React with `useSyncExternalStore`; it lives in the book controller, outside the conditional chat panel. Switching tabs or closing the panel does not cancel requests. Closing a tab does not delete a conversation. A separate confirmed delete action remains in the searchable conversation drawer.

The workspace stores open tab order, active tab, drafts, selected passages, spoiler preferences, read markers, scroll positions and panel width under an account/book-specific local-storage key. Saved message transcripts are loaded from the existing server API, not duplicated in storage. Pending request metadata is retained to reconcile responses after reload or retry the same request ID and original reading boundary. Restoration never automatically resends a message. The former active-conversation key is migrated when no workspace is present.

Sending is locked independently per conversation. The UI admits up to three in-flight sends in one workspace; this is a local UI guard, not an account-wide server concurrency quota. The server's existing rate limits, ownership checks and conversation locks remain in force. Provider capacity and production AI calls have not been load-tested by this change.

The implementation keeps the existing quote presentation, selection-only questions, follow-up source links, summary notices and retry semantics. Asking about a newly selected passage opens another tab and preserves existing drafts. A pristine empty tab is reused. RTL/LTR arrow navigation, Home/End, Delete to close a focused tab, modal focus management, background-answer indicators, and pointer/keyboard panel resizing are included. Browser Ctrl+T/Ctrl+W shortcuts are untouched.

Chat, table of contents, search and settings share `ReaderPanelResize` and the same desktop behavior. Each panel retains its own preferred width locally for the current account and book. These panel widths are in browser localStorage, not in the database, and do not sync between devices. Existing chat widths are preserved when upgrading; other panels start at their original widths (285px for contents/settings and 360px for search).

On desktop resizing has two stages. Up to 760px, widening the chat reduces the reader's width as in the original split layout. Once the chat reaches 760px, the reader's position and width stop changing; additional chat width overlays the book up to the workspace edge. On narrower desktops the split stage stops earlier if needed to retain the existing 480px minimum reader width. Dragging back below the split threshold resumes resizing both panes. Preferred chat width is saved locally and clamped visually to the available workspace, with pointer, Arrow keys, Home and End using the same rules. The sheet close button remains layered above the positioned chat content so the visible control receives clicks.

## Validation

- `node --test scripts/reader-chat.test.cjs scripts/reader-chat-workspace.test.cjs scripts/reader-chat-presentation.test.cjs`
- `node --test scripts/reader-chat-tabs.browser.test.cjs scripts/reader-chat-quotes.browser.test.cjs`
- `npm run build` in `frontend`
- ESLint on the changed TypeScript files.

The browser suites run real React components and the real hook against intercepted reader API responses, in English and Hebrew, including desktop widths 1100/1280/1440/1920 and a mobile layout regression check. Set `PLAYWRIGHT_MODULE` to an installed Playwright package and optionally `CHAT_TABS_SCREENSHOT_DIR` for screenshots. They require an installed Edge browser by default; `PLAYWRIGHT_CHANNEL` can override it. No live AI request is issued.

The initial tabs implementation started at `fb9dd8b` in an isolated worktree and preserved the reader quote presentation changes. It was subsequently merged into `main`; the shared resizing updates are maintained on `main`.
