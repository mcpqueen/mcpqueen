# Anthropic Connectors Directory preparation

Prepared and requirements re-verified: 2026-07-29

Status: **prepared, not submitted**. The package is blocked by missing
`Origin`-header validation on the live Streamable HTTP handler and by the
manual Claude, account, policy, and portal checks below. No portal draft,
submission, receipt, acceptance, account status, slug, or directory listing is
claimed.

The copy-ready machine-readable package is
[`anthropic-directory-submission.json`](../anthropic-directory-submission.json).
The canonical channel status and manual-gate inventory remain in
[`distribution/mcpqueen.json`](../distribution/mcpqueen.json).

## Current official requirements

- <https://claude.com/docs/connectors/building/submission>
- <https://claude.com/docs/connectors/building/review-criteria>
- <https://claude.com/docs/connectors/building/testing>
- <https://claude.com/docs/connectors/building>
- <https://claude.com/docs/connectors/building/authentication>
- <https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms>
- <https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy>
- <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>

The current remote-MCP submission path is the Claude.ai admin portal, not the
old general form. It requires a Team or Enterprise organization and an Owner,
Primary owner, or delegated role with Directory management or Libraries
permission. The portal syncs tools, prompts, and resources from the endpoint
and collects:

- an HTTPS endpoint, transport, URL pattern, and authentication mode;
- tool titles and annotations;
- name (100 characters maximum), tagline (55 maximum), description (2,000
  maximum), one to five categories, documentation, privacy, support, icon, and
  a permanent slug;
- use cases, connection prerequisites, and read/write behavior;
- company and review contact details;
- API relationship, third-party data, personal-health-data, and sponsored
  content answers;
- test-account or no-auth reviewer instructions and tested surfaces;
- seven policy acknowledgments and the final review.

Anthropic requires every tool to be exercised in MCP Inspector and as a custom
connector in Claude. Tool names must be 64 characters or fewer, descriptions
must be narrow and accurate, results must be bounded, errors must be
actionable, and read/write tools must remain separate. Authenticated remote
servers must use supported OAuth; MCP Queen uses the supported `none` mode.

Streamable HTTP servers must validate the `Origin` header. The current MCP
Queen handler does not, so the technical checklist cannot yet be truthfully
acknowledged.

## Readiness summary

| Area | Current state |
|---|---|
| Public no-auth endpoint | Connected live client calls passed |
| Transport | Streamable HTTP, protocol `2025-06-18` |
| Tools | Seven; six read-only and one additive write |
| Tool titles, names, schemas, annotations | Local contract and connected metadata passed |
| Resources and prompts | None advertised by the current implementation |
| Read/write separation | Passed |
| Result bounds and source-reviewed error behavior | Passed |
| `Origin` validation | **Blocked: not implemented** |
| MCP Inspector and Claude custom-connector tests | Manual, not run in this preparation |
| Team/Enterprise directory role | Not verified |
| Terms, policy, and portal acknowledgments | Human review required |
| Public URL, favicon, and portal icon recheck | Pending |
| Portal draft, submission, receipt, listing | Not started / none |

The 2026-07-29 live connected-client audit returned structured results from:

- `search_servers` with three GitHub issue-triage matches;
- `search_tools` with three FDA 510(k) matches;
- `list_grades` with three bounded results;
- `get_server_grade` for `com.healthai/radar`;
- `get_trust_receipt` for `com.healthai/radar`;
- `search_trust_evidence` with three citation-quality evidence items.

`submit_feedback` was not called because it writes to the production
quarantined review queue. Its schema, annotations, input checks, rate limit,
quarantine behavior, and non-effect on grades were reviewed in source.

## Copy-ready listing

**Name**

MCP Queen

**Tagline**

Search MCP servers with current evidence

**Description**

MCP Queen is an evidence and discovery layer for the MCP ecosystem. Search
servers and observed tool catalogs, inspect deterministic operational grades,
and review dated Trust Receipt observations across security, data integrity,
citation quality, claim verification, response behavior, and reviewed field
reports. Operational grades measure observed availability, protocol behavior,
tool discovery, latency, and provenance; they are not security, privacy,
compliance, or data-quality certifications. Trust Receipt dimensions remain
separate, and missing evidence is reported as unaudited rather than safe.

**Suggested category**

Developer Tools. Confirm the exact available portal taxonomy before saving.

**Remote MCP server URL**

https://mcpqueen.com/mcp

**Transport and URL pattern**

Streamable HTTP. Every user connects to the same URL.

**Authentication and prerequisites**

No authentication. No MCP Queen account, plan, credential, or other setup is
required.

**Read/write scope**

The connector reads public MCP discovery and evidence data. Only
`submit_feedback` writes: it adds a factual field report to a quarantined
human-review queue. It does not publish the report or change an operational
grade.

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

**Company website**

https://mcpqueen.com

The company name and primary review contact must be confirmed by the submitting
account owner. The portal pre-fills the contact from that account.

## Use cases and prompts

1. **Find an MCP server or tool.** Search public MCP server metadata and
   observed tool catalogs for a task, then filter by operational grade,
   protocol access state, latency, or category.
   Prompt: `Find MCP tools for GitHub issue triage. Prefer open protocol access
   and show current operational evidence.`
2. **Inspect a Trust Receipt.** Review a server's operational grade separately
   from dated security, data-integrity, citation, claim-verification,
   response-benchmark, and reviewed field evidence.
   Prompt: `Show the Trust Receipt for com.healthai/radar. Separate observed
   evidence from unaudited dimensions.`
3. **Search dated evidence.** Search by topic or dimension and retain
   observation dates and source types instead of collapsing results into a
   composite trust score.
   Prompt: `Search MCP Queen for citation-quality concerns and include the
   observation dates.`

