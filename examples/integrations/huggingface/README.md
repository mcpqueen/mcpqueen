# MCP Queen with Hugging Face

This example uses Hugging Face Inference Providers' Responses API to connect a
hosted model to MCP Queen over remote MCP. It allowlists only MCP Queen's six
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
export HF_MODEL="moonshotai/Kimi-K2-Instruct-0905:groq"
python main.py "Find an MCP tool that searches FDA 510(k) records"
```

Inference availability and pricing depend on the model and provider connected
to your Hugging Face account. MCP Queen itself is public and requires no key.

Official reference:
[Hugging Face remote MCP execution](https://huggingface.co/docs/inference-providers/guides/responses-api#remote-mcp-execution).

The dated MCP Queen CSV has a prepared Hub dataset card and machine-readable
metadata under [`distribution/huggingface`](../../../distribution/huggingface).
No public Hugging Face dataset URL is claimed until a Hub repository is
created, populated, and verified.
