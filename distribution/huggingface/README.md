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
    path: mcpqueen-grades-2026-07-28.csv
---

# MCP Queen operational grades snapshot

This prepared dataset card describes the dated CSV snapshot published by
[MCP Queen](https://mcpqueen.com/data/mcpqueen-grades-2026-07-28.csv). It does
not represent a live Hugging Face dataset until a Hub repository URL is added
to the canonical
[distribution manifest](https://github.com/mcpqueen/mcpqueen/blob/main/distribution/mcpqueen.json).

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
