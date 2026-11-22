# Claude connector (Ticket #75)

The same Roza MCP endpoint also supports [ChatGPT and Codex](roza-openai-mcp.md).

The Claude connector lets Claude work on your **Dev Board** and **Staging Room** from any Claude app: web, desktop or phone. For example: "add a ticket for the reader bug", or "tighten the dialogue in chapter 3 of My Lost Time".

Claude cannot reach anything else. It cannot change the live books (Writing Studio), your account, users, reviews or the reader. It cannot delete anything. It reads a staged book through a copy that the ROZA backend keeps on the staging row; its database user never opens `books`.

The connector is a small MCP server inside the ROZA backend, at `/mcp`. It is off until its environment variables are set.

## What Claude can change

These are the only collections the connector opens:

| Collection | What Claude can do |
| --- | --- |
| `dev_board_tickets` | Create tickets, edit any field or the Markdown, move to Trash and restore. Trash keeps the ticket. |
| `dev_board_attachments` | Add files to a ticket and read them. A taken name is saved as `name (2).ext`. Nothing is overwritten. |
| `staging_room_projects` | Add pending changes to a staged book: new drafts, Main edits, new chapters, story elements, notes and tasks. Read the copy of the live book kept on the row. Start a staged book for a new book. |
| `staging_room_backups` | Not used by Claude's tools. The Staging Room adds backups here before every approval and discard. |
| `staging_room_preferences` | Not used by Claude's tools. |
| `mcp_oauth_clients`, `mcp_oauth_grants` | The connector's own sign-in records. No tool reaches them. |
| `mcp_audit_log` | A record of every change. Add only. |

Not opened at all: `books`, `users`, `book_reviews`, every `reader_*` collection, and everything else.

### Staging Room: Claude adds, you approve

Staging Room works like suggestions on top of the live book (see [staging-room-prd.md](staging-room-prd.md)). Claude never changes the live book. It adds **pending changes**, and you approve or discard each one in the Staging Room:

- **Chapter text** goes into a new draft by default (`staging_write_draft`). Saving again updates the same draft, so you can work with Claude step by step and watch the text change in the Staging Room. On approval it becomes a normal draft in Writing Studio; Main is not touched.
- **Main** changes only when you ask Claude for it (`staging_edit_main`). If you change Main in Writing Studio before approving, the approval adds Claude's version as a draft instead, so your work is never overwritten.
- **New chapters, story elements, notes and tasks** are added on approval.
- **Nothing is deleted.** There is no tool that removes anything.

Markdown is a convenient way to write text, but it can't hold alignment or screenplay layout. For screenplays, Claude reads with `view: "full"` and sends Slate nodes.

### Undo

- **Staging Room:** discard a change you don't want. Approving backs up the live book first, in `staging_room_backups`.
- **Dev Board:** Trash only sets a flag. Ask Claude to restore the ticket, or restore it in the Dev Board.

## Tools

| Tool | What it does |
| --- | --- |
| `devboard_list_tickets` | Lists tickets. Trash is hidden unless asked. |
| `devboard_get_ticket` | Reads a ticket and its Markdown. |
| `devboard_create_ticket` | Creates a ticket. |
| `devboard_update_ticket` | Changes some fields of a ticket. |
| `devboard_set_trash` | Moves a ticket to Trash or restores it. |
| `devboard_add_attachment` | Adds a text or base64 file (up to 600 KB). |
| `devboard_read_attachment` | Reads a file. |
| `staging_list_projects` | Lists staged books and how many changes wait. |
| `staging_get_project` | Reads the live book's outline and the waiting changes. |
| `staging_get_chapter` | Reads a chapter's Main text, plus Claude's pending draft for it. |
| `staging_create_project` | Starts a staged book that is not in Writing Studio yet. |
| `staging_write_draft` | Saves chapter text as a pending draft (the default for text). |
| `staging_edit_main` | Saves a pending Main edit, only when the author asks. |
| `staging_add_chapter` | Adds a pending new chapter. |
| `staging_set_element` | Adds or changes a character, theme, plotline or note. |
| `staging_add_notes` | Adds notes to a chapter's Main text. |
| `staging_add_tasks` | Adds tasks to the book's task board. |
