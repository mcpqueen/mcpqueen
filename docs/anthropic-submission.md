# Anthropic Connectors Directory preparation

Prepared and requirements re-verified: 2026-07-29 at 20:09 UTC

Status: **prepared, not submitted**. The package is blocked by missing
`Origin`-header validation on the live Streamable HTTP handler and by the
manual Claude, reviewer-credential, account, policy, and portal checks below.
No portal draft, submission, receipt, acceptance, account status, slug, or
directory listing is claimed.

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
- <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>

Anthropic's current public submission page says the remote-MCP form remains
open and is moving to a native Claude.ai surface. It does not publish the
previously recorded plan-tier and admin-role prerequisite,
so this package no longer asserts one. The current submission guidance
collects:

- an HTTPS endpoint, transport, URL pattern, and authentication mode;
- tool titles and annotations;
- name, tagline, description, category, documentation, privacy, support, logo,
  and favicon information;
- use cases, connection prerequisites, and read/write behavior;
- company and review contact details;
- API relationship, third-party data, personal-health-data, and sponsored
  content answers;
- test credentials with setup instructions and tested surfaces;
- policy and requirements checklists and the final review.

Anthropic requires every tool to be exercised in MCP Inspector and as a custom
connector in Claude. Tool names must be 64 characters or fewer, descriptions
must be narrow and accurate, results must be bounded, errors must be
actionable, and read/write tools must remain separate. Authenticated remote
servers must use supported OAuth; MCP Queen uses the supported `none` mode.
Any Claude plan can add a custom connector for testing.

The public submission and testing pages say reviewer test credentials are
required, while the authentication guide explicitly supports authless
connectors. MCP Queen has no account system and exposes a populated public
corpus, so there are no credentials to provide. The current portal or Anthropic
reviewer must confirm that the no-auth setup instructions satisfy that field;
credentials must not be invented.

Streamable HTTP servers must validate the `Origin` header. The current MCP
Queen handler does not, so the technical checklist cannot yet be truthfully
acknowledged. The current 2025-11-25 transport specification also clarifies
that a present invalid `Origin` must receive HTTP 403.

Anthropic's current public submission page requests a server logo by URL or SVG
upload and a favicon check. It does not publish the previously recorded
name/tagline/description length limits, category-count limit, or permanent-slug
rules. The package retains conservative internal copy limits, but the portal
must verify its current taxonomy and field constraints.

## Readiness summary

| Area | Current state |
|---|---|
| Public no-auth endpoint | Connected live client calls passed; terminal HTTP recheck was blocked before any response by the execution environment |
| Transport | Streamable HTTP, protocol `2025-06-18` |
| Tools | Seven; six read-only and one additive write |
| Tool titles, names, schemas, annotations | Local contract and connected metadata passed |
| Resources and prompts | None advertised by the current implementation |
| Read/write separation | Passed |
| Result bounds and source-reviewed error behavior | Passed |
| `Origin` validation | **Blocked: not implemented** |
| MCP Inspector and Claude custom-connector tests | Manual, not run in this preparation |
| Reviewer credentials for authless service | Current docs say required; no-auth applicability requires portal/reviewer confirmation |
| Submitting organization, contact, portal access, and authority | Not verified; no plan-tier or role assumption |
| Terms, policy, and portal acknowledgments | Human review required |
| Public URL, favicon, and portal icon recheck | Pending |
| Portal draft, submission, receipt, listing | Not started / none |

The 2026-07-29 20:09 UTC live connected-client audit returned structured
results from:

- `search_servers` with three GitHub issue-triage matches;
- `search_tools` with three FDA 510(k) matches;
- `list_grades` with three bounded results;
- `get_server_grade` for `com.healthai/radar`;
- `get_trust_receipt` for `com.healthai/radar`;
- `search_trust_evidence` with three citation-quality evidence items.

`submit_feedback` was not called because it writes to the production
quarantined review queue. Its schema, annotations, input checks, rate limit,
quarantine behavior, and non-effect on grades were reviewed in source.

The repository live validator was also run. Its terminal HTTP requests failed
before receiving any response because outbound network access was unavailable
in that execution environment. This is recorded as an environment limitation,
not as an endpoint failure; the independent connected-client calls above
passed.

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

Developer Tools. This is a prepared suggestion, not a verified portal category;
confirm the exact current taxonomy before saving.

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

The submitting organization, company name, primary review contact, portal
access, and submission authority must be confirmed in the current submission
surface.

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

No test account or credential exists because MCP Queen is an authless service
with no account system. The public corpus is populated. Anthropic's current
public guidance nevertheless says test credentials are required, so confirm
that these no-auth setup instructions satisfy the current submission field.
Do not invent credentials.

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

Anthropic's current public instructions request a server logo by URL or SVG
upload. The prepared primary asset is `public/favicon.svg`, with SHA-256
`69bd3c3491190930412e4fdb939a91f8c47f71e1179958dbed881148be380e21`,
also intended to be available at `https://mcpqueen.com/favicon.svg`. The
terminal environment could not recheck that public URL.

`submission-assets/mcpqueen-directory-icon.png` remains a reviewed 512×512 PNG
fallback, with SHA-256
`5c62cc08137c932e868b25366f8c9c95616e09801e2487793ebdbe622905449b`,
if the current portal accepts PNG. The composer icon is byte-identical and is
not a separate Anthropic asset. No asset is recorded as selected or accepted
by the portal.

Favicon inventory:

- `public/favicon.svg`
- `public/favicon.ico` (32×32)
- `public/apple-touch-icon.png` (180×180)

MCP Queen does not expose an MCP App or custom interactive UI. Anthropic's
three-to-five PNG carousel is specific to MCP Apps, so carousel screenshots
and video/GIF media are not applicable. The current portal must still accept
one of the prepared logo assets and verify the favicon.

## Data and compliance answer

Copy only after the account owner reviews the current portal wording:

> MCP Queen serves its own HTTPS MCP endpoint and queries its own database.
> The database indexes public MCP Registry metadata, public server and
> repository links, observed public tool metadata, and dated MCP Queen
> observations. User tool calls do not proxy actions into listed third-party
> servers. The connector does not handle personal health data, sponsored
> content, financial transactions, AI media generation, conversation history,
> Claude memory, or user files.

MCP Queen owns and operates its MCP endpoint and database, but the indexed
registry metadata, repository links, public tool metadata, and server endpoints
belong to third parties. The account owner must answer the current
API-ownership and third-party-data questions exactly as worded. Do not
represent ownership of third-party registry metadata, repositories, or server
endpoints.

## Exact blockers and smallest next actions

1. **Technical:** implement and test an `Origin` allowlist that accepts actual
   Anthropic client origins and non-browser MCP clients; promote the reviewed
   change to `main`; deploy only from the detached deployment worktree; verify
   the live endpoint.
2. **Client testing:** run every tool in MCP Inspector and a Claude custom
   connector, including one clearly labeled test report.
3. **Reviewer access:** confirm that no-auth setup instructions satisfy the
   documented test-credentials requirement; do not invent an account.
4. **Account:** verify the submitting organization, contact, portal access, and
   authority without assuming an undocumented plan tier or role.
5. **Policy:** review the current Directory Terms, Directory Policy, portal
   requirements checklist, API-ownership answer, and third-party-data answer.
6. **Portal:** recheck documentation, privacy, terms, support, favicon,
   accepted logo input, available categories, field constraints, and any slug
   requirement.
7. **Submission:** complete the final portal review manually and record a
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
- verify the prepared SVG and PNG logo checksums;
- review the staged diff for secrets, private text, local paths, and
  unsupported claims.
