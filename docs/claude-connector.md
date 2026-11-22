# Claude connector (Ticket #75)

The Claude connector lets Claude work on your **Dev Board** and **Staging Room** from any Claude app: web, desktop or phone. For example: "add a ticket for the reader bug", or "save this as chapter 5 of the My Lost Time project".

Claude cannot reach anything else. It cannot read or change the live books (Writing Studio), your account, users, reviews or the reader. It cannot permanently delete anything.

The connector is a small MCP server inside the ROZA backend, at `/mcp`. It is off until its environment variables are set.

## What Claude can change

These are the only collections the connector opens:

| Collection | What Claude can do |
| --- | --- |
| `dev_board_tickets` | Create tickets, edit any field or the Markdown, move to Trash and restore. Trash keeps the ticket. |
| `dev_board_attachments` | Add files to a ticket and read them. A taken name is saved as `name (2).ext`. Nothing is overwritten. |
| `staging_room_projects` | Create staged projects. Edit book details, characters, themes, plotlines, notes and the task board. Add, replace, rename, reorder and remove staged chapters. |
| `staging_room_backups` | Add a backup before every replace, edit or removal. Read and restore Claude's backups. Backups are never changed or deleted. |
| `staging_room_preferences` | Set the project list order and hidden projects. |
| `mcp_oauth_clients`, `mcp_oauth_grants` | The connector's own sign-in records. No tool reaches them. |
| `mcp_audit_log` | A record of every change. Add only. |

Not opened at all: `books`, `users`, `book_reviews`, every `reader_*` collection, and everything else.

### Staging Room changes stay staged

Claude only edits the staged copy. To move the changes into the live book, open the project in the Staging Room, click **Compare**, review it, and **Push**. Claude has no Push or Pull tool. Pull reads the live books, so Claude has no Pull either.

Claude also cannot set the staged project's prod-edit directives (`replaceText`, `archiveInProd`, `syncChapterOrder`). They change the live book on Push, so they stay in your hands.

### Undo

- **Staging Room:** every replace, edit or removal first saves the old version to `staging_room_backups`. Ask Claude to "list the backups" and "restore" one. Restoring backs up the current version first.
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
| `staging_list_projects` | Lists staged projects and list preferences. |
| `staging_get_project` | Reads book details and the chapter list. |
| `staging_get_chapter` | Reads a chapter as Markdown. |
| `staging_create_project` | Creates an empty staged project. |
| `staging_save_chapter` | Saves Markdown as a chapter: `create` refuses if the number exists; `replace` overwrites after a backup. |
| `staging_update_chapter` | Changes a chapter's title or description. |
| `staging_remove_chapter` | Removes a chapter from the staged project, after a backup. |
| `staging_set_chapter_order` | Renumbers chapters. |
| `staging_update_book` | Changes book details, characters, themes, plotlines, notes, task board. |
| `staging_set_preferences` | Sets the project list order and hidden projects. |
| `staging_list_backups` | Lists a project's backups. |
| `staging_restore_backup` | Restores a chapter or book details from one of Claude's backups. |

### Formatting

Claude writes chapters in Markdown. ROZA converts them to its editor format:

| Markdown | In ROZA |
| --- | --- |
| `# Title` | Heading 1 |
| `## Title` (or deeper) | Heading 2 |
| `> text` | Block quote |
| `- item`, `1. item` | Bulleted or numbered list |
| `**bold**`, `*italic*`, `***both***` | Bold, italic |
| `<u>text</u>` | Underline |
| `***` or `---` on its own line | Centered scene break `* * *` |

Every non-empty line becomes its own paragraph. This keeps line breaks in dialogue and verse. Screenplay chapters cannot be replaced through Claude.

## Security

- **Sign-in:** OAuth 2.1 with PKCE (S256). Claude opens a ROZA page that asks for the **connector passphrase** (`MCP_PASSPHRASE`). This is not your ROZA password. The connector never reads the `users` collection. Everything it does belongs to `MCP_OWNER_USER_ID`. Only 10 passphrase attempts are allowed per 15 minutes.
- **Redirects:** Only Claude's callback (`https://claude.ai/api/mcp/auth_callback`, and the `claude.com` one) and local loopback addresses can register. Add others with `MCP_EXTRA_REDIRECT_URIS`.
- **Tokens:** Access tokens last 1 hour. Refresh tokens last 30 days and work only once. The database stores only HMACs of tokens.
- **Limits:** The `/mcp` body limit is 1 MB. Changes are limited to 60 per 15 minutes. Requests to `/mcp` and `/oauth/*` are rate-limited per IP.
- **Audit log:** Every change, refusal and error goes to `mcp_audit_log` and the server log: time, tool, target, outcome.
- **Own database user:** The connector connects with its own MongoDB user (`MCP_DB_URL`). That user only has permissions on the collections above, so even a bug cannot reach the rest.

## Setup

### 1. Create the connector's MongoDB user (Atlas)

In Atlas, open **Database Access → Custom Roles** and add a role named `roza-connector`. Add these actions on the production database (`PROD_DB_NAME`):

| Collection | Actions |
| --- | --- |
| `dev_board_tickets` | `find`, `insert`, `update` |
| `dev_board_attachments` | `find`, `insert` |
| `staging_room_projects` | `find`, `insert`, `update` |
| `staging_room_backups` | `find`, `insert` |
| `staging_room_preferences` | `find`, `insert`, `update` |
| `mcp_oauth_clients` | `find`, `insert`, `update`, `remove`, `createIndex` |
| `mcp_oauth_grants` | `find`, `insert`, `update`, `remove`, `createIndex` |
| `mcp_audit_log` | `insert` |

