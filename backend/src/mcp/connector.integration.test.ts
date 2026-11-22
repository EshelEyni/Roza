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

  test("Staging Room: project, chapters, backups and restore", async () => {
    await ok("staging_create_project", { slug, bookName: "My Lost Time", language: "he" });
    expect((await call("staging_create_project", { slug, bookName: "Again", language: "he" })).text).toContain("already exists");

    await ok("staging_save_chapter", { slug, number: 1, title: "One", mode: "create", text: "# Start\n\nShe *ran*.\nשלום" });
    await ok("staging_save_chapter", { slug, number: 2, title: "Two", mode: "create", text: "Second **chapter**" });
    const refused = await call("staging_save_chapter", { slug, number: 2, mode: "create", text: "x" });
    expect(refused.text).toContain("Chapter 2 already exists");

    const replaced = await ok("staging_save_chapter", { slug, number: 2, mode: "replace", text: "New second" });
    expect(replaced.backupIds).toHaveLength(1);
    expect((await ok("staging_get_chapter", { slug, number: 1 })).text).toBe("# Start\n\nShe *ran*.\n\nשלום");

    await ok("staging_update_book", { slug, characters: { Rosa: "The narrator" }, themes: { Time: ["#aa3300", "Memory"] }, wordGoal: 80000 });
    const project = await ok("staging_get_project", { slug });
    expect(project.book).toMatchObject({ bookName: "My Lost Time", characters: { Rosa: "The narrator" }, wordGoal: 80000 });
    expect(project.book.userId).toBeUndefined();

    await ok("staging_set_chapter_order", { slug, order: [2, 1] });
    expect((await ok("staging_get_chapter", { slug, number: 1 })).title).toBe("Two");

    const removed = await ok("staging_remove_chapter", { slug, number: 2 });
    expect(removed.title).toBe("One");
    expect((await ok("staging_get_project", { slug })).chapters).toHaveLength(1);
    const backups = await ok("staging_list_backups", { slug });
    const removal = backups.backups.find((b: { reason: string }) => b.reason === "remove chapter");
    await ok("staging_restore_backup", { slug, backupId: removal.backupId });
    const restored = await ok("staging_get_project", { slug });
    expect(restored.chapters.map((c: { number: number; title: string }) => [c.number, c.title])).toEqual([[1, "Two"], [2, "One"]]);

    await ok("staging_set_preferences", { order: [slug], hidden: [] });
    const listed = await ok("staging_list_projects");
    expect(listed.projects[0]).toMatchObject({ slug, chapterCount: 2 });

    // Stored exactly like the Staging Room stores it, so the UI and Push see it.
    const row = await connection.db!.collection("staging_room_projects").findOne({ _id: hash(owner, slug) } as never);
    expect(row).toMatchObject({ owner, slug, book: { userId: owner } });
    expect(row!.revision).toBeGreaterThan(5);
  });

  test("never opens collections outside the Dev Board, Staging Room and its own", () => {
    const allowed = new Set<string>(Object.values(CONNECTOR_COLLECTIONS));
    expect([...opened].filter(name => !allowed.has(name))).toEqual([]);
    expect(opened.has("books")).toBe(false);
    expect(opened.has("users")).toBe(false);
  });

  test("audits writes, rejects big requests, rotates refresh tokens", async () => {
    const audit = await db.Audit.find({ userId: owner }).lean();
    expect(audit.length).toBeGreaterThan(10);
    expect(audit.some(a => a.tool === "staging_save_chapter" && a.outcome === "refused")).toBe(true);
    const big = await rpc("tools/call", { name: "staging_save_chapter", arguments: { slug, number: 9, mode: "create", text: "a".repeat(1_100_000) } });
    expect(big.status).toBe(413);
    resetWriteLimits();
    const res = await request(app).post("/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(res.status).toBe(200);
    const reuse = await request(app).post("/oauth/token").type("form").send({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId });
    expect(reuse.body.error).toBe("invalid_grant");
  });
});
