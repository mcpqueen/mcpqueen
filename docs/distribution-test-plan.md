# MCP Queen distribution test

The durable strategy is in
[`docs/distribution-strategy.md`](distribution-strategy.md). Autonomous-session
boundaries are in
[`docs/autonomous-operations.md`](autonomous-operations.md). This document
remains the concise pilot test plan.

MCP Queen is the pilot for a reusable distribution system that can later be
applied to Constat/Risk Radar and Clarity. The objective is not to accumulate
profiles. It is to learn which channels produce real developer connections,
tool calls, badge adoption, citations, and qualified interest.

## Positioning

**Don't connect your AI agent to a stranger. Verify it first.**

MCP Queen helps an agent or developer find an MCP server, inspect dated live
evidence, and decide whether to connect. It is an evidence and discovery layer,
not an absolute security certification.

## Recommended sequence

1. Finish one canonical product package: endpoint, schemas, icons, examples,
   architecture, privacy/support/terms, and reviewer tests.
2. Publish or submit the integrations that provide actual distribution.
3. Add framework examples that developers can run in minutes.
4. Update the canonical website, documentation, SEO, and answer-engine copy
   with links to integrations that are already live.
5. Publish one launch/case-study post.
6. Measure for 14 days before duplicating the entire program.

Updating the website after integrations are live avoids claims and links that
cannot yet be verified.

## Channel matrix

| Channel | Current state | Pilot deliverable | Priority |
|---|---|---|---|
| Official MCP Registry | Done | Keep metadata, endpoint, repository, and version current | Maintain |
| GitHub | Core repository plus OpenAI, native-client, and framework examples exist | Keep examples current and measure developer use | High |
| Glama | Claimed, built, and released | Monitor listing health; do not treat the score as the canonical truth | Maintain |
| OpenAI | Private connection works; submission package and PNG icons ready | Upload submission JSON and icons, complete review, then add the public listing link | Highest |
| Anthropic | Remote endpoint is compatible | Prepare and submit to the Claude Connectors Directory | High |
| LangChain | Runnable direct-tool example corrected to the current published adapter | Promote, then measure repository discovery and integration use | High |
| LlamaIndex | Runnable `BasicMCPClient` example added | Measure repository discovery and integration use | High |
| Cloudflare | Production Worker plus deployable Agent example exist | Consider a public demo only after the pilot shows demand | Medium |
| Hugging Face | Inference Providers example plus dataset card/metadata are prepared; no Hub dataset URL is verified | Create a Hub dataset only after account-owner and license review | Medium |
| RapidAPI | Not started; official provider docs describe REST/OpenAPI rather than MCP transport | Only publish the companion JSON API if distinct REST demand proves useful | Hold |
| Website SEO/GEO | Canonical integrations page and structured data added | Add individual setup pages only where search demand justifies them | After listings |
| Publication | Architecture and evidence report exist | Publish one evidence-led launch/case-study post after links are live | After listings |

## Important channel distinctions

- Anthropic has a real submission path for remote MCP connectors through its
  Connectors Directory.
- LangChain and LlamaIndex are integration examples, not directories. Their
  value comes from runnable code, repository search visibility, and developer
  adoption.
- Cloudflare documents a managed catalog of Cloudflare's own MCP servers. For a
  third-party server, the useful deliverable is a Cloudflare Agent example,
  deployment story, or template—not an assumed public-catalog submission.
- Hugging Face provides a genuine remote-MCP path through Inference Providers.
  The dated CSV is public on MCP Queen, but the Hugging Face dataset remains
  prepared—not live—until a canonical Hub URL is verified.
- RapidAPI is an API marketplace rather than an MCP directory. It should remain
  optional until the companion REST API has a clear audience.

## Pilot success measures

Record a baseline before publication, then check at 7 and 14 days:

- successful MCP connections and non-bot tool calls;
- referral traffic to evidence pages;
- GitHub example views, clones, stars, issues, and integration questions;
- badge invitations accepted or embedded;
- OpenAI/Anthropic listing approval and listing-driven traffic;
- search impressions for task-oriented developer queries;
- dataset downloads and citations;
- qualified inbound requests from platform, security, or developer teams.

## Expansion gate

Apply the full system to Clarity and Constat/Risk Radar only after the MCP Queen
pilot produces at least one meaningful adoption signal: a public-directory
approval, repeated developer tool usage, badge adoption, qualified inbound
interest, or measurable search/referral growth.

The reusable pieces—submission checklist, example templates, integration-page
layout, structured data, tracking conventions, and launch checklist—should then
be copied. Product positioning and use cases should not be copied verbatim.

## Reusable validation

`distribution/mcpqueen.json` is the pilot manifest and
`scripts/validate-distribution.mjs` is the non-interactive validator. It checks:

- required listing, policy, icon, architecture, and example artifacts;
- OpenAI submission structure and reviewer-test counts;
- PNG dimensions;
- public URLs;
- MCP initialization, expected tool names, output schemas, and safety annotations.

`scripts/validate-examples.mjs` separately checks client syntax, dependency
versions, the canonical endpoint, read-only allowlists, dataset metadata,
snapshot row counts, and repository cross-links without installing packages or
calling a model provider.

The script deliberately reports identity, demo, domain-token, directory-form,
and final-confirmation steps as manual gates. It never signs in, clicks through
a review, or submits on the publisher's behalf. A Clarity or Constat rollout
can reuse the script with a new manifest once this pilot clears the expansion
gate.

## Official implementation references

- [Anthropic Connectors Directory submission](https://claude.com/docs/connectors/building/submission)
- [LangChain MCP adapters](https://docs.langchain.com/oss/python/langchain/mcp)
- [LlamaIndex MCP tooling releases](https://github.com/run-llama/llama_index/releases)
- [Cloudflare Agents as an MCP client](https://developers.cloudflare.com/agents/tools/mcp/)
- [Hugging Face remote MCP execution](https://huggingface.co/docs/inference-providers/guides/responses-api#remote-mcp-execution)
- [Hugging Face dataset cards](https://huggingface.co/docs/hub/en/datasets-cards)
- [RapidAPI endpoint definitions](https://docs.rapidapi.com/docs/hub-listing-definitions-tab)
