---
license: other
language:
- en
pretty_name: MCP Queen Operational Grades Snapshot
tags:
- mcp
- model-context-protocol
- observability
- software-infrastructure
configs:
- config_name: default
  data_files:
  - split: train
    path: mcpqueen_grades_2026-07-28.csv
---

# MCP Queen operational grades snapshot

This dataset card describes the dated CSV snapshot published in the
[MCP Queen server grades dataset](https://huggingface.co/datasets/healthai-hq/mcp-server-grades)
and by
[MCP Queen](https://mcpqueen.com/data/mcpqueen-grades-2026-07-28.csv).

The snapshot contains 9,326 rows derived from deterministic protocol probes of
remote servers in the official MCP Registry. Each row records operational
observations such as reachability, protocol response, tool count, latency, and
provenance fields at the snapshot time.

An operational grade is not a security, privacy, compliance, or data-quality
certification. Trust Receipt dimensions, response benchmarks, and reviewed
field reports are separate and are not included in this CSV. Missing evidence
is unaudited, not safe.

## Source and reproducibility

- Snapshot date: 2026-07-28
- Rows: 9,326
- Format: CSV
- Canonical file:
  `https://mcpqueen.com/data/mcpqueen-grades-2026-07-28.csv`
- Hugging Face dataset:
  `https://huggingface.co/datasets/healthai-hq/mcp-server-grades`
- Hugging Face snapshot file:
  `mcpqueen_grades_2026-07-28.csv`
- Hugging Face generated Parquet:
  available through the Hub dataset viewer and `refs/convert/parquet`
- Repository:
  `https://github.com/mcpqueen/mcpqueen`
- Methodology:
  `https://mcpqueen.com/registry#methodology`
- Live JSON:
  `https://mcpqueen.com/api/grades.json`

The repository is MIT licensed. The snapshot aggregates public registry
metadata and MCP Queen observations; no separate dataset license has been
declared, so the card uses Hugging Face's `other` license value rather than
asserting broader reuse rights.

## Update cadence

Publish a new dated snapshot when the underlying ecosystem report changes
materially, rather than mirroring every short-interval probe. Keep older
snapshots reproducible, update the methodology date and counts on each release,
and audit the card, schema, links, and generated Parquet monthly.

## Columns

| Column | Meaning |
|---|---|
| `server_name` | Official MCP Registry name |
| `title` | Registry display title, when present |
| `grade`, `score` | Deterministic operational result |
| `provisional` | Whether the grade covers only observable behavior |
| `reachable` | Whether the endpoint answered the probe |
| `auth_state` | Observed protocol-discovery access state |
| `latency_ms` | Initialize round-trip latency |
| `tool_count` | Tools observed through `tools/list` |
| `probed_at` | Timestamp of the recorded probe |
| `repo_url`, `website_url` | Registry provenance links, when present |
| `remote_type` | Registry transport type |
