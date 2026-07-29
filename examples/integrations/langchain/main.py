"""Call MCP Queen through LangChain's MCP adapter without an LLM API key."""

import asyncio

from langchain_mcp_adapters.client import MultiServerMCPClient


MCP_URL = "https://mcpqueen.com/mcp"


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "mcpqueen": {
                "transport": "http",
                "url": MCP_URL,
            }
        }
    )
    tools = await client.get_tools()
    search = next(tool for tool in tools if tool.name == "search_servers")
    result = await search.ainvoke(
        {
            "query": "GitHub issue triage",
            "auth": "open",
            "limit": 5,
        }
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
