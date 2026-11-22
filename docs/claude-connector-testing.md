# Testing the Claude connector

This guide tests the connector in four stages. Each stage builds on the one before.

1. **Automated tests** (5 minutes). Checks the code.
2. **Local test with Claude Code** (20 minutes). Real Claude, your PC, the dev database.
3. **Phone test through a tunnel** (optional, 20 minutes). Real Claude app, still the dev database.
4. **Production check** (after you deploy).

Stages 1–3 use the dev database (`dev_roza_db`) and never touch production.

---

## Stage 1: Automated tests

In PowerShell, from `C:\dev\Roza\backend`:

```powershell
npx jest --watchAll=false src/mcp/slateMarkdown
```

Expected: 5 tests pass. This checks the Markdown ↔ ROZA text conversion.

Next, run the end-to-end test. It uses `test_roza_db` and cleans up after itself:

```powershell
$env:NODE_ENV="test"; $env:MCP_INTEGRATION_DB_URL=(node -e "require('dotenv').config();process.stdout.write(process.env.DB_URL)"); $env:MCP_INTEGRATION_DB_NAME="test_roza_db"; npx jest --watchAll=false src/mcp/connector.integration
```

Expected: 7 tests pass. They cover sign-in, every tool, refusals, backups and restore, and the size limit. They also confirm that `books` and `users` are never opened.

Then check that the dev server can load the connector. Run this from `C:\dev\Roza`:

```powershell
node --test scripts/claude-connector-runtime.test.cjs
```

Expected: `pass 1`.

---

## Stage 2: Local test with Claude Code

Claude Code can connect to `http://localhost`, so you can test with real Claude before deploying anything.

### 2.1 Create a restricted database user for dev

This step also proves that the permissions work.

1. In Atlas, open **Database Access → Custom Roles → Add New Custom Role**.
2. Name it `roza-connector-dev`.
3. Add these actions, each on database `dev_roza_db` and the named collection:

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

4. Open **Database Access → Add New Database User**. Name it `roza-connector-dev`, give it a password, and choose only the `roza-connector-dev` custom role.
5. Copy your normal `DB_URL` and replace the user name and password with the new ones. This is your `MCP_DB_URL`.

### 2.2 Find your user id in the dev database

In Atlas, open **Browse Collections → dev_roza_db → users**. Filter with `{ "username": "<your username>" }`. Copy the `_id` value (24 characters).

Your dev and prod user ids may differ. Use the dev one here.

### 2.3 Add the connector settings

Generate two random values. Run this twice:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Add these lines to `C:\dev\Roza\backend\.env`:

```dotenv
MCP_DB_URL=<the connection string from 2.1>
MCP_PUBLIC_URL=http://localhost:3030
MCP_TOKEN_SECRET=<first random value>
MCP_PASSPHRASE=<second random value, or your own 16+ character phrase>
MCP_OWNER_USER_ID=<your dev user id from 2.2>
```

Keep the passphrase somewhere handy. You type it once when you connect.

### 2.4 Start ROZA

From `C:\dev\Roza`:

```powershell
npm run dev
```

The backend log should show `Claude connector connected to MongoDB.` If it shows `Claude connector is off: …`, a setting is missing or too short. Fix it and restart.

Quick checks in a second PowerShell window:

```powershell
curl.exe http://localhost:3030/.well-known/oauth-protected-resource/mcp
```

Expected: JSON with `"resource": "http://localhost:3030/mcp"`.

```powershell
curl.exe -i -X POST http://localhost:3030/mcp
```

Expected: `401 Unauthorized`, and a `WWW-Authenticate` header that mentions `resource_metadata`.

### 2.5 Connect Claude Code

In a new terminal (any folder):

```powershell
claude mcp add --transport http roza-dev http://localhost:3030/mcp
```

Start `claude`, type `/mcp`, choose `roza-dev`, and choose **Authenticate**. A browser page titled **Connect Claude to ROZA** opens.

- Type a **wrong** passphrase first. Expected: "Wrong passphrase."
- Type the right one and click **Allow**. Expected: the browser says authentication succeeded, and `/mcp` shows `roza-dev` as connected, with 19 tools.

### 2.6 Try it with real requests

Keep ROZA open at `http://localhost:5173` in a browser, so you can check each result. Ask Claude each request below and check the result.

**Dev Board**

| Ask Claude | Then check |
| --- | --- |
| "List my Dev Board tickets." | It matches the Dev Board in ROZA. |
| "Create a Dev Board ticket in project ROZA titled 'Connector test' with a short checklist in the body." | Reload the Dev Board. The ticket is there with the Markdown. |
| "Change that ticket's status to In progress and priority to High." | The Dev Board shows the new status and priority. |
| "Attach a file called notes.md to it with the text 'hello'." Then ask again with different text. | The ticket shows `notes.md` and `notes (2).md`. The first file is unchanged. |
| "Move that ticket to Trash." | The ticket is in the Dev Board's Trash, not gone. |
| "Delete that ticket permanently." | Claude says it can't. Nothing changes. |
| "Restore it from Trash." | The ticket is back. |

**Staging Room**

