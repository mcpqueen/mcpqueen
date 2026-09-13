"""Use Hugging Face Inference Providers with MCP Queen's read-only tools."""

import os
import sys

from openai import OpenAI


MCP_URL = "https://mcpqueen.com/mcp"
READ_ONLY_TOOLS = [
    "search_servers",
    "search_tools",
    "list_grades",
    "get_server_grade",
    "get_trust_receipt",
    "search_trust_evidence",
]


def main() -> None:
    token = os.getenv("HF_TOKEN")
    if not token:
        raise SystemExit("Set HF_TOKEN before running this example.")

    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=token,
    )
    prompt = " ".join(sys.argv[1:]).strip() or (
        "Find a well-maintained, no-auth MCP server for GitHub issue triage. "
        "Explain the evidence and caveats."
    )
    response = client.responses.create(
        model=os.getenv(
            "HF_MODEL",
            "moonshotai/Kimi-K2-Instruct-0905:groq",
        ),
        input=prompt,
        tools=[
            {
                "type": "mcp",
                "server_label": "mcpqueen",
                "server_url": MCP_URL,
                "allowed_tools": READ_ONLY_TOOLS,
                "require_approval": "never",
            }
        ],
    )

    print(response.output_text or response.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
