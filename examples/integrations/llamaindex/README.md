# MCP Queen with LlamaIndex

This example connects LlamaIndex's `BasicMCPClient` to MCP Queen's remote
Streamable HTTP endpoint, lists its tools, and calls the read-only
`search_servers` tool. It does not need an LLM provider or API key.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Use `McpToolSpec(client=client)` when you want to convert the same remote tools
into LlamaIndex `FunctionTool` objects for an agent.

Official reference:
[`llama-index-tools-mcp`](https://github.com/run-llama/llama_index/tree/main/llama-index-integrations/tools/llama-index-tools-mcp).
