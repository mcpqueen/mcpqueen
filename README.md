# MCP Queen

MCP Queen is a public discovery and evidence service for Model Context Protocol
servers. It publishes dated operational observations, tool metadata, and
separate Trust Receipts so developers and agents can inspect evidence before
deciding what to connect.

An MCP Queen operational grade is not a security, privacy, data-quality, or
compliance certification. Missing evidence is unaudited, not safe.

## Use the hosted endpoint

The public Streamable HTTP endpoint requires no account for rate-limited
evaluation:

```text
https://mcpqueen.com/mcp
```

It exposes six read-only discovery/evidence tools and one additive feedback
tool:

- `search_servers`
- `search_tools`
- `list_grades`
- `get_server_grade`
- `get_trust_receipt`
- `search_trust_evidence`
- `submit_feedback` — writes only to a quarantined review queue

For human-readable setup and current service limits, use
[mcpqueen.com/connect](https://mcpqueen.com/connect).

### Claude Code

```bash
claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp
```

### Direct protocol examples

The model-free examples under [`examples/clients`](examples/clients) call the
hosted endpoint directly:

```bash
node examples/clients/node-http.mjs "GitHub issue triage"
```

The Python version uses the official MCP SDK. Additional examples show bounded
integration with LangChain, LlamaIndex, Cloudflare Agents, Hugging Face, and
the OpenAI Responses API. Agent examples allowlist only the six read-only
tools; `submit_feedback` is excluded from automatic model access.

## Optional local stdio bridge

This repository contains a small zero-dependency stdio bridge for clients that
cannot connect to a remote Streamable HTTP endpoint directly. The bridge does
not contain MCP Queen's hosted implementation or evidence corpus; it forwards
JSON-RPC messages to `https://mcpqueen.com/mcp`.

```bash
git clone https://github.com/mcpqueen/mcpqueen.git
cd mcpqueen
npm ci
npm start
```

To point the bridge at another compatible endpoint during local testing, set
`MCPQUEEN_MCP_URL` in the process environment.

Docker is also supported:

```bash
docker build -t mcpqueen-bridge .
docker run --rm -i mcpqueen-bridge
```

## What this public repository contains

- registry metadata: [`server.json`](server.json) and [`glama.json`](glama.json)
- the hosted-endpoint stdio bridge: [`server.mjs`](server.mjs)
- model-free and framework examples: [`examples`](examples)
- public architecture and trust boundaries:
  [`docs/architecture.md`](docs/architecture.md)
- deterministic tests and read-only CI

The production Worker, deployment configuration, evidence database,
submission packages, operational records, and private source history are not
part of this public developer surface. This repository is not a production
deployment source.

## Verify locally

```bash
npm ci
npm test
```

The tests exercise the bridge against a local mock endpoint and verify that
public documentation and package scripts reference files that are actually in
this repository.

## License and support

Code in this repository is available under the [MIT License](LICENSE).
Product documentation, privacy, terms, and support are available from
[mcpqueen.com](https://mcpqueen.com/).
