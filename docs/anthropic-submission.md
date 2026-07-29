# Anthropic Connectors Directory submission

Prepared: 2026-07-29

Official requirements:

- <https://claude.com/docs/connectors/building/submission>
- <https://claude.com/docs/connectors/building/review-criteria>
- <https://claude.com/docs/connectors/building/testing>

## Listing facts

**Connector name**

MCP Queen

**Remote MCP server URL**

https://mcpqueen.com/mcp

**Authentication**

No authentication.

**Short description**

Search MCP servers and tools, inspect current operational grades and Trust
Receipts, and review dated evidence before connecting an AI agent.

**Long description**

MCP Queen is an evidence and discovery layer for the MCP ecosystem. It searches
servers and their observed tool catalogs, publishes deterministic operational
grades, and exposes dated Trust Receipt observations across security, data
integrity, citation quality, claim verification, response behavior, and
reviewed field reports. Operational grades measure observed availability,
protocol behavior, tool discovery, and latency; they are not security,
privacy, compliance, or data-quality certifications. Missing evidence is
reported as unaudited, not safe.

**Documentation**

https://mcpqueen.com/integrations

**Support**

https://github.com/mcpqueen/mcpqueen/issues

**Privacy policy**

https://mcpqueen.com/privacy

**Terms**

https://mcpqueen.com/terms

**Repository**

https://github.com/mcpqueen/mcpqueen

**Suggested categories**

Developer tools; MCP discovery; security and trust evidence.

## Primary use cases

1. Find an MCP server or specific tool for a task and filter by observed
   operational grade, authentication state, latency, or category.
2. Inspect a server's Trust Receipt before connecting, including dated
   evidence and explicit unaudited dimensions.
3. Compare observed capabilities and operational evidence, then connect
   directly to the selected server.

## Tool catalog

| Tool | Human-readable title | Behavior |
|---|---|---|
| `search_servers` | Search MCP Servers | Read-only |
| `search_tools` | Search MCP Tools | Read-only |
| `list_grades` | List Operational Grades | Read-only |
| `get_server_grade` | Get Server Grade | Read-only |
| `get_trust_receipt` | Get Trust Receipt | Read-only |
| `search_trust_evidence` | Search Trust Evidence | Read-only |
| `submit_feedback` | Submit Field Report | Write, non-destructive; quarantined for human review |

All tools declare `readOnlyHint` and `destructiveHint`. The write tool never
auto-publishes a report.

## Reviewer test

1. Add `https://mcpqueen.com/mcp` as a custom connector in Claude.
2. Confirm that initialization succeeds without authentication.
3. Run: `Find MCP tools for GitHub issue triage. Prefer open access and show
   current operational evidence.`
4. Run: `Show the Trust Receipt for com.healthai/radar. Separate observed
   evidence from unaudited dimensions.`
5. Run: `Search MCP Queen for citation-quality concerns and include the
   observation dates.`
6. Confirm that results link to evidence pages and do not describe operational
   grades as security certification.
7. Optionally submit a clearly labeled test field report. Confirm that the
   response says it is quarantined for human review rather than published.

## Media requirement

MCP Queen does not include an MCP App or custom interactive UI. Anthropic's
submission requirements request three to five PNG screenshots only for MCP Apps
with UI, and do not accept a video or GIF in place of screenshots. Therefore
screenshots and a demo video are not applicable to this connector.

## Pre-submission verification

- Run `npm test`.
- Run `npm run distribution:check`.
- Deploy the released tool-title change from the declared deployment worktree.
- Run `npm run distribution:check:live` against the released endpoint.
- Test all seven tools in MCP Inspector.
- Add the endpoint as a custom connector in Claude and execute the reviewer
  prompts above.
- Confirm public documentation, support, privacy, and terms URLs.
- Submit through the authorized publisher account and save the confirmation or
  review receipt.
