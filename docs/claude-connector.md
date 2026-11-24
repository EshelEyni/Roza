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
| `staging_room_projects` | Add pending changes to a staged book: new drafts, Main edits, new chapters, chapter summaries, planning and settings, story elements, notes, new tasks and task edits. Read the copy of the live book kept on the row. Start a staged book for a new book. |
| `staging_room_backups` | Not used by Claude's tools. The Staging Room adds backups here before every approval and discard. |
| `staging_room_preferences` | Not used by Claude's tools. |
| `mcp_oauth_clients`, `mcp_oauth_grants` | The connector's own sign-in records. No tool reaches them. |
| `mcp_audit_log` | A record of every change. Add only. |

Not opened at all: `books`, `users`, `book_reviews`, every `reader_*` collection, and everything else.

### Staging Room: Claude adds, you approve

Staging Room works like suggestions on top of the live book (see [staging-room-prd.md](staging-room-prd.md)). Claude never changes the live book. It adds **pending changes**, and you approve or discard each one in the Staging Room:

- **Chapter text** goes into a new draft by default (`staging_write_draft`). Saving again updates the same draft, so you can work with Claude step by step and watch the text change in the Staging Room. On approval it becomes a normal draft in Writing Studio; Main is not touched.
- **Main** changes only when you ask Claude for it (`staging_edit_main`). If you change Main in Writing Studio before approving, the approval adds Claude's version as a draft instead, so your work is never overwritten.
- **Small edits** don't resend the chapter. Claude copies Main into a new pending draft (`staging_copy_draft`), then changes sentences with find/replace (`staging_edit_text`). Each `find` must match exactly once, or nothing is saved. Paragraphs the edit doesn't touch keep their exact layout, including centered `* * *` breaks and screenplay types.
- **Notes follow the text.** After a text change, each note is found again by its quote. A note whose quote is gone becomes a general note on the chapter, and Claude is told which ones. Notes are never removed.
- **New chapters, story elements, notes and tasks** are added on approval.
- **Nothing is deleted.** There is no tool that removes anything.

Markdown is a convenient way to write text, but it can't hold alignment or screenplay layout. For screenplays, Claude reads with `view: "full"` and sends Slate nodes, or uses `staging_edit_text`, which keeps the layout.

Claude can read only Main and pending changes. Drafts already in Writing Studio show only by name, so they can't be copied or edited through these tools.

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
| `staging_get_chapter` | Reads a chapter's Main text and its notes, pending texts, summary (the Bible's Summary tab), planning links and pending chapter changes. Can read one version (Main, a pending draft or a Writing Studio draft), a paragraph range, or paragraphs that match a search. |
| `staging_get_elements` | Reads the text of characters, themes, plotlines or notes, with any pending change to each. |
| `staging_create_project` | Starts a staged book that is not in Writing Studio yet. |
| `staging_write_draft` | Saves chapter text as a pending draft (the default for text). |
| `staging_edit_main` | Saves a pending Main edit, only when the author asks. |
| `staging_edit_text` | Find/replace on a pending draft or Main (up to 50 edits per call, with `dryRun` preview). |
| `staging_copy_draft` | Starts a pending draft as a copy of Main, a pending draft or a Writing Studio draft, optionally with its notes. |
| `staging_add_chapter` | Adds a pending new chapter. |
| `staging_set_element` | Adds or changes a character, theme, plotline or note. |
| `staging_set_summary` | Proposes a new chapter summary. The author approves it in the Staging Room. |
| `staging_set_planning` | Proposes a chapter's links to characters, themes and plotlines, each with a note. |
| `staging_update_chapter` | Proposes a new title, place or format (prose or screenplay) for a chapter. |
| `staging_add_notes` | Adds notes to a chapter's Main text. |
| `staging_add_tasks` | Adds tasks to the book's task board or to a chapter's own board, with a list, due date and checklist. |
| `staging_get_tasks` | Reads the book's task board and the chapters' own boards. |
| `staging_update_task` | Proposes changes to an existing task: title, description, done, due date, checklist or list. |