| Ask Claude | Then check |
| --- | --- |
| "List my Staging Room projects." | It matches the Staging Room in ROZA. |
| "Create a staged project called connector-test for a Hebrew book named 'Test Book'." | Reload the Staging Room. The project is there. |
| Paste two or three paragraphs with a heading, some **bold** and *italic*, and a `***` scene break. Then say "Save this as chapter 1 of connector-test." | Open the project and chapter 1. Formatting and line breaks look right. |
| "Save this other text as chapter 1 of connector-test" (new mode create). | Claude says chapter 1 already exists and asks you to confirm. Nothing changes. |
| Confirm the replace. | Chapter 1 has the new text. |
| "List the backups of connector-test, and restore the one from before the replace." | Chapter 1 has the first text again. |
| "Add a character named Rosa, described as the narrator." | The project shows the character. |
| "Add chapter 2, then swap chapters 1 and 2." | The order changed in the Staging Room. |
| "Remove chapter 2." Then "restore it from the backups." | The chapter disappears, then comes back. |
| "Push connector-test to the live book." | Claude says it can't. Push stays in the Staging Room. |

Optional: in the Staging Room, open `connector-test` and click **Compare**. It should show the new book and chapters. You can **Push** it to the dev database to check the full path into the Writing Studio. This is safe in dev.

### 2.7 Check the isolation

1. Ask Claude: "Show me the chapters of my live book X in the Writing Studio." Expected: Claude has no tool for that and says so.
2. In Atlas, open **Browse Collections → dev_roza_db → mcp_audit_log**. Expected: one row per change, plus rows for the refused ones (outcome `refused`).
3. Prove the database user's limits. Run this from `C:\dev\Roza\backend`. Replace `<MCP_DB_URL>` with the connection string from 2.1:

   ```powershell
   node -e "const m=require('mongoose');m.connect(process.argv[1],{dbName:'dev_roza_db'}).then(async()=>{for(const c of ['books','users']){try{await m.connection.db.collection(c).findOne({});console.log(c,': READ ALLOWED - fix the role!')}catch(e){console.log(c,': blocked -',e.codeName)}}process.exit(0)})" "<MCP_DB_URL>"
   ```

   Expected: `books : blocked - Unauthorized` and `users : blocked - Unauthorized`.

### 2.8 Clean up

- In the Dev Board, move the test ticket to Trash.
- In the Staging Room, hide or leave the `connector-test` project.
- In Claude Code, run `claude mcp remove roza-dev` when you're done.

---

## Stage 3 (optional): Phone test through a tunnel

The Claude apps on the web and phone connect from Anthropic's cloud. So they need a public HTTPS address on port 443, not `localhost`. A Cloudflare quick tunnel gives your PC one for a while.

1. Install `cloudflared` (once):

   ```powershell
   winget install --id Cloudflare.cloudflared
   ```

2. With ROZA running (`npm run dev`), start the tunnel in a new window:

   ```powershell
   cloudflared tunnel --url http://localhost:3030
   ```

   It prints an address like `https://random-words.trycloudflare.com`.
3. In `backend\.env`, set `MCP_PUBLIC_URL` to that address, with no slash at the end. Save. nodemon restarts the backend.
4. On claude.ai (web), open **Settings → Connectors → Add custom connector**. Name it `ROZA dev`. Set the URL to `https://random-words.trycloudflare.com/mcp`. Click **Connect**, enter the passphrase, and click **Allow**.
5. On your phone, open the Claude app. Start a chat, enable **ROZA dev** in the tools menu, and run a few requests from 2.6.

When you're done:
- Remove **ROZA dev** in Claude's connector settings.
- Stop the tunnel.
- Set `MCP_PUBLIC_URL` back to `http://localhost:3030`.

The tunnel address changes every time you start it. You would need to re-add the connector each time.

---

## Stage 4: Production check (after deploying)

Do this only after you deploy with the production settings from [claude-connector.md](claude-connector.md). That means a `roza-connector` user on `prod_roza_db`, and your **prod** user id.

1. Run the two `curl.exe` checks from 2.4 against `https://roza.esheleyni.com`. Expected: the same results.
2. Add the connector in Claude as **ROZA**, with URL `https://roza.esheleyni.com/mcp`.
3. From your phone: "List my Dev Board tickets" and "List my Staging Room projects". They should match ROZA.
4. Run the isolation check from 2.7, with the prod connection string and `prod_roza_db`.
5. Make one real change. For example, save a chapter into a staged project. Check it in the Staging Room, then Compare and Push yourself.

---

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Log says `Claude connector is off: set …` | Add the missing variable to `backend\.env` and restart. |
| Log says the secret, passphrase or user id is invalid | `MCP_TOKEN_SECRET` needs 32+ characters, `MCP_PASSPHRASE` 16+, and `MCP_OWNER_USER_ID` exactly 24 hex characters. |
| `Claude connector DB setup failed` with `not authorized` | The custom role is missing `createIndex` on `mcp_oauth_clients` or `mcp_oauth_grants`. |
| A tool says "not authorized" | The role is missing an action on that collection. Compare it with the table in 2.1. |
| Claude lists no tickets or projects | `MCP_OWNER_USER_ID` is not your id in this database. Check 2.2. |
| Sign-in page says "Unknown client" | Remove the connector in Claude and add it again. |
| Sign-in page doesn't come back to Claude | `MCP_PUBLIC_URL` doesn't match the address you used (for example, an old tunnel address). |
| "Too many changes" | The limit is 60 changes per 15 minutes. Wait, or restart the backend in dev. |
| A staged save says the project "changed while saving" | You edited the same project in ROZA at the same time. Ask Claude to try again. |
