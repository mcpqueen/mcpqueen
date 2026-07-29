# mcpqueen.com — the evidence layer for MCP

<a href="https://glama.ai/mcp/servers/@mcpqueen/mcpqueen">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@mcpqueen/mcpqueen/badge" alt="MCP Queen MCP server" />
</a>

**LIVE at https://mcpqueen.com** (Cloudflare Worker, launched 2026-07-12).
Crawls the official MCP registry, probes every remote server, grades it
deterministically with verbatim evidence, and publishes the results. Evidence
discipline from Constat/Clarity, personality on top.

## Why this is different (for agents and humans alike)

MCP Queen is the evidence layer for the MCP ecosystem. Every other MCP
directory *lists*; this one *verifies*. Each remote server is
probed live over streamable HTTP and graded on five criteria — and **every
point carries the verbatim observation that earned it**. Unverifiable
dimensions (auth-gated tooling) are marked *provisional*, never guessed.
No stars, no votes, no pay-to-rank — probes only, continuously re-run. Separate
Trust Receipts publish dated security/access, data-integrity, citation,
claim-verification, response-benchmark, and reviewed field evidence without
collapsing it into a misleading trust score.

**Agents:** connect to `https://mcpqueen.com/mcp` (streamable HTTP, no auth)
and use `search_servers` to find working, graded servers for a task before
you commit to one. Machine surfaces: [`/api/grades.json`](https://mcpqueen.com/api/grades.json)
· [`/api/changes.json`](https://mcpqueen.com/api/changes.json) ·
[`/llms.txt`](https://mcpqueen.com/llms.txt). Setup guides:
[`/integrations`](https://mcpqueen.com/integrations). Registry name:
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

### OpenAI: ChatGPT and Codex

MCP Queen can be registered directly as a private plugin/connector; no SDK,
Docker image, or local command is required:

1. In ChatGPT, open **Settings → Security and login** and enable
   **Developer mode**.
2. Open [ChatGPT Plugins](https://chatgpt.com/plugins), select **+**, and choose
   the option to add an MCP server.
3. Enter `https://mcpqueen.com/mcp` as a universal, no-auth remote MCP URL.
4. Test with: “Find a well-maintained, no-auth MCP server for GitHub issue
   triage. Explain the evidence and any caveats.”

For an OpenAI Responses API demo, Node 18+ is enough:

```bash
export OPENAI_API_KEY="your-api-key"
npm run demo:openai
```

Pass a custom prompt after `--`:

```bash
npm run demo:openai -- "Find an MCP server that can search FDA 510(k) records"
```

The demo allowlists only MCP Queen's read-only discovery and evidence tools.
`submit_feedback` is intentionally excluded.

For public distribution in ChatGPT and Codex, create a **With MCP** submission
in the [OpenAI plugin portal](https://platform.openai.com/plugins) and submit
the same universal endpoint. OpenAI's public review also requires verified
publisher identity, public support/privacy/terms URLs, accurate tool safety
annotations, starter prompts, and reviewer test cases.
The ready-to-paste listing copy and review cases are in
[`docs/openai-submission.md`](docs/openai-submission.md). The timed recording
plan, narration, captions, chapters, and visual assets are documented in the
[`OpenAI demo production kit`](docs/openai-demo-production-kit.md).

### Framework and agent examples

Runnable examples are organized under [`examples/integrations`](examples/integrations):

| Stack | Example | Needs a model key? |
|---|---|---|
| LangChain | [`MultiServerMCPClient`](examples/integrations/langchain) | No; calls a tool directly |
| LlamaIndex | [`BasicMCPClient`](examples/integrations/llamaindex) | No; calls a tool directly |
| Cloudflare Agents | [`Agent` + Workers AI](examples/integrations/cloudflare-agent) | No separate provider key |
| Hugging Face | [`huggingface_hub.Agent`](examples/integrations/huggingface) | Yes, `HF_TOKEN` for inference |

All use the same public `https://mcpqueen.com/mcp` Streamable HTTP endpoint.
The agent examples exclude `submit_feedback` from automatic model access.

Before a release or directory submission, run the reusable artifact validator:

```bash
npm run distribution:check
npm run distribution:check:live
```

It checks the prepared package and live MCP surfaces. Publisher identity,
domain challenge tokens, demo recording, and final portal confirmations remain
explicit manual gates.

The measurable channel plan is in
[`docs/distribution-strategy.md`](docs/distribution-strategy.md). Safe
unattended maintenance and stop conditions are defined in
[`docs/autonomous-operations.md`](docs/autonomous-operations.md) and
[`AGENTS.md`](AGENTS.md).

## Architecture (single Worker)

See the [system architecture and verification flow](docs/architecture.md) for
the ecosystem-level diagram and the Find → Verify → Connect decision loop.

- `src/worker.ts` — everything: registry crawler, prober/grader, HTML pages,
  JSON API, and mcpqueen's **own MCP endpoint**.
- `public/` — static landing (crown data-rain + Vex the fox) served via the
  assets binding; the Worker handles all non-asset routes.
- D1 database `mcpqueen` (`schema.sql`): servers, probes, latest_grades,
  trust_observations, evidence_benchmark_runs, feedback (quarantined agent field
  reports), meta (sync cursor).
- Cron `*/15 * * * *`: sync 4 registry pages + probe the 30 stalest remotes
  (~2,900 probes/day; full re-probe cycle ≈ 2.7 days over ~7.7K remotes).
- Cron `17 7 * * *`: run one safe, read-only response audit against an eligible
  evidence/citation tool and publish dated results to its Trust Receipt.

## Routes

| Route | What |
|---|---|
| `/` | landing (static) |
| `/registry` | leaderboard + methodology |
| `/s/<registry-name>` | per-server grade with evidence + probe history |
| `/api/grades.json` | grades as JSON (CORS open) |
| `/mcp` | MCP server: capability discovery plus `get_trust_receipt` and `search_trust_evidence` |
| `/integrations` | Setup matrix and runnable framework/agent examples |
| `/field-reports` | Human-reviewed reports from agents that actually exercised a server |
| `/api/trust/{name}.json` | Per-server operational, security, data-integrity, citation and claim evidence |
| `/mcp-info` | for-agents page |
| `/admin/*` | operator endpoints (key-gated) |


## Grading rubric (deterministic, every point carries its observation)

reachability 25 · protocol 15 · tooling 35 (tools/list, described %, typed %,
description depth) · latency 10 · provenance 15 (metadata + namespace↔domain
match). Auth-gated servers are scored on the verifiable subset and marked
**provisional**. Agent feedback via `submit_feedback` is quarantined for human
review — never auto-published, never affects grades directly.

Trust Receipts remain distinct from that grade. Safe response audits record
usable-call rate, semantic upstream failures, returned PMID/DOI identifiers, and
identifier resolution against authoritative sources. Missing evidence is labeled
unaudited rather than treated as a pass.

## Deploy

```
npm run deploy          # wrangler deploy (any Cloudflare API token with Workers + D1 write)
npm run db:schema       # apply schema.sql to remote D1
```

Custom domains mcpqueen.com + www are attached to the **Worker** (moved off the
Pages project 2026-07-12; mcpqueen.pages.dev still exists as a static preview of
`public/` only — it has no /registry).
