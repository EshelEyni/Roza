# Staging Room

Sign in to ROZA as an administrator and open **Staging Room** from the main navigation. It works in the browser and ROZA Desktop.

Staged projects, sync fingerprints, list preferences, and new snapshots are stored in the connected ROZA MongoDB database. Compare, Pull, and Push use the live manuscripts in that same environment. Projects and preferences belong to the signed-in administrator.

## Same fields as the Writing Studio

Staging Room checks and writes books with the Writing Studio's own book schema (`backend/src/models/books/schemas`). A staged book holds the same fields as a Writing Studio book:

- **Book:** name, owner, language, word goal, task board, publishing settings, audiobook narrator, characters, themes, plotlines and notes.
- **Chapters:** number, name, format, description, text, planning links, chapter notes, drafts (with kind and summary), `mainSourceDraftId` and the task board.

Compare, Pull and Push cover all of these. The book settings (name, word goal, task board, publishing settings and narrator) sync together under **Book settings**. A field the staged book leaves out is not tracked, and Push leaves the live version alone. For word goal, publishing and narrator, `null` removes the field from the live book on Push.

Three things differ by design. Story elements and planning links are matched by name, not by id. Archived chapters and story elements are not staged. Display settings (`filterBy`, `isReadMode`) are not synced.

## Import legacy projects

Select **Import folder** and choose the old `books` folder or a single project folder. ROZA imports `book.json`, JSON chapter files, and `.publish-state.json` when present. Importing again skips project names that already exist for your account. Keep your legacy folder as an archive for old filesystem backups and plain-text chapter copies. ROZA does not read from that folder after import.

Agents can submit a project through the authenticated `POST /api/staging-room/projects/import` endpoint. Send a JSON object with a `project` string containing serialized JSON with `slug`, `book`, and a `chapters` array of `{ file, data }` entries. For edits, read `GET /api/staging-room/projects/:slug/draft` and send `PUT` to the same URL with the returned `revision` and a `project` string containing the edited book and full chapter list. A stale revision is rejected. Both endpoints change staged data only. Push remains a separate action.

MongoDB creates `staging_room_projects`, `staging_room_preferences`, and `staging_room_backups` when their first records are written. No desktop profile file, environment variable, or database connection string on the client is required.
