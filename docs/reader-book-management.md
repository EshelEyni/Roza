# Reader book management (ticket 35)

The library action menu supports Rename for active and archived books. Titles are trimmed and limited to 1–500 characters on the server. Only the title field is updated. Existing archive and restore endpoints retain their behavior.

DELETE /api/reader/:id permanently deletes an owned, archived book. Authentication and reader access middleware apply. The database operation also requires archived: true; active and foreign books return 404. The UI exposes this action only in Archived Books, identifies the book in an irreversible-deletion confirmation, and retains the dialog with an error on failure.

Book data and GridFS files/chunks are removed in one MongoDB transaction. MongoDB must support transactions (a replica set or sharded cluster). A standalone server cannot complete permanent deletion; failures leave the archive intact. No production configuration is changed by this ticket.

Annotations, flags, embedded reading progress, conversations (including embedded messages), and lookup events are removed. Vocabulary used only by this book is removed; shared vocabulary retains other book associations and recomputes counts, forms, and lookup dates from remaining events. Both EPUB file references are checked across all users and both file fields before bytes are deleted.

## Validation

- Backend: node backend/node_modules/jest/bin/jest.js --config backend/jest.config.ts --runInBand --watchAll=false --testPathPattern=readerBookManagement
- Runtime: node --test scripts/reader-progress-runtime.test.cjs
- TypeScript: node backend/node_modules/typescript/bin/tsc -b shared backend; node frontend/node_modules/typescript/bin/tsc -b frontend
- Browser: node --test scripts/reader-book-management.browser.test.cjs (Playwright with Edge/Chromium and WebKit installed; PLAYWRIGHT_MODULE can point to an existing Playwright installation).
- Database: node --test scripts/reader-book-management.integration.test.cjs (mongodb-memory-server installed or MONGODB_MEMORY_SERVER_MODULE set to its path). Uses its own ephemeral replica set, never an application database. Covers actual persistence, retained related data, archive/restore, owner and archived guards, exclusive/shared vocabulary and files, and rollback after an injected cleanup failure.

Browser tests use the actual menu, grid, dialogs, API client, and React Query cache with mocked HTTP responses on desktop Chromium and iPhone-sized WebKit. Database tests exercise the actual controllers, models, GridFS storage, and deletion service against MongoDB.
