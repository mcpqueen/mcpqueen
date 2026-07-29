# Developer ecosystem compatibility

Verified against official primary documentation on 2026-07-29. “Supported”
means the named client documents the remote MCP transport used by MCP Queen; it
does not imply a vendor partnership, directory listing, or endorsement.

## Compatibility matrix

| Surface | Remote MCP path | Repository asset | Status and value |
|---|---|---|---|
| GitHub repository examples | Official MCP Python SDK 2.x accepts a remote URL; raw Streamable HTTP is also inspectable from Node 18+ | [`examples/clients`](../examples/clients) | Supported. Highest-value copy/paste path because no framework or model provider is required. |
| LangChain | `MultiServerMCPClient` with `transport: "http"` | [`examples/integrations/langchain`](../examples/integrations/langchain) | Supported. Direct read-only tool call needs no model key. This is an integration example, not a directory listing. |
| LlamaIndex | `BasicMCPClient` accepts the remote endpoint and calls tools | [`examples/integrations/llamaindex`](../examples/integrations/llamaindex) | Supported. Direct read-only tool call needs no model key. This is an integration example, not a directory listing. |
| Cloudflare Agents | `addMcpServer()` connects an Agent to a public remote server; `getAITools()` exposes tools to the AI SDK | [`examples/integrations/cloudflare-agent`](../examples/integrations/cloudflare-agent) | Supported. Cloudflare's managed catalog documents Cloudflare's own servers, so no third-party catalog claim is made. The example is a short Agent request; a Workflow would add complexity without durable-work value. |
| Hugging Face | Inference Providers' Responses API accepts a remote MCP `server_url` and `allowed_tools` | [`examples/integrations/huggingface`](../examples/integrations/huggingface) | Supported for inference. The public [MCP Queen server grades dataset](https://huggingface.co/datasets/healthai-hq/mcp-server-grades) contains the dated snapshot and Hub-generated Parquet. |
| RapidAPI | Provider documentation describes REST endpoints and OpenAPI definitions, not an MCP transport or MCP directory | None | Hold. A listing would distribute the companion JSON API, not the MCP endpoint, and is justified only by distinct REST demand. |

All automatic model examples allowlist the six read-only discovery/evidence
tools. `submit_feedback` is excluded because it creates a quarantined field
report.

## Verification commands

Run these from the repository root:

```bash
npm run examples:check
npm test
npm run distribution:check
npm run distribution:check:live
git diff --check
```

The deterministic example check validates syntax, the canonical endpoint,
published dependency versions, read-only allowlists, dataset-card metadata,
row counts, and cross-links. The live distribution check initializes the
public endpoint and verifies its advertised tools without calling
`submit_feedback`.

## Official sources

- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk#a-client-in-10-lines)
- [MCP TypeScript client guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md)
- [LangChain MCP adapters](https://docs.langchain.com/oss/python/langchain/mcp)
- [LangChain adapter release](https://pypi.org/project/langchain-mcp-adapters/0.3.1/)
- [LlamaIndex MCP package](https://pypi.org/project/llama-index-tools-mcp/0.4.8/)
- [Cloudflare Agents MCP client](https://developers.cloudflare.com/agents/tools/mcp/)
- [Cloudflare's own MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/)
- [Cloudflare Agents and Workflows](https://developers.cloudflare.com/agents/runtime/execution/run-workflows/)
- [Hugging Face remote MCP execution](https://huggingface.co/docs/inference-providers/guides/responses-api#remote-mcp-execution)
- [Hugging Face dataset cards](https://huggingface.co/docs/hub/en/datasets-cards)
- [RapidAPI endpoint definitions](https://docs.rapidapi.com/docs/hub-listing-definitions-tab)
- [RapidAPI OpenAPI metadata](https://docs.rapidapi.com/docs/adding-and-updating-openapi-documents)

## Human gates

- Review the Hugging Face dataset license treatment before expanding reuse
  rights. Publish a new dated snapshot on material report changes and audit
  metadata, schema, links, and generated Parquet monthly.
- RapidAPI remains intentionally unprepared. Reconsider it only when a
  measurable REST audience justifies a separate API-marketplace surface; any
  account creation, listing, contract, pricing, or publication remains human
  work.
