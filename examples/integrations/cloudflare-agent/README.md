# MCP Queen with Cloudflare Agents

This deployable Worker uses Cloudflare's Agents SDK as an MCP client. Each
durable agent instance connects to MCP Queen in `onStart()`, exposes only its six
read-only discovery/evidence tools to Workers AI, and answers a JSON prompt.

```bash
npm install
npm run typecheck
npm run dev
```

Call the local agent:

```bash
curl -X POST http://localhost:8787/agents/mcp-queen-agent/default \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Find a no-auth MCP server for GitHub issue triage and explain the evidence."}'
```

Deploy it under your own Cloudflare account with `npm run deploy`. Workers AI
does not require a separate model-provider API key, but normal Workers/Agents
usage and pricing apply.

Official reference:
[Cloudflare Agents as an MCP client](https://developers.cloudflare.com/agents/tools/mcp/).
