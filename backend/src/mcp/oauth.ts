import crypto from "crypto";
import express, { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import type { ConnectorDb } from "./connectorDb";

// A small OAuth 2.1 authorization server for the Claude connector.
// Claude registers itself (RFC 7591) and sends the author to /oauth/authorize.
// The author enters the connector passphrase (MCP_PASSPHRASE), not their ROZA
// login, so the connector never reads the users collection. Claude then gets a
// short-lived bearer token (PKCE S256 only). Tokens are stored as HMACs keyed by
// MCP_TOKEN_SECRET, so changing that secret revokes every token at once.

export const SCOPE = "roza.chapters";
const CODE_TTL = 5 * 60 * 1000;
export const ACCESS_TTL = 60 * 60 * 1000;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_REDIRECTS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

export type OAuthOptions = {
  db: ConnectorDb;
  publicUrl: string; // e.g. https://roza.example.com (no trailing slash)
  tokenSecret: string;
  extraRedirectUris?: string[];
  // Returns the owner's user id when the connector passphrase is right; throws otherwise.
  authenticate: (passphrase: string) => Promise<string>;
  // Returns true while tokens for this user id may still be used.
  isUserAllowed: (userId: string) => Promise<boolean>;
};

export type ConnectorAuth = { userId: string; clientId: string };

export function resourceUrl(publicUrl: string) {
  return `${publicUrl}/mcp`;
}

export function protectedResourceMetadataUrl(publicUrl: string) {
  return `${publicUrl}/.well-known/oauth-protected-resource/mcp`;
}

export function createOAuthRouter(options: OAuthOptions): Router {
  const { db, publicUrl } = options;
  const router = express.Router();
  const form = express.urlencoded({ extended: false, limit: "20kb" });
  const json = express.json({ limit: "20kb" });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
  const allowedRedirects = new Set([...DEFAULT_REDIRECTS, ...(options.extraRedirectUris || [])]);

  const resourceMetadata = {
    resource: resourceUrl(publicUrl),
    authorization_servers: [publicUrl],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "ROZA",
  };
  router.get(
    ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"],
    (_req, res) => res.json(resourceMetadata),
  );

  const serverMetadata = {
    issuer: publicUrl,
    authorization_endpoint: `${publicUrl}/oauth/authorize`,
    token_endpoint: `${publicUrl}/oauth/token`,
    registration_endpoint: `${publicUrl}/oauth/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
  };
  router.get(
    ["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/mcp"],
    (_req, res) => res.json(serverMetadata),
  );

  // --- Dynamic client registration -------------------------------------------
  router.post("/oauth/register", limiter, json, async (req, res, next) => {
    try {
      const body = req.body || {};
      const redirectUris = body.redirect_uris;
      if (
        !Array.isArray(redirectUris) ||
        !redirectUris.length ||
        redirectUris.length > 5 ||
        !redirectUris.every(uri => typeof uri === "string" && isAllowedRedirect(uri, allowedRedirects))
      )
        return oauthError(res, 400, "invalid_redirect_uri", "This redirect URI is not allowed for ROZA.");
      const authMethod = body.token_endpoint_auth_method || "none";
      if (!serverMetadata.token_endpoint_auth_methods_supported.includes(authMethod))
        return oauthError(res, 400, "invalid_client_metadata", "Unsupported token_endpoint_auth_method.");
      const clientId = randomToken(16);
      const secret = authMethod === "none" ? undefined : randomToken(32);
      const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 200) : undefined;
      await db.Clients.create({
        clientId,
        secretHash: secret ? hmac(options.tokenSecret, secret) : undefined,
        clientName,
        redirectUris,
      });
      res.status(201).json({
        client_id: clientId,
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: authMethod,
        scope: SCOPE,
      });
    } catch (error) {
      next(error);
    }
  });

  // --- Authorization (sign-in page) -------------------------------------------
  async function readAuthorizeParams(source: Record<string, unknown>) {
    const get = (key: string) => (typeof source[key] === "string" ? (source[key] as string) : "");
    const params = {
      client_id: get("client_id"),
      redirect_uri: get("redirect_uri"),
      response_type: get("response_type"),
      code_challenge: get("code_challenge"),
      code_challenge_method: get("code_challenge_method"),
      state: get("state"),
      scope: get("scope"),
      resource: get("resource"),
    };
    const client = params.client_id ? await db.Clients.findOne({ clientId: params.client_id }).lean() : null;
    // Without a known client and an exact redirect match we must not redirect.
    if (!client) return { params, fatal: "Unknown client. Remove the connector in Claude and add it again." };
    if (!client.redirectUris.some(uri => sameRedirect(uri, params.redirect_uri)))
      return { params, fatal: "The redirect URI does not match this client." };
    let error = "";
    if (params.response_type !== "code") error = "unsupported_response_type";
    else if (params.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge))
      error = "invalid_request";
    else if (params.resource && params.resource.replace(/\/$/, "") !== resourceUrl(publicUrl))
      error = "invalid_target";
    return { params, error };
  }

  router.get("/oauth/authorize", limiter, async (req, res, next) => {
    try {
      const { params, fatal, error } = await readAuthorizeParams(req.query as Record<string, unknown>);
      if (fatal) return res.status(400).type("text/plain").send(fatal);
      if (error) return res.redirect(redirectWith(params.redirect_uri, { error, state: params.state }));
      sendSignInPage(res, params);
    } catch (err) {
      next(err);
    }
  });

  // Passphrase guesses get a much smaller budget than the other endpoints.
  const signInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
  router.post("/oauth/authorize", signInLimiter, form, async (req, res, next) => {
    try {
      const { params, fatal, error } = await readAuthorizeParams(req.body || {});
      if (fatal) return res.status(400).type("text/plain").send(fatal);
      if (error) return res.redirect(redirectWith(params.redirect_uri, { error, state: params.state }));
      if (req.body.action === "deny")
        return res.redirect(redirectWith(params.redirect_uri, { error: "access_denied", state: params.state }));
      let userId: string;
      try {
        userId = await options.authenticate(String(req.body.passphrase || ""));
      } catch (err) {
        return sendSignInPage(res, params, (err as Error).message || "Sign-in failed.", 401);
      }
      const code = randomToken(32);
      await db.Grants.create({
        kind: "code",
        hash: hmac(options.tokenSecret, code),
        clientId: params.client_id,
        userId,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        scope: SCOPE,
        expiresAt: new Date(Date.now() + CODE_TTL),
      });
      res.redirect(redirectWith(params.redirect_uri, { code, state: params.state, iss: publicUrl }));
    } catch (err) {
      next(err);
    }
  });

  // --- Token endpoint ----------------------------------------------------------
  router.post("/oauth/token", limiter, form, json, async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const body = req.body || {};
      const client = await authenticateClient(req, body);
      if (!client) return oauthError(res, 401, "invalid_client", "Client authentication failed.");

      if (body.grant_type === "authorization_code") {
        const code = typeof body.code === "string" ? body.code : "";
        const grant = await db.Grants.findOneAndDelete({
          kind: "code",
          hash: hmac(options.tokenSecret, code),
        }).lean();
        if (
          !grant ||
          grant.expiresAt < new Date() ||
          grant.clientId !== client.clientId ||
          (body.redirect_uri && body.redirect_uri !== grant.redirectUri) ||
          typeof body.code_verifier !== "string" ||
          pkceChallenge(body.code_verifier) !== grant.codeChallenge
        )
          return oauthError(res, 400, "invalid_grant", "The authorization code is invalid or expired.");
        if (!(await options.isUserAllowed(grant.userId)))
          return oauthError(res, 400, "invalid_grant", "This ROZA account may not use the connector.");
        return res.json(await issueTokens(client.clientId, grant.userId));
      }

      if (body.grant_type === "refresh_token") {
        const token = typeof body.refresh_token === "string" ? body.refresh_token : "";
        // Refresh tokens rotate: each one works once.
        const grant = await db.Grants.findOneAndDelete({
          kind: "refresh",
          hash: hmac(options.tokenSecret, token),
        }).lean();
        if (!grant || grant.expiresAt < new Date() || grant.clientId !== client.clientId)
          return oauthError(res, 400, "invalid_grant", "The refresh token is invalid or expired.");
        if (!(await options.isUserAllowed(grant.userId)))
          return oauthError(res, 400, "invalid_grant", "This ROZA account may not use the connector.");
        return res.json(await issueTokens(client.clientId, grant.userId));
      }

      return oauthError(res, 400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
    } catch (err) {
      next(err);
    }
  });

  async function authenticateClient(req: Request, body: Record<string, unknown>) {
    let clientId = typeof body.client_id === "string" ? body.client_id : "";
    let secret = typeof body.client_secret === "string" ? body.client_secret : "";
    const basic = req.headers.authorization?.match(/^Basic\s+(.+)$/i);
    if (basic) {
      const [id, pass] = Buffer.from(basic[1], "base64").toString("utf8").split(":");
      clientId = decodeURIComponent(id || "");
      secret = decodeURIComponent(pass || "");
    }
    if (!clientId) return null;
    const client = await db.Clients.findOne({ clientId }).lean();
    if (!client) return null;
    if (client.secretHash && !safeEqual(client.secretHash, hmac(options.tokenSecret, secret))) return null;
    return client;
  }

  async function issueTokens(clientId: string, userId: string) {
    const accessToken = randomToken(32);
    const refreshToken = randomToken(32);
    const now = Date.now();
    await db.Grants.insertMany([
      {
        kind: "access",
        hash: hmac(options.tokenSecret, accessToken),
        clientId,
        userId,
        scope: SCOPE,
        expiresAt: new Date(now + ACCESS_TTL),
      },
      {
        kind: "refresh",
        hash: hmac(options.tokenSecret, refreshToken),
        clientId,
        userId,
        scope: SCOPE,
        expiresAt: new Date(now + REFRESH_TTL),
      },
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL / 1000,
      refresh_token: refreshToken,
      scope: SCOPE,
    };
  }

  return router;
}

// Bearer token check for /mcp. Unauthenticated calls get 401 with a pointer to
// the protected resource metadata, which is how Claude finds the sign-in flow.
export function requireConnectorAuth(options: OAuthOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reject = (description: string) => {
        res.setHeader(
          "WWW-Authenticate",
          `Bearer error="invalid_token", error_description="${description}", resource_metadata="${protectedResourceMetadataUrl(options.publicUrl)}"`,
        );
        res.status(401).json({ error: "invalid_token", error_description: description });
      };
      const match = req.headers.authorization?.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i);
      if (!match) return reject("Missing bearer token");
      const grant = await options.db.Grants.findOne({
        kind: "access",
        hash: hmac(options.tokenSecret, match[1]),
      }).lean();
      if (!grant || grant.expiresAt < new Date()) return reject("Invalid or expired token");
      if (!(await options.isUserAllowed(grant.userId))) return reject("Account may not use the connector");
      res.locals.connectorAuth = { userId: grant.userId, clientId: grant.clientId } as ConnectorAuth;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function sendSignInPage(
  res: Response,
  params: Record<string, string>,
  message = "",
  status = 200,
) {
  const hidden = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`)
    .join("");
  // form-action must allow the redirect target, or browsers block the redirect.
  const target = new URL(params.redirect_uri).origin;
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${target}; frame-ancestors 'none'; base-uri 'none'`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(status).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Claude to ROZA</title>
<style>
body{font-family:system-ui,sans-serif;background:#f6f4ef;color:#222;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
main{background:#fff;border-radius:12px;box-shadow:0 2px 12px #0002;padding:24px;max-width:360px;width:100%}
h1{font-size:1.3rem;margin:0 0 8px}p{margin:0 0 16px;line-height:1.4;color:#555}
label{display:block;font-size:.9rem;margin:12px 0 4px}input[type=password]{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:1rem}
.row{display:flex;gap:8px;margin-top:20px}button{flex:1;padding:10px;border-radius:8px;border:0;font-size:1rem;cursor:pointer}
.ok{background:#3b5bdb;color:#fff}.no{background:#eee}.err{color:#c92a2a;margin:8px 0 0}
</style></head><body><main>
<h1>Connect Claude to ROZA</h1>
<p>Claude will be able to read and change your Dev Board and Staging Room. It cannot reach your live books or account, and it cannot permanently delete anything.</p>
<form method="post" action="/oauth/authorize">${hidden}
<label for="p">Connector passphrase</label><input id="p" name="passphrase" type="password" autocomplete="current-password" required>
${message ? `<p class="err" role="alert">${escapeHtml(message)}</p>` : ""}
<div class="row"><button class="no" name="action" value="deny" formnovalidate>Cancel</button><button class="ok" name="action" value="allow">Allow</button></div>
</form></main></body></html>`);
}

function isAllowedRedirect(uri: string, allowed: Set<string>) {
  if (allowed.has(uri)) return true;
  // Loopback redirects for local tools (Claude Code, MCP Inspector).
  try {
    const url = new URL(uri);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function sameRedirect(registered: string, requested: string) {
  if (registered === requested) return true;
  // RFC 8252: loopback redirects may use any port.
  try {
    const a = new URL(registered);
    const b = new URL(requested);
    const loopback = ["localhost", "127.0.0.1", "[::1]"];
    return (
      a.protocol === "http:" &&
      loopback.includes(a.hostname) &&
      a.hostname === b.hostname &&
      a.protocol === b.protocol &&
      a.pathname === b.pathname
    );
  } catch {
    return false;
  }
}

function redirectWith(uri: string, values: Record<string, string>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.set(key, value);
  return url.toString();
}

function oauthError(res: Response, status: number, error: string, description: string) {
  return res.status(status).json({ error, error_description: description });
}

export function hmac(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function randomToken(bytes: number) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
}