`remove` appears only on the connector's own sign-in collections. Used sign-in codes and rotated tokens are removed there. Do not give the role any built-in role such as `readWrite`, and add nothing for `books` or `users`.

Then add a database user (for example `roza-connector`) with only this custom role. Use a long random password.

### 2. Set the environment variables

Add these to the production env file (the one `ROZA_ENV_FILE` points to on the server):

```dotenv
# Connection string for the connector's own MongoDB user
MCP_DB_URL=mongodb+srv://roza-connector:<password>@<cluster>/?retryWrites=true&w=majority
# Public HTTPS origin of ROZA, without a trailing slash
MCP_PUBLIC_URL=https://roza.esheleyni.com
# 32+ random characters. Changing it revokes every connector token.
MCP_TOKEN_SECRET=<random secret>
# 16+ characters. You type it once when you connect Claude.
MCP_PASSPHRASE=<passphrase>
# Your ROZA user id (24 hex characters). Tickets and staged projects belong to it.
MCP_OWNER_USER_ID=<your user id>
# Optional: database name. Defaults to PROD_DB_NAME / DEV_DB_NAME / TEST_DB_NAME by NODE_ENV.
# MCP_DB_NAME=
# Optional: extra allowed OAuth redirect URIs, comma-separated.
# MCP_EXTRA_REDIRECT_URIS=
```

Generate the secret and the passphrase with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Your user id is the `_id` of your document in `users`. It is also the `owner` field on your Dev Board tickets and staged projects.

If any of the five required variables is missing or too short, the connector stays off and ROZA runs as before.

### 3. Deploy

Deploy ROZA as usual (see [manual-deployment.md](manual-deployment.md)). The existing nginx serves HTTPS on port 443, which Claude requires. nginx must pass `/mcp`, `/oauth/*`, `/.well-known/oauth-protected-resource*` and `/.well-known/oauth-authorization-server*` to the app. A catch-all `location /` already does this.

Check it is up:

```powershell
curl.exe https://roza.esheleyni.com/.well-known/oauth-protected-resource/mcp
```

It should return JSON with `"resource": "https://roza.esheleyni.com/mcp"`.

### 4. Add the connector in Claude

1. In Claude (web or desktop), open **Settings → Connectors → Add custom connector**.
2. Name it `ROZA`. Set the URL to `https://roza.esheleyni.com/mcp`.
3. Click **Connect**. A ROZA page opens. Enter the connector passphrase and click **Allow**.
4. In a chat, enable ROZA from the tools menu. Try "show my Dev Board tickets".

Claude connects to ROZA from Anthropic's cloud for every Claude app, including the phone apps. After adding the connector on the web, open the phone app and check that ROZA appears in a chat's tools menu.

## Testing

- Converter unit tests: `npx jest src/mcp/slateMarkdown` (in `backend/`).
- End-to-end test against a real database. It covers sign-in, every tool, refusals, backups and restore, the body limit and token rotation. It also checks that the connector never opens a collection outside the list above. It refuses to run on a database whose name contains `prod`:

  ```powershell
  cd backend; $env:MCP_INTEGRATION_DB_URL="<test db url>"; $env:MCP_INTEGRATION_DB_NAME="test_roza_db"; npx jest src/mcp/connector.integration
  ```

- Development runtime loading: `node --test scripts/claude-connector-runtime.test.cjs`.

## Revoking access and rotating keys

- **Disconnect Claude:** remove the connector in Claude's settings. Its tokens expire on their own (1 hour for access, 30 days for refresh).
- **Revoke every token now:** change `MCP_TOKEN_SECRET` and restart ROZA. All tokens stop working, and Claude asks for the passphrase again. Old rows in `mcp_oauth_grants` expire on their own.
- **Change the passphrase:** change `MCP_PASSPHRASE` and restart. Existing tokens keep working. To also cut them off, change `MCP_TOKEN_SECRET` at the same time.
- **Rotate the database password:** change the `roza-connector` user's password in Atlas, update `MCP_DB_URL`, then restart ROZA.
- **Turn the connector off:** remove any required `MCP_*` variable and restart. `/mcp` then returns 404.

## Code

- [backend/src/mcp/connectorRouter.ts](../backend/src/mcp/connectorRouter.ts): mounts OAuth and `/mcp`, reads the env vars, passphrase sign-in.
- [backend/src/mcp/oauth.ts](../backend/src/mcp/oauth.ts): OAuth server, sign-in page, bearer check.
- [backend/src/mcp/mcpServer.ts](../backend/src/mcp/mcpServer.ts): the tools, write rate limit, audit log.
- [backend/src/mcp/devBoardStore.ts](../backend/src/mcp/devBoardStore.ts): Dev Board reads and writes.
- [backend/src/mcp/stagingStore.ts](../backend/src/mcp/stagingStore.ts): Staging Room reads, writes and backups.
- [backend/src/mcp/slateMarkdown.ts](../backend/src/mcp/slateMarkdown.ts): Markdown ↔ Slate conversion.
- [backend/src/mcp/connectorDb.ts](../backend/src/mcp/connectorDb.ts): the connector's own connection and the full list of collections it may open.
