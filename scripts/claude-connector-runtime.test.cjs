const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

// The Claude connector loads the MCP SDK and shared types. Check that the backend
// ts-node development runner (CommonJS) can load it, with the connector turned on.
test("Claude connector loads with the backend ts-node development runner", () => {
  const backend = path.resolve(__dirname, "../backend");
  const result = spawnSync(process.execPath, [
    path.join(backend, "node_modules/ts-node/dist/bin.js"),
    "--transpile-only", "-e",
    [
      "process.env.MCP_DB_URL = 'mongodb://127.0.0.1:1/never';",
      "process.env.MCP_PUBLIC_URL = 'https://roza.test';",
      "process.env.MCP_TOKEN_SECRET = 'x'.repeat(40);",
      "process.env.MCP_PASSPHRASE = 'p'.repeat(20);",
      "process.env.MCP_OWNER_USER_ID = 'a'.repeat(24);",
      "const router = require('./src/mcp/connectorRouter').createConnectorRouterFromEnv();",
      "if (!router) throw new Error('connector router was not created');",
      "require('./src/mcp/mcpServer'); require('./src/app');",
      "process.exit(0);",
    ].join(" "),
  ], { cwd: backend, encoding: "utf8", timeout: 60000, env: { ...process.env, NODE_ENV: "test" } });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
