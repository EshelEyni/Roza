import mongoose, { Connection, Model, Schema } from "mongoose";
import type { mongo } from "mongoose";
type Collection<T extends mongo.Document> = mongo.Collection<T>;
type Document = mongo.Document;
import { logger } from "../services/logger/loggerService";

// The connector uses its own MongoDB connection with a dedicated, least-privilege
// user (MCP_DB_URL). It only ever opens the collections listed here. See
// docs/claude-connector.md for the role that user needs.

export const CONNECTOR_COLLECTIONS = {
  devTickets: "dev_board_tickets",
  devAttachments: "dev_board_attachments",
  stagingProjects: "staging_room_projects",
  stagingBackups: "staging_room_backups",
  stagingPreferences: "staging_room_preferences",
  oauthClients: "mcp_oauth_clients",
  oauthGrants: "mcp_oauth_grants",
  audit: "mcp_audit_log",
} as const;

export type OAuthClient = {
  clientId: string;
  secretHash?: string;
  clientName?: string;
  redirectUris: string[];
  createdAt: Date;
};
export type OAuthGrant = {
  kind: "code" | "access" | "refresh";
  hash: string;
  clientId: string;
  userId: string;
  redirectUri?: string;
  codeChallenge?: string;
  scope: string;
  expiresAt: Date;
};
export type AuditEntry = {
  at: Date;
  userId: string;
  clientId: string;
  tool: string;
  outcome: "ok" | "refused" | "error";
  target?: string;
  message?: string;
};

export type ConnectorDb = {
  devTickets: () => Collection<Document>;
  devAttachments: () => Collection<Document>;
  stagingProjects: () => Collection<Document>;
  stagingBackups: () => Collection<Document>;
  stagingPreferences: () => Collection<Document>;
  dbName: () => string;
  Clients: Model<OAuthClient>;
  Grants: Model<OAuthGrant>;
  Audit: Model<AuditEntry>;
};

const clientSchema = new Schema<OAuthClient>(
  {
    clientId: { type: String, required: true, unique: true },
    secretHash: String,
    clientName: { type: String, maxlength: 200 },
    redirectUris: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
const grantSchema = new Schema<OAuthGrant>(
  {
    kind: { type: String, enum: ["code", "access", "refresh"], required: true },
    hash: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    userId: { type: String, required: true },
    redirectUri: String,
    codeChallenge: String,
    scope: { type: String, default: "" },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false },
);
const auditSchema = new Schema<AuditEntry>(
  {
    at: { type: Date, required: true },
    userId: String,
    clientId: String,
    tool: String,
    outcome: String,
    target: String,
    message: String,
  },
  { versionKey: false },
);

export function createConnectorDb(connection: Connection): ConnectorDb {
  const raw = (name: string, options?: { promoteBuffers?: boolean }) => () =>
    connection.db!.collection(name, options);
  const names = CONNECTOR_COLLECTIONS;
  return {
    devTickets: raw(names.devTickets),
    devAttachments: raw(names.devAttachments, { promoteBuffers: true }),
    stagingProjects: raw(names.stagingProjects),
    stagingBackups: raw(names.stagingBackups),
    stagingPreferences: raw(names.stagingPreferences),
    dbName: () => connection.name,
    Clients: connection.model<OAuthClient>("McpOAuthClient", clientSchema, names.oauthClients),
    Grants: connection.model<OAuthGrant>("McpOAuthGrant", grantSchema, names.oauthGrants),
    Audit: connection.model<AuditEntry>("McpAuditEntry", auditSchema, names.audit),
  };
}

export function connectConnectorDb(url: string, dbName: string): ConnectorDb {
  // autoIndex is off: the connector user may only create indexes on its own collections.
  const connection = mongoose.createConnection(url, { dbName, autoIndex: false });
  connection.on("error", error => logger.error("Claude connector DB error:", error));
  const db = createConnectorDb(connection);
  connection
    .asPromise()
    .then(async () => {
      logger.info("Claude connector connected to MongoDB.");
      await Promise.all([db.Clients.createIndexes(), db.Grants.createIndexes()]);
    })
    .catch(error => logger.error("Claude connector DB setup failed:", error));
  return db;
}