## Tool inventory and safety boundaries

| Tool | Human-readable title | Behavior |
|---|---|---|
| `search_servers` | Search MCP Servers | Read-only, bounded discovery query |
| `search_tools` | Search MCP Tools | Read-only, bounded observed-catalog query |
| `list_grades` | List Operational Grades | Read-only, bounded operational overview |
| `get_server_grade` | Get Server Grade | Read-only, one server |
| `get_trust_receipt` | Get Trust Receipt | Read-only, one server |
| `search_trust_evidence` | Search Trust Evidence | Read-only, bounded dated evidence search |
| `submit_feedback` | Submit Field Report | Additive write, quarantined for human review |

Every tool has a human-readable `title`, an `outputSchema`, and explicit
`readOnlyHint`, `destructiveHint`, and `openWorldHint` values. The six
discovery/evidence tools use `readOnlyHint: true`. `submit_feedback` uses
`readOnlyHint: false` and `destructiveHint: false`, consistent with the MCP
annotation definition for an additive, non-destructive write.

Tool calls query MCP Queen's first-party database. The database contains public
MCP Registry metadata, public server and repository links, public tool metadata
observed from listed servers, and dated MCP Queen observations. User tool calls
do not proxy actions into listed third-party servers.

The connector does not transfer money or financial assets, generate AI image,
video, or audio content, serve sponsored content, query Claude memory or chat
history, or request user files. It does not require personal health data.
Standard request metadata, searches, and field reports are handled as described
in the public privacy policy.

Operational grades and Trust Receipt dimensions remain separate. An
operational grade is not a security, privacy, compliance, or data-quality
certification. Missing evidence is unaudited, not safe.

## Reviewer instructions

No test account or credential exists or is needed. The public corpus is
populated.

1. Connect to `https://mcpqueen.com/mcp` with Streamable HTTP and no
   authentication.
2. Confirm initialization identifies `mcpqueen` and advertises tools only.
3. Call `search_servers` with:
   `{"query":"GitHub issue triage","auth":"open","limit":3}`.
4. Call `search_tools` with:
   `{"query":"FDA 510(k)","limit":3}`.
5. Call `list_grades` with `{"limit":3}`.
6. Call `get_server_grade` with `{"name":"com.healthai/radar"}` and confirm the
   returned evidence explains an operational grade rather than a security
   certification.
7. Call `get_trust_receipt` with `{"name":"com.healthai/radar"}` and confirm
   operational, Trust Receipt, benchmark, and reviewed-field-report sections
   remain distinct.
8. Call `search_trust_evidence` with
   `{"query":"citation","dimension":"citation_quality","limit":3}` and confirm
   results retain dates and source types.
9. Call `submit_feedback` once with
   `{"server_name":"com.healthai/radar","report":"Anthropic directory reviewer
   test: the Trust Receipt returned distinct operational and dated evidence
   sections.","agent_name":"Anthropic directory review"}`.
10. Confirm the response says `quarantined`, does not claim publication, and
    does not change a grade.
11. Repeat all seven calls in both MCP Inspector and a Claude custom connector.

## Branding and media

Use `submission-assets/mcpqueen-directory-icon.png`: a reviewed 512×512 PNG
with SHA-256
`5c62cc08137c932e868b25366f8c9c95616e09801e2487793ebdbe622905449b`.
The composer icon is byte-identical and is not a separate Anthropic asset.

Favicon inventory:

- `public/favicon.svg`
- `public/favicon.ico` (32×32)
- `public/apple-touch-icon.png` (180×180)

MCP Queen does not expose an MCP App or custom interactive UI. Anthropic's
three-to-five PNG carousel is specific to MCP Apps, so carousel screenshots
and video/GIF media are not applicable. The current portal must still accept
the selected icon and verify the favicon.

## Data and compliance answer

Copy only after the account owner reviews the current portal wording:

> MCP Queen serves its own HTTPS MCP endpoint and queries its own database.
> The database indexes public MCP Registry metadata, public server and
> repository links, observed public tool metadata, and dated MCP Queen
> observations. User tool calls do not proxy actions into listed third-party
> servers. The connector does not handle personal health data, sponsored
> content, financial transactions, AI media generation, conversation history,
> Claude memory, or user files.

The account owner must decide whether Anthropic's first-party API
acknowledgment applies to this public-directory model. Do not check it if the
portal wording would imply ownership of third-party registry metadata,
repositories, or server endpoints.

## Exact blockers and smallest next actions

1. **Technical:** implement and test an `Origin` allowlist that accepts actual
   Anthropic client origins and non-browser MCP clients; promote the reviewed
   change to `main`; deploy only from the detached deployment worktree; verify
   the live endpoint.
2. **Client testing:** run every tool in MCP Inspector and a Claude custom
   connector, including one clearly labeled test report.
3. **Account:** verify Team or Enterprise organization access and an eligible
   directory-management role.
4. **Policy:** review the current Directory Terms, Directory Policy, seven
   portal acknowledgments, and first-party API statement.
5. **Portal:** recheck documentation, privacy, terms, support, favicon, icon,
   available categories, and the permanent slug.
6. **Submission:** complete the final portal review manually and record a
   receipt only if Anthropic returns one.

CAPTCHA, 2FA, hardware-key, and device-confirmation challenges remain human
steps. Preparation is not submission, and a saved draft is not acceptance.

## Repository verification

Before handing the package to the account owner:

- run both declared distribution preflights;
- run `npm test`;
- run `npm run distribution:check`;
- run `npm run distribution:check:live` from a network path that can reach all
  public URLs;
- verify the selected icon checksum;
- review the staged diff for secrets, private text, local paths, and
  unsupported claims.
