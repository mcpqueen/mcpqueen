# MCP Queen distribution test

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
| GitHub | Core repository and OpenAI example exist | Add a copy/paste quickstart matrix and runnable framework examples | High |
| Glama | Claimed, built, and released | Monitor listing health; do not treat the score as the canonical truth | Maintain |
| OpenAI | Private connection works; submission package and PNG icons ready | Upload submission JSON and icons, complete review, then add the public listing link | Highest |
| Anthropic | Remote endpoint is compatible | Prepare and submit to the Claude Connectors Directory | High |
| LangChain | No dedicated example yet | Add a minimal `langchain-mcp-adapters` remote-HTTP example | High |
| LlamaIndex | No dedicated example yet | Add a minimal `llama-index-tools-mcp` remote-client example | High |
| Cloudflare | Production Worker deployment is live | Add a Cloudflare Agent client example and deployable demo | Medium |
| Hugging Face | Dataset plus Parquet conversion are live | Add an MCPClient/tiny-agent example; optionally create a discovery demo Space | Medium |
| RapidAPI | Not started | Only publish the companion JSON API if REST discovery or monetization proves useful | Hold |
| Website SEO/GEO | Partial | Create one canonical integrations page, individual setup pages, schema markup, and tested prompts | After listings |
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
- Hugging Face already provides value through the dataset. A Space or MCPClient
  example is an additional developer surface, not a replacement for the
  canonical live endpoint.
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

## Official implementation references

- [Anthropic Connectors Directory submission](https://claude.com/docs/connectors/building/submission)
- [LangChain MCP adapters](https://docs.langchain.com/oss/python/langchain/mcp)
- [LlamaIndex MCP tooling releases](https://github.com/run-llama/llama_index/releases)
- [Cloudflare Agents as an MCP client](https://developers.cloudflare.com/agents/tools/mcp/)
- [Hugging Face MCP client](https://huggingface.co/docs/huggingface_hub/main/en/package_reference/mcp)
- [Hugging Face Spaces as MCP servers](https://huggingface.co/docs/hub/en/spaces-mcp-servers)
- [RapidAPI provider overview](https://get.rapidapi.com/api-provider/)

