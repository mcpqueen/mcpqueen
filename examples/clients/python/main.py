"""Call MCP Queen with the official MCP Python SDK."""

import asyncio
import json
import sys

from mcp import Client


MCP_URL = "https://mcpqueen.com/mcp"


async def main() -> None:
    query = " ".join(sys.argv[1:]).strip() or "GitHub issue triage"
    async with Client(MCP_URL) as client:
        result = await client.call_tool(
            "search_servers",
            {"query": query, "auth": "open", "limit": 5},
        )
        value = result.structured_content or {
            "content": [
                block.model_dump(mode="json")
                for block in result.content
            ]
        }
        print(json.dumps(value, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
