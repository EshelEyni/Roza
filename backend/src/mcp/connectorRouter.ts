import crypto from "crypto";
import express, { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcpServer";
import { ConnectorAuth, createOAuthRouter, hmac, OAuthOptions, requireConnectorAuth } from "./oauth";
import { connectConnectorDb } from "./connectorDb";
import { logger } from "../services/logger/loggerService";

// Claude connector (Ticket #75): OAuth endpoints plus the MCP endpoint at /mcp.
// It reaches only the Dev Board and Staging Room collections (see connectorDb.ts).
// Mounted before the app's JSON parser and HTML sanitizer, so chapter text
// reaches the converter unchanged and has its own 1 MB body limit.

export function createConnectorRouter(options: OAuthOptions): Router {
  const router = express.Router();
  router.use(createOAuthRouter(options));

  const mcpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const json = express.json({ limit: "1mb" });

  router.post("/mcp", mcpLimiter, requireConnectorAuth(options), json, async (req: Request, res: Response) => {
    const auth = res.locals.connectorAuth as ConnectorAuth;
    // Stateless: a fresh server and transport per request.
    const server = createMcpServer({ db: options.db, ...auth });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("Claude connector request failed:", error as Error);
      if (!res.headersSent)
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  });

  router.all("/mcp", mcpLimiter, requireConnectorAuth(options), (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  });

  router.use("/mcp", (error: Error & { type?: string; status?: number }, _req: Request, res: Response, next: express.NextFunction) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({ jsonrpc: "2.0", error: { code: -32600, message: "Request is larger than 1 MB." }, id: null });
    next(error);
  });

  return router;
}

// Returns null when the connector is not configured, so ROZA runs without it.
const required = ["MCP_DB_URL", "MCP_PUBLIC_URL", "MCP_TOKEN_SECRET", "MCP_PASSPHRASE", "MCP_OWNER_USER_ID"] as const;

export function createConnectorRouterFromEnv(): Router | null {
  const env = process.env;
  const missing = required.filter(name => !env[name]);
  if (missing.length) {
    if (missing.length < required.length)
      logger.warn(`Claude connector is off: set ${missing.join(", ")}.`);
    return null;
  }
  const { MCP_DB_URL, MCP_PUBLIC_URL, MCP_TOKEN_SECRET, MCP_PASSPHRASE, MCP_OWNER_USER_ID } = env as Record<(typeof required)[number], string>;
  if (MCP_TOKEN_SECRET.length < 32 || MCP_PASSPHRASE.length < 16 || !/^[a-f0-9]{24}$/i.test(MCP_OWNER_USER_ID)) {
    logger.warn(
      "Claude connector is off: MCP_TOKEN_SECRET needs 32+ characters, MCP_PASSPHRASE 16+, and MCP_OWNER_USER_ID must be a 24-character user id.",
    );
    return null;
  }
  return createConnectorRouter({
    db: connectConnectorDb(MCP_DB_URL, getDbName()),
    publicUrl: MCP_PUBLIC_URL.replace(/\/+$/, ""),
    tokenSecret: MCP_TOKEN_SECRET,
    extraRedirectUris: (env.MCP_EXTRA_REDIRECT_URIS || "").split(",").map(s => s.trim()).filter(Boolean),
    ...passphraseSignIn(MCP_TOKEN_SECRET, MCP_PASSPHRASE, MCP_OWNER_USER_ID),
  });
}

// The connector never reads the users collection. It acts as the configured owner.
export function passphraseSignIn(secret: string, passphrase: string, ownerUserId: string) {
  const owner = ownerUserId.toLowerCase();
  const expected = Buffer.from(hmac(secret, passphrase));
  return {
    authenticate: async (given: string) => {
      if (!crypto.timingSafeEqual(Buffer.from(hmac(secret, given)), expected)) throw new Error("Wrong passphrase.");
      return owner;
    },
    // Tokens issued before MCP_OWNER_USER_ID changed stop working.
    isUserAllowed: async (userId: string) => userId === owner,
  };
}

function getDbName(): string {
  const { NODE_ENV, PROD_DB_NAME, DEV_DB_NAME, TEST_DB_NAME, MCP_DB_NAME } = process.env;
  if (MCP_DB_NAME) return MCP_DB_NAME;
  if (NODE_ENV === "production") return PROD_DB_NAME as string;
  if (NODE_ENV === "test") return TEST_DB_NAME as string;
  return DEV_DB_NAME as string;
}
