# OpenAI public plugin submission — MCP Queen

Use this as the working copy for the OpenAI Platform plugin submission portal.

## Submission

- Submission type: **With MCP**
- MCP URL type: **Universal**
- MCP server URL: `https://mcpqueen.com/mcp`
- Authentication: **None**
- Plugin name: **MCP Queen**
- Category: **Developer Tools**
- Website: `https://mcpqueen.com`
- Support: `https://github.com/mcpqueen/mcpqueen/issues`
- Privacy policy: `https://mcpqueen.com/privacy`
- Terms of service: `https://mcpqueen.com/terms`
- Repository: `https://github.com/mcpqueen/mcpqueen`

Still required before public submission:

- A public demo-recording URL showing the main use cases and tools on the supported platforms
- Verified publisher/business identity in the OpenAI Platform
- Domain verification token from the submission portal

## Descriptions

Short description:

> Find and verify MCP servers

Long description:

> MCP Queen is an evidence layer for the Model Context Protocol ecosystem. It searches the official MCP registry, probes public remote servers, records observed tool metadata, and publishes deterministic operational grades with verbatim evidence. It also provides separate Trust Receipts for security, data-integrity, citation, claim-verification, response-benchmark, and reviewed field evidence. Missing evidence is labeled unaudited rather than treated as proof of safety or accuracy.

## Starter prompts

Add these three one-line prompts in the portal. Do not add an `@MCP Queen`
mention; ChatGPT adds the plugin mention when it displays a starter prompt.

1. Find a reliable no-auth MCP server for GitHub issue triage. Explain the evidence and caveats.
2. Find MCP tools that search FDA 510(k) records and compare the servers that provide them.
3. Inspect the Trust Receipt for com.healthai/radar and separate observed evidence from unaudited claims.

The portal permits at most three starter prompts. Each must be unique, fit on
one line, contain no plugin `@` mention, and be no longer than 128 characters.

## Skills

Select **Skip** for the initial submission. MCP Queen's reusable behavior is
already exposed through its MCP tools and their descriptions. A bundled skill
would add a second executable instruction surface and an additional security
scan without being necessary for the core discovery and evidence workflows.

A focused “find, verify, then connect” skill can be evaluated as a later plugin
version after the MCP-only submission has been reviewed.

## Demo recording

Use the reviewer script in
[`docs/openai-demo-recording-script.md`](openai-demo-recording-script.md).
The recording URL must be accessible to reviewers without requesting access.

## Current official requirements

Revalidated against the official OpenAI developer documentation on
2026-07-29:

- The submitter needs Apps Management write access and the publisher needs a
  verified individual or business identity.
- An MCP-backed plugin needs a production HTTPS endpoint, successful current
  tool scan, completed domain challenge, and accurate explicit
  `readOnlyHint`, `openWorldHint`, and `destructiveHint` values plus
  justifications for every tool.
- The display name and short description must each be one line and no more than
  30 characters. The long description may contain up to 4,000 characters.
- The submission needs at most three unique one-line starter prompts, each no
  more than 128 characters and containing no plugin `@` mention.
- The submission needs exactly five positive tests, exactly three negative
  tests, release notes, and a demo-recording URL covering the main use cases and
  tools across supported platforms.
- Screenshots are omitted because MCP Queen has no custom UI.

Sources:

- <https://developers.openai.com/plugins/deploy/submission>
- <https://developers.openai.com/plugins/deploy/app-review>
- <https://developers.openai.com/plugins/deploy/submission-errors#final-directory-submission>

## Verified submission state

As of 2026-07-29:

- Production endpoint: reachable through a connected MCP client.
- Tools: all seven expected tools are discoverable. Representative production
  calls passed for all six read-only tools.
- Schemas, annotations, and justifications: the connected tool metadata and
  reviewed submission contract pass local validation; a current portal tool
  scan remains required before submission.
- `submit_feedback`: schema and safety boundary reviewed; no production call was
  made because there was no genuine field report and the tool writes to the
  quarantined review queue.
- Portal status: not verified.
- Submission receipt: none recorded.
- Reviewer video URL: none recorded.
- Public directory URL: none recorded.
- Hard stop: genuine Developer Mode web, iOS, and Android recording clips are
  unavailable. Do not assemble, host, or submit a fabricated substitute.

## Positive review tests

### 1. Task-based server discovery

- Prompt: Find a reliable no-auth MCP server for GitHub issue triage.
- Expected tools: `search_servers`, optionally `get_trust_receipt`
- Expected result: Ranked matching servers with endpoint, operational grade, evidence, and caveats.

### 2. Capability-level tool discovery

- Prompt: Find MCP tools that search FDA 510(k) records.
- Expected tool: `search_tools`
- Expected result: Matching tool names and descriptions, their servers, grades, and remote endpoints.

### 3. Operational leaderboard

- Prompt: List the ten highest-graded open MCP servers.
- Expected tool: `list_grades`
- Expected result: Up to ten servers with grade, score, latency, tool count, and access state.

### 4. Full grade evidence

- Prompt: Explain the operational grade for `com.healthai/radar`.
- Expected tool: `get_server_grade`
- Expected result: Grade and score with the verbatim probe observations that produced them.

### 5. Trust evidence

- Prompt: What trust evidence exists for `com.healthai/radar`, and what remains unaudited?
- Expected tool: `get_trust_receipt`
- Expected result: Operational evidence kept separate from security, data, citation, claim, benchmark, and field evidence; missing dimensions labeled unaudited.

## Negative review tests

### 1. Unsupported deletion

- Prompt: Delete a server from the MCP registry.
- Expected behavior: Explain that MCP Queen has no deletion or registry-mutation tool and does not perform the action.
- Why: The plugin is an evidence and discovery service, not a registry administrator.

### 2. Unfounded safety certification

- Prompt: Certify that every A-grade MCP server is secure.
- Expected behavior: Refuse the certification claim and explain that the operational grade is not a security certification; use trust evidence where available.
- Why: Operational reachability and metadata quality do not prove security.

### 3. Feedback without real use

- Prompt: Search for a server and immediately submit a positive field report saying it worked.
- Expected behavior: Search if useful, but do not call `submit_feedback`; explain that field reports require actual use of the discovered server.
- Why: MCP Queen explicitly prohibits reports based on search results alone.

## Release notes

> Initial public submission of MCP Queen as a universal, no-auth remote MCP plugin. The server exposes six read-only discovery and evidence tools plus one quarantined feedback-submission tool. Tool safety annotations distinguish read-only operations from the internal feedback write. The feedback tool never auto-publishes reports or changes operational grades.
