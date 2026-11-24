import crypto from "crypto";
import express from "express";
import request from "supertest";
import mongoose, { Connection, Types } from "mongoose";
import { createConnectorRouter, passphraseSignIn } from "./connectorRouter";
import { CONNECTOR_COLLECTIONS, createConnectorDb, ConnectorDb } from "./connectorDb";
import { resetWriteLimits } from "./mcpServer";

// End-to-end test of the Claude connector against a real MongoDB database.
// Runs only when MCP_INTEGRATION_DB_URL is set. Never point it at production:
//   MCP_INTEGRATION_DB_URL=<url> MCP_INTEGRATION_DB_NAME=test_roza_db npx jest src/mcp/connector.integration
const url = process.env.MCP_INTEGRATION_DB_URL;
const dbName = process.env.MCP_INTEGRATION_DB_NAME || "test_roza_db";
const run = url && !/prod/i.test(dbName) ? describe : describe.skip;

run("Claude connector", () => {
  const publicUrl = "https://roza.test";
  const redirect = "https://claude.ai/api/mcp/auth_callback";
  const passphrase = "correct horse battery staple";
  const owner = new Types.ObjectId().toString();
  const stranger = new Types.ObjectId().toString();
  const slug = `claude-test-${crypto.randomBytes(4).toString("hex")}`;
  const opened = new Set<string>();
  let connection: Connection;
  let db: ConnectorDb;
  let app: express.Express;
  let token = "";
  let refresh = "";
  let clientId = "";

  beforeAll(async () => {
    connection = await mongoose.createConnection(url as string, { dbName, autoIndex: false }).asPromise();
    // Record every collection the connector opens.
    const nativeDb = connection.db!;
    const original = nativeDb.collection.bind(nativeDb);
    nativeDb.collection = ((name: string, options?: object) => {
      opened.add(name);
      return original(name, options);
    }) as typeof nativeDb.collection;
    db = createConnectorDb(connection);
    await Promise.all([db.Clients.createIndexes(), db.Grants.createIndexes()]);
    // A stranger's ticket that must stay invisible.
    await db.devTickets().insertOne({
      _id: hash(stranger, "stranger-ticket"), owner: stranger, id: "stranger-ticket", project: "X", title: "Not yours",
      status: "Open", priority: "", scope: "", repository: "", markdown: "secret", number: null, deletedAt: null,
    } as never);
    app = express();
    app.use(createConnectorRouter({ db, publicUrl, tokenSecret: crypto.randomBytes(32).toString("hex"), ...passphraseSignIn("s".repeat(40), passphrase, owner) }));
  }, 30000);

  afterAll(async () => {
    if (!connection) return;
    for (const name of [CONNECTOR_COLLECTIONS.devTickets, CONNECTOR_COLLECTIONS.devAttachments, CONNECTOR_COLLECTIONS.stagingProjects, CONNECTOR_COLLECTIONS.stagingBackups])
      await connection.db!.collection(name).deleteMany({ owner: { $in: [owner, stranger] } });
    await connection.db!.collection(CONNECTOR_COLLECTIONS.stagingPreferences).deleteMany({ _id: owner } as never);
    await db.Grants.deleteMany({ userId: owner });
    if (clientId) await db.Clients.deleteMany({ clientId });
    await db.Audit.deleteMany({ userId: owner });
    await connection.close();
  });

  const hash = (...values: string[]) => crypto.createHash("sha256").update(JSON.stringify(values)).digest("hex");
  const rpc = (method: string, params: unknown, auth = token) =>
    request(app).post("/mcp").set("Authorization", `Bearer ${auth}`).set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method, params });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await rpc("tools/call", { name, arguments: args });
    expect(res.status).toBe(200);
    const result = res.body.result;
    const text = result.content[0].text as string;
    return { isError: !!result.isError, text, data: result.isError ? null : JSON.parse(text) };
  };
  const ok = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await call(name, args);
    if (result.isError) throw new Error(`${name}: ${result.text}`);
    return result.data;
  };

  test("rejects /mcp without a token and points to the metadata", async () => {
    const res = await request(app).post("/mcp").send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain(`resource_metadata="${publicUrl}/.well-known/oauth-protected-resource/mcp"`);
    const meta = await request(app).get("/.well-known/oauth-protected-resource/mcp");
    expect(meta.body).toMatchObject({ resource: `${publicUrl}/mcp`, authorization_servers: [publicUrl] });
    expect((await rpc("tools/list", {}, "made-up-token")).status).toBe(401);
    const evil = await request(app).post("/oauth/register").send({ redirect_uris: ["https://evil.example/cb"] });
    expect(evil.body.error).toBe("invalid_redirect_uri");
  });

  test("signs in with the connector passphrase (OAuth + PKCE)", async () => {
    const reg = await request(app).post("/oauth/register").send({ redirect_uris: [redirect], client_name: "Claude" });
    expect(reg.status).toBe(201);
    clientId = reg.body.client_id;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const params = {
      response_type: "code", client_id: clientId, redirect_uri: redirect, state: "xyz", resource: `${publicUrl}/mcp`,
      code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    };
    const page = await request(app).get("/oauth/authorize").query(params);
    expect(page.text).toContain('name="passphrase"');
    expect(page.text).not.toContain('name="username"');

    const bad = await request(app).post("/oauth/authorize").type("form").send({ ...params, passphrase: "wrong", action: "allow" });
    expect(bad.status).toBe(401);
    expect(bad.text).toContain("Wrong passphrase.");

    const good = await request(app).post("/oauth/authorize").type("form").send({ ...params, passphrase, action: "allow" });
    expect(good.status).toBe(302);
    const location = new URL(good.headers.location);
    expect(location.searchParams.get("state")).toBe("xyz");
    const tok = await request(app).post("/oauth/token").type("form").send({
      grant_type: "authorization_code", code: location.searchParams.get("code"), client_id: clientId, redirect_uri: redirect, code_verifier: verifier,
    });
    expect(tok.status).toBe(200);
    token = tok.body.access_token;
    refresh = tok.body.refresh_token;
  });

  test("offers only Dev Board and Staging Room tools, none of them a hard delete", async () => {
    const res = await rpc("tools/list", {});
    const names: string[] = res.body.result.tools.map((t: { name: string }) => t.name);
    expect(names.every(name => /^(devboard|staging)_/.test(name))).toBe(true);
    expect(names.some(name => /delete|purge|empty|push|pull/.test(name))).toBe(false);
  });

  test("Dev Board: create, edit, trash, restore, attachments", async () => {
    const created = await ok("devboard_create_ticket", { project: "ROZA", title: "Connector test", markdown: "# Hello", priority: "High" });
    const list = await ok("devboard_list_tickets");
    expect(list.tickets.map((t: { id: string }) => t.id)).toEqual([created.id]); // stranger's ticket hidden
    expect((await call("devboard_get_ticket", { id: "stranger-ticket" })).isError).toBe(true);

    await ok("devboard_update_ticket", { id: created.id, status: "In progress", markdown: "# Updated" });
    expect(await ok("devboard_get_ticket", { id: created.id })).toMatchObject({ status: "In progress", markdown: "# Updated", priority: "High" });

    await ok("devboard_set_trash", { id: created.id, trashed: true });
    expect((await ok("devboard_list_tickets")).tickets).toEqual([]);
    expect((await ok("devboard_list_tickets", { includeTrash: true })).tickets[0].inTrash).toBe(true);
    expect((await call("devboard_update_ticket", { id: created.id, title: "x" })).text).toContain("in Trash");
    await ok("devboard_set_trash", { id: created.id, trashed: false });

    const first = await ok("devboard_add_attachment", { id: created.id, filename: "notes.md", text: "first" });
    const second = await ok("devboard_add_attachment", { id: created.id, filename: "notes.md", text: "second" });
    expect([first.filename, second.filename]).toEqual(["notes.md", "notes (2).md"]);
    expect((await ok("devboard_read_attachment", { id: created.id, filename: "notes.md" })).content).toBe("first");
    const png = await ok("devboard_add_attachment", { id: created.id, filename: "dot.png", base64: Buffer.from([137, 80, 78, 71, 0, 1]).toString("base64") });
    expect((await ok("devboard_read_attachment", { id: created.id, filename: png.filename })).encoding).toBe("base64");
    // Stored exactly like the Dev Board stores it.
    const row = await connection.db!.collection("dev_board_tickets").findOne({ _id: hash(owner, created.id) } as never);
    expect(row).toMatchObject({ owner, id: created.id, editedInBoard: true, deletedAt: null });
  });

  test("Staging Room: Claude adds pending changes only", async () => {
    await ok("staging_create_project", { slug, bookName: "My Lost Time", language: "he" });
    expect((await call("staging_create_project", { slug, bookName: "Again", language: "he" })).text).toContain("already exists");

    // The ROZA backend keeps a copy of the live book on the row. Simulate one.
    const para = (text: string) => ({ type: "paragraph", children: [{ text }] });
    const chapterId = new Types.ObjectId().toString();
    const rosaId = new Types.ObjectId().toString();
    const lossId = new Types.ObjectId().toString();
    await connection.db!.collection("staging_room_projects").updateOne({ _id: hash(owner, slug) } as never, {
      $set: {
        liveBookId: new Types.ObjectId().toString(),
        live: {
          copyVersion: 2,
          bookId: "x", name: "My Lost Time", updatedAt: new Date().toISOString(), copiedAt: new Date().toISOString(),
          chapters: [
            {
              id: chapterId, name: "One", format: "prose", text: [para("Old text")], mainHash: "h1", summary: [para("Old summary")], summaryHash: "s1",
              annotations: [{ id: "n1", content: "Slow start", quote: "", anchor: null, general: true }],
              planning: { characters: [{ entityId: rosaId, note: "narrates" }], themes: [], plotlines: [] }, planningHash: "p1",
              taskBoard: { lists: [{ id: "cl", title: "Chapter work", cards: [] }] },
              drafts: [{ id: "d1", name: "Studio draft", words: 2, text: [para("Studio text")], annotations: [], summary: "Tried a colder start" }],
            },
          ],
          characters: [{ id: rosaId, name: "Rosa", text: [para("A girl")], hash: "c1" }],
          themes: [{ id: lossId, name: "Loss", color: "#112233", text: [para("Grief")], hash: "t1" }],
          plotlines: [], notes: [],
          taskBoard: { lists: [{ id: "l1", title: "To do", cards: [
            { id: "card1", title: "Fix dates", description: "", chapterId, completed: false, dueDate: "", checklist: [], labels: [], createdAt: "x", updatedAt: "x" },
          ] }] },
        },
      },
    });

    const first = await ok("staging_write_draft", { slug, number: 1, text: "# Start\n\nShe *ran*." });
    const second = await ok("staging_write_draft", { slug, number: 1, text: "She ran faster.", notes: [{ quote: "faster", content: "Check pace" }] });
    expect(second.changeId).toBe(first.changeId); // saving again updates the same draft
    expect((await call("staging_write_draft", { slug, number: 7, text: "x" })).text).toContain("no chapter 7");

    const chapter = await ok("staging_get_chapter", { slug, number: 1 });
    expect(chapter.main).toBe("Old text");
    expect(chapter.summary).toBe("Old summary");
    expect(chapter.mainNotes).toEqual([{ content: "Slow start", general: true }]);
    expect(chapter.planning).toEqual({ characters: [{ name: "Rosa", note: "narrates" }], themes: [], plotlines: [] });
    expect(chapter.pending[0]).toMatchObject({ kind: "draft", text: "She ran faster." });

    // Writing Studio drafts: read, and copy into a pending draft.
    const studio = await ok("staging_get_chapter", { slug, number: 1, version: "studio draft" });
    expect(studio).toMatchObject({ text: "Studio text", version: { writingStudioDraft: "Studio draft", summary: "Tried a colder start" } });
    const copied = await ok("staging_copy_draft", { slug, number: 1, from: "Studio draft", name: "From studio" });
    expect(copied).toMatchObject({ name: "From studio", words: 2 });
    expect((await call("staging_edit_text", { slug, number: 1, target: "Studio draft", edits: [{ find: "Studio", replace: "x" }] })).text).toContain("Copy it");

    const edited = await ok("staging_edit_text", { slug, number: 1, target: first.changeId, edits: [{ find: "faster", replace: "slower" }] });
    expect(edited).toMatchObject({ changeId: first.changeId, summary: "applied 1 edit; words 3 → 3", notesMovedToGeneral: [{ quote: "faster" }] });
    const one = await ok("staging_get_chapter", { slug, number: 1, version: first.changeId });
    expect(one).toMatchObject({ text: "She ran slower.", notes: [{ content: "Check pace", quote: "faster", general: true }] });

    await ok("staging_edit_main", { slug, number: 1, text: "New Main" });
    await ok("staging_add_chapter", { slug, title: "Two", text: "Second **chapter**", after: 1 });
    await ok("staging_set_element", { slug, kind: "characters", name: "Rosa", text: "The narrator" });
    const rosa = await ok("staging_get_elements", { slug, kind: "characters", name: "rosa" });
    expect(rosa.items).toEqual([{ name: "Rosa", text: "A girl", pendingChange: { changeId: expect.any(String), text: "The narrator" } }]);
    await ok("staging_add_notes", { slug, number: 1, notes: [{ content: "General thought" }] });
    await ok("staging_add_tasks", { slug, tasks: [{ title: "Check the timeline", chapter: 1 }] });
    const summary = await ok("staging_set_summary", { slug, number: 1, text: "She runs." });
    const again = await ok("staging_set_summary", { slug, number: 1, text: "She runs away." });
    expect(again.changeId).toBe(summary.changeId);
    expect((await ok("staging_get_chapter", { slug, number: 1 })).pendingSummary).toEqual({ changeId: summary.changeId, text: "She runs away." });

    // Planning: names in, ids stored, names back out.
    expect((await call("staging_set_planning", { slug, number: 1, themes: [{ name: "Hope" }] })).text).toContain('No themes named "Hope"');
    const planning = await ok("staging_set_planning", { slug, number: 1, themes: [{ name: "loss", note: "the move" }] });
    const read = await ok("staging_get_chapter", { slug, number: 1 });
    expect(read.pendingPlanning).toEqual({ changeId: planning.changeId, themes: [{ name: "Loss", note: "the move" }] });

    // Chapter settings.
    await ok("staging_update_chapter", { slug, number: 1, title: "Opening" });
    const settings = await ok("staging_update_chapter", { slug, number: 1, format: "screenplay" });
    expect((await ok("staging_get_chapter", { slug, number: 1 })).pendingSettings).toEqual({ changeId: settings.changeId, title: "Opening", format: "screenplay" });

    // Tasks: read both boards, add to a chapter board, change an existing card.
    const boards = await ok("staging_get_tasks", { slug });
    expect(boards.bookBoard).toEqual([{ list: "To do", cards: [{ cardId: "card1", title: "Fix dates", completed: false, chapter: 1 }] }]);
    expect(boards.chapterBoards).toEqual([]);
    await ok("staging_add_tasks", { slug, tasks: [{ title: "Cut the intro", chapter: 1, onChapterBoard: true, dueDate: "2026-12-01" }] });
    await ok("staging_update_task", { slug, cardId: "card1", completed: true });
    const task = await ok("staging_update_task", { slug, cardId: "card1", dueDate: "2026-12-24" });
    const after = await ok("staging_get_tasks", { slug });
    expect(after.bookBoard[0].cards[0].pendingEdit).toEqual({ changeId: task.changeId, completed: true, dueDate: "2026-12-24" });
    expect((await call("staging_update_task", { slug, cardId: "nope", completed: true })).text).toContain("No task with cardId");

    const project = await ok("staging_get_project", { slug });
    expect(project.pendingChanges.map((c: { kind: string }) => c.kind)).toEqual([
      "draft", "draft", "main", "chapter", "element", "notes", "tasks", "summary", "planning", "chapterSettings", "tasks", "taskEdit",
    ]);
    const listed = await ok("staging_list_projects");
    expect(listed.projects[0]).toMatchObject({ slug, pendingChanges: 12 });

    const row = await connection.db!.collection("staging_room_projects").findOne({ _id: hash(owner, slug) } as never);
    expect(row).toMatchObject({ owner, slug, version: 2, userId: owner });
    expect(row!.changes[0]).toMatchObject({ kind: "draft", chapterId, baseHash: "h1", by: "connector" });
  }, 60_000); // many tool calls against a remote test database

  test("never opens collections outside the Dev Board, Staging Room and its own", () => {
    const allowed = new Set<string>(Object.values(CONNECTOR_COLLECTIONS));
    expect([...opened].filter(name => !allowed.has(name))).toEqual([]);
    expect(opened.has("books")).toBe(false);
    expect(opened.has("users")).toBe(false);
  });

  test("audits writes, rejects big requests, rotates refresh tokens", async () => {
    const audit = await db.Audit.find({ userId: owner }).lean();
    expect(audit.length).toBeGreaterThan(10);
    expect(audit.some(a => a.tool === "staging_write_draft" && a.outcome === "refused")).toBe(true);
    const big = await rpc("tools/call", { name: "staging_add_chapter", arguments: { slug, title: "Big", text: "a".repeat(1_100_000) } });
    expect(big.status).toBe(413);
    resetWriteLimits();
    const res = await request(app).post("/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(res.status).toBe(200);
    const reuse = await request(app).post("/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(reuse.body.error).toBe("invalid_grant");
  });
});
