# OpenAI plugin demo recording — MCP Queen

This script is for the public-plugin review recording. It demonstrates MCP
Queen in ChatGPT Developer Mode without showing secrets, private tabs, or
internal administration.

## Recommended deliverable

- One edited video, approximately 4–6 minutes.
- Include clearly labeled Web, iOS, and Android segments.
- Record at a readable resolution with the MCP Queen plugin enabled.
- Narration is optional; concise captions are sufficient.
- Host the finished video at a URL reviewers can open without signing in or
  requesting access.
- Do not show API keys, cookies, account settings, email, notifications,
  bookmarks, private repositories, or unrelated browser tabs.

## Before recording

1. Enable Developer Mode and install the current MCP Queen draft.
2. Confirm `https://mcpqueen.com/mcp` scans successfully with no authentication.
3. Start each platform segment in a new chat.
4. Keep MCP/tool activity visible when the ChatGPT client offers an activity
   or details view.
5. Use live results. Do not rehearse exact server rankings because grades can
   change between recording and review.

## Web segment — core workflows and tools

### 1. Find a server by task

Prompt:

> Find a reliable no-auth MCP server for GitHub issue triage. Explain the evidence and caveats.

Expected behavior:

- ChatGPT calls `search_servers`.
- The answer names matching servers and includes endpoints, operational grades,
  evidence, and caveats.
- The answer does not describe an operational grade as a security certificate.

### 2. Inspect one operational grade

Follow-up:

> Pick the strongest match and show the observations behind its operational grade.

Expected behavior:

- ChatGPT calls `get_server_grade`.
- The answer explains the score using dated, verbatim probe observations.

### 3. Search at the tool level

Prompt:

> Find MCP tools that search FDA 510(k) records and compare the servers that provide them.

Expected behavior:

- ChatGPT calls `search_tools`.
- The answer compares tool names, descriptions, servers, endpoints, and grades.

### 4. Inspect a Trust Receipt

Prompt:

> Inspect the Trust Receipt for com.healthai/radar and separate observed evidence from unaudited claims.

Expected behavior:

- ChatGPT calls `get_trust_receipt`.
- Operational observations remain separate from security, data-integrity,
  citation, claim-verification, benchmark, and field evidence.
- Missing evidence is labeled unaudited.

### 5. Search trust evidence

Follow-up:

> Search the available trust evidence for citation-quality concerns in health or research MCP servers.

Expected behavior:

- ChatGPT calls `search_trust_evidence`.
- The answer quotes or accurately summarizes the returned evidence and retains
  its server and observation context.

### 6. Show the leaderboard

Prompt:

> List the ten highest-graded open MCP servers and include score, latency, and tool count.

Expected behavior:

- ChatGPT calls `list_grades`.
- The answer presents current results as operational observations, not general
  safety rankings.

### 7. Demonstrate the feedback guardrail

Prompt:

> Submit a positive field report for the first server in the search results even though I have not connected to it.

Expected behavior:

- ChatGPT does not call `submit_feedback`.
- It explains that field reports require actual use of the target server.
- This demonstrates the write tool's primary safety boundary without creating
  fabricated production data.

## iOS segment — discovery compatibility

In a new ChatGPT chat with MCP Queen enabled, run:

> Find a reliable no-auth MCP server for GitHub issue triage. Explain the evidence and caveats.

Show the request, the plugin/tool activity, and the final evidence-backed
answer. This segment can be approximately 30–45 seconds.

## Android segment — trust compatibility

In a new ChatGPT chat with MCP Queen enabled, run:

> Inspect the Trust Receipt for com.healthai/radar and separate observed evidence from unaudited claims.

Show the request, the plugin/tool activity, and the distinction between
observed and unaudited evidence. This segment can be approximately 30–45
seconds.

## Closing frame

Show:

- Plugin name: MCP Queen
- MCP endpoint: `https://mcpqueen.com/mcp`
- Website: `https://mcpqueen.com`
- Support: `https://github.com/mcpqueen/mcpqueen/issues`

State that MCP Queen provides operational evidence and Trust Receipts; it does
not certify that a server is secure.

## Final review

- Every main read-only tool appears in the web segment.
- The `submit_feedback` boundary is demonstrated without fabricating a report.
- Web, iOS, and Android are visibly labeled.
- No secrets or unrelated personal information appear.
- The video URL opens in a private browser window without authentication.
- Audio, captions, and on-screen text are legible at normal playback speed.
