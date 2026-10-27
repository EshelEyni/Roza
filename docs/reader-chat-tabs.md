# Desktop reader conversation tabs

Branch: `codex/desktop-chat-tabs`. The tab strip appears at viewport widths of 1100 CSS pixels and above. Below that, the existing single visible conversation layout remains available.

`ReaderChatWorkspace` owns independent tab state and requests for one account and book. `useReaderChat` adapts that store to React with `useSyncExternalStore`; it lives in the book controller, outside the conditional chat panel. Switching tabs or closing the panel does not cancel requests. Closing a tab does not delete a conversation. A separate confirmed delete action remains in the searchable conversation drawer.

The workspace stores open tab order, active tab, drafts, selected passages, spoiler preferences, read markers, scroll positions and panel width under an account/book-specific local-storage key. Saved message transcripts are loaded from the existing server API, not duplicated in storage. Pending request metadata is retained to reconcile responses after reload or retry the same request ID and original reading boundary. Restoration never automatically resends a message. The former active-conversation key is migrated when no workspace is present.

Sending is locked independently per conversation. The UI admits up to three in-flight sends in one workspace; this is a local UI guard, not an account-wide server concurrency quota. The server's existing rate limits, ownership checks and conversation locks remain in force. Provider capacity and production AI calls have not been load-tested by this change.

The implementation keeps the existing quote presentation, selection-only questions, follow-up source links, summary notices and retry semantics. Asking about a newly selected passage opens another tab and preserves existing drafts. A pristine empty tab is reused. RTL/LTR arrow navigation, Home/End, Delete to close a focused tab, modal focus management, background-answer indicators, and pointer/keyboard panel resizing are included. Browser Ctrl+T/Ctrl+W shortcuts are untouched.

## Validation

- `node --test scripts/reader-chat.test.cjs scripts/reader-chat-workspace.test.cjs scripts/reader-chat-presentation.test.cjs`
- `node --test scripts/reader-chat-tabs.browser.test.cjs scripts/reader-chat-quotes.browser.test.cjs`
- `npm run build` in `frontend`
- ESLint on the changed TypeScript files.

The browser suites run real React components and the real hook against intercepted reader API responses, in English and Hebrew, including desktop widths 1100/1280/1440/1920 and a mobile layout regression check. Set `PLAYWRIGHT_MODULE` to an installed Playwright package and optionally `CHAT_TABS_SCREENSHOT_DIR` for screenshots. They require an installed Edge browser by default; `PLAYWRIGHT_CHANNEL` can override it. No live AI request is issued.

This isolated worktree starts at `fb9dd8b` and includes the previously uncommitted reader quote presentation changes copied from the primary checkout. The primary checkout and `main` have not been modified by this implementation.
