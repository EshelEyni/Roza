# Connect Roza to ChatGPT and Codex

Both clients use Roza's existing Streamable HTTP MCP endpoint, OAuth sign-in, and Dev Board and Staging Room tools. Changes to staged projects can be reviewed and pushed to Writing Studio from the Roza interface.

## ChatGPT

1. Deploy the OAuth compatibility update to the Roza backend you want to access. Follow the [existing connector setup](claude-connector.md#setup) for the connector database user, owner, and passphrase. Set `MCP_PUBLIC_URL` to the HTTPS origin that ChatGPT will reach.
2. In ChatGPT on the web, go to **Plugins → + → Add custom MCP server**. Name it **Roza** and enter the backend's full MCP URL, for example `https://roza.esheleyni.com/mcp`. Choose **OAuth** with **Dynamic Client Registration**.
3. Create and install the plugin, then select it in a chat. Enter the connector passphrase on Roza's sign-in page when prompted.
4. Ask Roza to list Dev Board tickets and Staging Room projects to verify both collections are accessible.

Roza advertises OAuth issuer identification and allows ChatGPT's stable callback, `https://chatgpt.com/connector_platform_oauth_redirect`. If the plugin settings show a different callback, add that exact URL to the backend's comma-separated `MCP_EXTRA_REDIRECT_URIS`.

For a private development backend, see [Secure MCP Tunnel](https://developers.openai.com/plugins/deploy/connect-chatgpt). If you use a public HTTPS URL for development, set `MCP_PUBLIC_URL` to that origin so the browser and ChatGPT can reach authorization and discovery.

## Codex

For the deployed backend:

```powershell
codex mcp add roza --url https://roza.esheleyni.com/mcp --oauth-client-registration dcr
```

For a local development backend, follow the [existing local setup](claude-connector-testing.md) and use its local origin:

```powershell
codex mcp add roza-dev --url http://localhost:3030/mcp --oauth-client-registration dcr
```

Enter the passphrase on Roza's sign-in page. If the server is already registered and you need to sign in again, run `codex mcp login roza` (or `codex mcp login roza-dev` for local development). Open a fresh Codex session and ask the selected server to list Dev Board tickets and Staging Room projects. [Codex MCP setup](https://developers.openai.com/codex/mcp)
