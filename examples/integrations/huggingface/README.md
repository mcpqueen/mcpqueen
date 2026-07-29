# MCP Queen with Hugging Face

This example uses the experimental `huggingface_hub.Agent` (Tiny Agent) to
connect to MCP Queen over Streamable HTTP. It allowlists only MCP Queen's six
read-only discovery and evidence tools; `submit_feedback` is excluded.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export HF_TOKEN="your-hugging-face-token"
python main.py
```

Optional settings:

```bash
export HF_MODEL="Qwen/Qwen3-32B"
export HF_PROVIDER="auto"
python main.py "Find an MCP tool that searches FDA 510(k) records"
```

Inference availability and pricing depend on the model and provider connected
to your Hugging Face account. MCP Queen itself is public and requires no key.

Official reference:
[Hugging Face MCPClient and Agent](https://huggingface.co/docs/huggingface_hub/main/en/package_reference/mcp).
