import crypto from "crypto";
import express from "express";
import request from "supertest";
import { createConnectorRouter, passphraseSignIn } from "./connectorRouter";
import type { ConnectorDb } from "./connectorDb";

const issuer = "https://roza.test";
const resource = `${issuer}/mcp`;
const secret = "s".repeat(40);
const passphrase = "connector-test-passphrase";
const owner = "a".repeat(24);

test.each([
  ["ChatGPT", "https://chatgpt.com/connector_platform_oauth_redirect"],
  ["Codex", "http://localhost:4682/callback"],
  ["Claude", "https://claude.ai/api/mcp/auth_callback"],
])("%s can register, authorize and discover Roza tools", async (clientName, redirectUri) => {
  const clients = new Map();
  const grants = new Map();
  const db = {
    Clients: {
      create: (client: { clientId: string }) => clients.set(client.clientId, client),
      findOne: ({ clientId }: { clientId: string }) => ({ lean: async () => clients.get(clientId) }),
    },
    Grants: {
      create: (grant: { hash: string }) => grants.set(grant.hash, grant),
      insertMany: (rows: { hash: string }[]) => rows.forEach(row => grants.set(row.hash, row)),
      findOneAndDelete: ({ hash }: { hash: string }) => ({
        lean: async () => {
          const grant = grants.get(hash);
          grants.delete(hash);
          return grant;
        },
      }),
      findOne: ({ hash }: { hash: string }) => ({ lean: async () => grants.get(hash) }),
    },
  } as unknown as ConnectorDb;
  const app = express();
  app.use(createConnectorRouter({ db, publicUrl: issuer, tokenSecret: secret, ...passphraseSignIn(secret, passphrase, owner) }));
  const api = request(app);
  const metadata = await api.get("/.well-known/oauth-authorization-server").expect(200);
  expect(metadata.body).toMatchObject({ issuer, authorization_response_iss_parameter_supported: true });
  await api.post("/oauth/register").send({ redirect_uris: ["https://chatgpt.com/unrelated"] }).expect(400);
  const registration = await api.post("/oauth/register").send({ client_name: clientName, redirect_uris: [redirectUri] }).expect(201);
  const verifier = crypto.randomBytes(32).toString("base64url");
  const params = {
    client_id: registration.body.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    state: "client-state",
    resource,
    code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  };
  await api.get("/oauth/authorize").query(params).expect(200);
  const invalid = await api.get("/oauth/authorize").query({ ...params, resource: issuer }).expect(302);
  expect(new URL(invalid.headers.location).searchParams.get("error")).toBe("invalid_target");
  const denied = await api.post("/oauth/authorize").type("form").send({ ...params, action: "deny" }).expect(302);
  expect(new URL(denied.headers.location).searchParams.get("iss")).toBe(issuer);
  const approved = await api.post("/oauth/authorize").type("form").send({ ...params, passphrase }).expect(302);
  const callback = new URL(approved.headers.location);
  expect(callback.searchParams.get("iss")).toBe(issuer);
  expect(callback.searchParams.get("state")).toBe(params.state);
  const exchange = {
    grant_type: "authorization_code",
    client_id: params.client_id,
    redirect_uri: redirectUri,
    code: callback.searchParams.get("code"),
    code_verifier: verifier,
    resource,
  };
  await api.post("/oauth/token").type("form").send({ ...exchange, resource: issuer }).expect(400);
  const token = await api.post("/oauth/token").type("form").send(exchange).expect(200);
  const tools = await api.post("/mcp").set("Authorization", `Bearer ${token.body.access_token}`)
    .set("Accept", "application/json, text/event-stream").send({ jsonrpc: "2.0", id: 1, method: "tools/list" }).expect(200);
  expect(tools.body.result.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining([
    "devboard_list_tickets", "staging_list_projects",
  ]));
});
