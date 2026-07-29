# MCP Queen with LangChain

This example loads MCP Queen's remote Streamable HTTP tools through
`langchain-mcp-adapters` and calls the read-only `search_servers` tool directly.
It does not need an LLM provider or API key.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

The result contains live MCP server matches, operational grades, endpoints, and
evidence caveats. To give the loaded tools to an agent, pass `tools` to
LangChain's `create_agent`.

Official reference:
[LangChain MCP adapters](https://docs.langchain.com/oss/python/langchain/mcp).
