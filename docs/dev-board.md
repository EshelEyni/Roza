# Dev Board

Sign in to ROZA as an administrator and select **Dev Board**. Tickets, Trash, and attachment contents are stored in MongoDB for the signed-in account. The desktop profile contains only cached copies of attachments you reveal or open in File Explorer.

## Migrate an existing board

In ROZA Desktop, choose **Import ticket folder** and select the original directory containing `tickets.json` and `attachments/`. By default desktop development discovers a sibling `ticket-master/data` directory. Set `ROZA_DEV_BOARD_IMPORT_DIR` to an absolute directory and restart ROZA Desktop to configure a persistent source in any build.

Upload the board while signed in as the account that should own the data. Import preserves ticket IDs, Markdown, project names, Trash timestamps, and attachment filenames. You can repeat the import. Already imported tickets and identical attachments are reused. An import reports conflicts instead of overwriting a ticket edited in Dev Board or an existing attachment with different contents. Import leaves the original folder intact.

## Agent-written tickets

An agent can write UTF-8 JSON into the configured import directory. Keep desktop Dev Board open so it checks the source every few seconds. Use this structure:

```json
{
  "version": 1,
  "tickets": [
    {
      "id": "roza-123",
      "number": 123,
      "project": "ROZA App",
      "title": "Describe the change",
      "status": "Open",
      "priority": "",
      "scope": "",
      "repository": "C:\\dev\\Roza",
      "markdown": "# ROZA App — Ticket #123\n\n## Describe the change",
      "deletedAt": null
    }
  ]
}
```

Read the latest source before changing it. Use a stable, unique ID and write a complete valid file by replacing it atomically. Source edits apply to imported tickets until they are edited in Dev Board. After that, use the board to edit them. Removing a row from the source does not delete the database ticket. Use Trash to remove it from the active board.

To remove a ticket permanently, open it in Trash and choose **Delete forever**. This deletes the ticket and its attachments from MongoDB and cannot be undone. ROZA remembers the deleted ID, so a later import skips that ticket even if it is still in `tickets.json`.

To import attachments, put the files under `attachments/<SHA-256 of the ticket ID>/` next to `tickets.json`. Attachments are limited to 12 MiB each. In ROZA Desktop, **Add files** uploads selected files to the ticket. **Open folder** and **Show in Explorer** materialize a local copy. HTML attachments are revealed in Explorer and can be handed off without executing them in ROZA.
