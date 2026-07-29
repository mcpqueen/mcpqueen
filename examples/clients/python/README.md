# MCP Queen with the official Python SDK

This is the shortest dependency-backed client in the repository. It connects
to the public endpoint, calls `search_servers` directly, and requires no API
key or model provider.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py "GitHub issue triage"
```

The example tracks the stable 2.x line of the official
[`mcp` package](https://pypi.org/project/mcp/).
