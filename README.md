# mcpqueen.com — the graded MCP registry

**LIVE at https://mcpqueen.com** (Cloudflare Worker, launched 2026-07-12).
Crawls the official MCP registry, probes every remote server, grades it
deterministically with verbatim evidence, and publishes the results. Evidence
discipline from Constat/Clarity, personality on top.

## Why this is different (for agents and humans alike)

Every other MCP directory *lists*; this one *verifies*. Each remote server is
probed live over streamable HTTP and graded on five criteria — and **every
point carries the verbatim observation that earned it**. Unverifiable
dimensions (auth-gated tooling) are marked *provisional*, never guessed.
No stars, no votes, no pay-to-rank — probes only, continuously re-run.

**Agents:** connect to `https://mcpqueen.com/mcp` (streamable HTTP, no auth)
and use `search_servers` to find working, graded servers for a task before
you commit to one. Machine surfaces: [`/api/grades.json`](https://mcpqueen.com/api/grades.json)
· [`/api/changes.json`](https://mcpqueen.com/api/changes.json) ·
[`/llms.txt`](https://mcpqueen.com/llms.txt). Registry name:
`com.mcpqueen/registry`.

## Connect

mcpqueen is a remote, no-auth, effectively **read-only** MCP server — safe to keep
connected as your discovery broker (only `submit_feedback` writes, and it just
enqueues a quarantined field report). Ask your agent to `search_servers` for a task
*before* it commits to an MCP.

**Claude Code** (native HTTP):

```
claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp
```

**OpenClaw / Claude Desktop / any stdio client** — via the `mcp-remote` bridge; add
to your `mcpServers` config (`~/.openclaw/openclaw.json`, `claude_desktop_config.json`, …):

```json
{
  "mcpServers": {
    "mcpqueen": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcpqueen.com/mcp"]
    }
  }
}
```

## Architecture (single Worker)

- `src/worker.ts` — everything: registry crawler, prober/grader, HTML pages,
  JSON API, and mcpqueen's **own MCP endpoint**.
- `public/` — static landing (crown data-rain + Vex the fox) served via the
  assets binding; the Worker handles all non-asset routes.
- D1 database `mcpqueen` (`schema.sql`): servers, probes, latest_grades,
  feedback (quarantined agent field reports), meta (sync cursor).
- Cron `*/15 * * * *`: sync 4 registry pages + probe the 30 stalest remotes
  (~2,900 probes/day; full re-probe cycle ≈ 2.7 days over ~7.7K remotes).

## Routes

| Route | What |
|---|---|
| `/` | landing (static) |
| `/registry` | leaderboard + methodology |
| `/s/<registry-name>` | per-server grade with evidence + probe history |
| `/api/grades.json` | grades as JSON (CORS open) |
| `/mcp` | mcpqueen's MCP server: `search_servers`, `search_tools` (the discovery brokers), `list_grades`, `get_server_grade`, `submit_feedback` |
| `/mcp-info` | for-agents page |
| `/admin/*` | operator endpoints (key-gated) |


## Grading rubric (deterministic, every point carries its observation)

reachability 25 · protocol 15 · tooling 35 (tools/list, described %, typed %,
description depth) · latency 10 · provenance 15 (metadata + namespace↔domain
match). Auth-gated servers are scored on the verifiable subset and marked
**provisional**. Agent feedback via `submit_feedback` is quarantined for human
review — never auto-published, never affects grades directly.

## Deploy

```
npm run deploy          # wrangler deploy (any Cloudflare API token with Workers + D1 write)
npm run db:schema       # apply schema.sql to remote D1
```

Custom domains mcpqueen.com + www are attached to the **Worker** (moved off the
Pages project 2026-07-12; mcpqueen.pages.dev still exists as a static preview of
`public/` only — it has no /registry).
