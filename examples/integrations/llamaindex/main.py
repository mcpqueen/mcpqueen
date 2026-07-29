"""Call MCP Queen through LlamaIndex without an LLM API key."""

import asyncio

from llama_index.tools.mcp import BasicMCPClient


MCP_URL = "https://mcpqueen.com/mcp"


async def main() -> None:
    client = BasicMCPClient(MCP_URL)
    tools = await client.list_tools()
    print("Available tools:", ", ".join(tool.name for tool in tools.tools))

    result = await client.call_tool(
        "search_servers",
        {
            "query": "GitHub issue triage",
            "auth": "open",
            "limit": 5,
        },
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
