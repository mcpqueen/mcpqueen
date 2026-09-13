# Minimal MCP clients

These examples call MCP Queen's public Streamable HTTP endpoint directly. They
use no model provider and invoke only the read-only `search_servers` tool.

## Python SDK

The official MCP Python SDK 2.x accepts a remote URL directly:

```bash
cd examples/clients/python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py "GitHub issue triage"
```

## Node.js without dependencies

Node 18+ includes `fetch`, so the JSON-RPC lifecycle can be inspected without
installing a package:

```bash
node examples/clients/node-http.mjs "GitHub issue triage"
```

The Node example sends `initialize`, `notifications/initialized`,
`tools/list`, and `tools/call` over Streamable HTTP. Production clients should
normally use an official MCP SDK so session, streaming, and protocol changes
are handled by the library.

Official references:

- [MCP Python SDK client](https://github.com/modelcontextprotocol/python-sdk#a-client-in-10-lines)
- [MCP TypeScript client guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md)
