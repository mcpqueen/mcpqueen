"""Run a Hugging Face tiny agent with MCP Queen's read-only tools."""

import asyncio
import os
import sys

from huggingface_hub import Agent


MCP_URL = "https://mcpqueen.com/mcp"
READ_ONLY_TOOLS = [
    "search_servers",
    "search_tools",
    "list_grades",
    "get_server_grade",
    "get_trust_receipt",
    "search_trust_evidence",
]


def text_delta(item: object) -> str:
    """Return streamed assistant text while ignoring tool-call metadata."""
    choices = getattr(item, "choices", None)
    if not choices:
        return ""
    delta = getattr(choices[0], "delta", None)
    return getattr(delta, "content", "") or ""


async def main() -> None:
    if not os.getenv("HF_TOKEN"):
        raise SystemExit("Set HF_TOKEN before running this example.")

    agent = Agent(
        model=os.getenv("HF_MODEL", "Qwen/Qwen3-32B"),
        provider=os.getenv("HF_PROVIDER", "auto"),
        servers=[
            {
                "type": "http",
                "config": {
                    "url": MCP_URL,
                    "allowed_tools": READ_ONLY_TOOLS,
                },
            }
        ],
        prompt=(
            "Use MCP Queen to find and compare MCP servers. Treat operational "
            "grades separately from security or data-quality evidence, and "
            "state when a dimension is unaudited."
        ),
    )

    prompt = " ".join(sys.argv[1:]).strip() or (
        "Find a well-maintained, no-auth MCP server for GitHub issue triage. "
        "Explain the evidence and caveats."
    )

    try:
        await agent.load_tools()
        async for item in agent.run(prompt):
            if text := text_delta(item):
                print(text, end="", flush=True)
        print()
    finally:
        await agent.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
