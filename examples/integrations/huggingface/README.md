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

The public
[MCP Queen server grades dataset](https://huggingface.co/datasets/healthai-hq/mcp-server-grades)
contains the dated source CSV and Hub-generated Parquet conversion. Its
reproducibility metadata and dataset card are maintained under
[`distribution/huggingface`](../../../distribution/huggingface).

A new dated snapshot is published when the underlying MCP Queen report changes
materially. Historical snapshots remain available, the card's counts and
methodology date are updated with each snapshot, and links, schema, downloads,
and generated Parquet are audited monthly.
