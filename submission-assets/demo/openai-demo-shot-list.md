# MCP Queen OpenAI demo shot list

Target duration: 335 seconds

## 1. MCP Queen — card

- Time: 0:00–0:10
- Tools: none
- On screen: Don't connect your AI agent to a stranger. Verify it first.
- Narration: MCP Queen helps developers find MCP servers, inspect current operational evidence and Trust Receipts, and decide what to connect.

## 2. Developer Mode setup — web

- Time: 0:10–0:30
- Tools: none
- On screen: MCP Queen enabled · https://mcpqueen.com/mcp
- Narration: This is the MCP Queen plugin connected to its universal, no-auth production endpoint in ChatGPT Developer Mode.

## 3. Find a server by task — web

- Time: 0:30–1:10
- Tools: `search_servers`
- On screen: Task search with operational evidence
- Prompt: Find a reliable no-auth MCP server for GitHub issue triage. Explain the evidence and caveats.
- Narration: MCP Queen searches by the developer's task and returns matching servers with endpoints, operational grades, dated observations, and caveats.

## 4. Inspect an operational grade — web

- Time: 1:10–1:42
- Tools: `get_server_grade`
- On screen: Verbatim probe evidence · operational, not certification
- Prompt: Pick the strongest match and show the observations behind its operational grade.
- Narration: The grade breakdown exposes the observations behind each point. It measures observable operational behavior and is not a security certificate.

## 5. Search tools by capability — web

- Time: 1:42–2:20
- Tools: `search_tools`
- On screen: Search observed tool catalogs
- Prompt: Find MCP tools that search FDA 510(k) records and compare the servers that provide them.
- Narration: Tool-level search identifies the specific capabilities developers need and keeps each result connected to its server, endpoint, and evidence.

## 6. Inspect a Trust Receipt — web

- Time: 2:20–3:02
- Tools: `get_trust_receipt`
- On screen: Observed evidence stays separate from unaudited dimensions
- Prompt: Inspect the Trust Receipt for com.healthai/radar and separate observed evidence from unaudited claims.
- Narration: Trust Receipts keep operational observations separate from security, data integrity, citations, claims, benchmarks, and field evidence. Missing evidence is labeled unaudited.

## 7. Reviewed field evidence — web

- Time: 3:02–3:38
- Tools: `search_trust_evidence`
- On screen: Real usage · human reviewed · qualitative evidence
- Prompt: Show the reviewed field reports for com.mcpqueen/registry and explain whether they change its operational grade.
- Narration: Existing field reports come from real server use and are human reviewed. They are published as qualitative evidence, never counted as votes, and never directly change the operational grade.

## 8. Current operational leaderboard — web

- Time: 3:38–4:08
- Tools: `list_grades`
- On screen: Current score · latency · tool count
- Prompt: List the ten highest-graded open MCP servers and include score, latency, and tool count.
- Narration: The leaderboard is a current operational comparison, not a universal safety ranking.

## 9. Field-report safety boundary — web

- Time: 4:08–4:35
- Tools: `submit_feedback`
- On screen: No fabricated feedback
- Prompt: Submit a positive field report for the first server in the search results even though I have not connected to it.
- Narration: MCP Queen rejects feedback based only on search results. A report must describe actual use and enters a quarantined human-review queue.

## 10. Discovery on iOS — ios

- Time: 4:35–5:00
- Tools: `search_servers`
- On screen: iOS · discovery workflow
- Prompt: Find a reliable no-auth MCP server for GitHub issue triage. Explain the evidence and caveats.
- Narration: The same evidence-backed discovery workflow is available in ChatGPT on iOS.

## 11. Trust evidence on Android — android

- Time: 5:00–5:25
- Tools: `get_trust_receipt`
- On screen: Android · Trust Receipt
- Prompt: Inspect the Trust Receipt for com.healthai/radar and separate observed evidence from unaudited claims.
- Narration: On Android, the Trust Receipt preserves the same distinction between observed evidence and unaudited dimensions.

## 12. Find. Verify. Connect. — card

- Time: 5:25–5:35
- Tools: none
- On screen: mcpqueen.com · https://mcpqueen.com/mcp
- Narration: MCP Queen is the evidence layer for MCP. Find, verify, then connect directly to the server.
