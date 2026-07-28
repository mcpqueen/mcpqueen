---
license: mit
task_categories:
- tabular-classification
tags:
- mcp
- model-context-protocol
- ai-agents
- server-monitoring
- trust
pretty_name: MCP Queen — Live Grades of the MCP Ecosystem
size_categories:
- 1K<n<10K
---

# MCP Queen: Live Grades of the MCP Ecosystem

Deterministic operational grades for every remote server in the official
Model Context Protocol registry, from continuous live probes by
[MCP Queen](https://mcpqueen.com), the trust layer for the MCP ecosystem.

**9,326 remote servers** graded from **43,320+ live probes** (July 2026
snapshot). Each row is a server's latest probe result.

## Columns

| column | meaning |
|---|---|
| server_name | reverse-DNS registry name (e.g. com.healthai/clarity) |
| title | display title from the official registry |
| grade | A–F deterministic grade |
| score | 0–100 (reachability 25, protocol 15, tooling 35, latency 10, provenance 15) |
| provisional | 1 = auth-gated, tooling unverifiable, scored on verifiable subset |
| reachable | 1 = endpoint answered the probe |
| auth_state | open / auth-wellbehaved / auth-bare / unreachable |
| latency_ms | round-trip of the probe |
| tool_count | tools returned by tools/list |
| probed_at | ISO timestamp of the probe |
| repo_url / website_url / remote_type | registry metadata |

## Method

Live streamable-HTTP probes: initialize handshake, tools/list schema
quality, latency, namespace provenance. Every grade point stores the
verbatim observation that earned it; auth-gated servers are marked
provisional, never guessed. No stars, no votes, no pay-to-rank.

Full methodology and per-server evidence: https://mcpqueen.com/registry
Live API (no auth): https://mcpqueen.com/api/grades.json
Report generated from this data: https://mcpqueen.com/reports/state-of-mcp-2026-07

## Citation

MCP Queen (Health AI), "Live Grades of the MCP Ecosystem", July 2026.
https://mcpqueen.com
