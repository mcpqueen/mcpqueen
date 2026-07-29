# Autonomous operations for MCP Queen

This runbook defines how unattended or long-running Codex sessions may advance
MCP Queen without turning broad autonomy into broad production authority.

## Design

Autonomy is split into four modes:

| Mode | Purpose | External changes |
|---|---|---|
| Audit | Inspect repositories, listings, issues, analytics, and endpoints | None |
| Prepare | Build code, docs, examples, assets, tests, and submission packages | Local repository only |
| Publish | Commit, push, or deploy a validated scoped change | Only under repository standing authorization |
| Monitor | Recheck approved submissions, outreach, deployments, and adoption | Read-only |

Every run starts in Audit. Moving to Prepare is allowed for the requested
product. Moving to Publish requires the standing authorization in `AGENTS.md`
and passing validation. Manual gates never become authorized merely because a
session is unattended.

## Safe autonomous scope

- Read-only audits of MCP Queen's public surfaces and approved outreach
- Technical repository changes within the requested distribution scope
- Submission copy, reviewer tests, demo assets, diagrams, schemas, examples,
  structured data, and documentation
- Non-destructive tests, builds, link checks, and MCP protocol smoke tests
- Scoped technical commits and pushes after required checks
- Existing documented deployments for in-scope public Worker changes
- Status and strategy updates based on directly verified evidence

## Stop conditions

The session must stop before:

- deletion, force-push, history rewrite, reset, clean, or resource removal;
- secrets, login, OAuth, billing, ownership, permission, or identity changes;
- legal attestations, final marketplace review submission, or final publish;
- database migrations or mutation of grades, evidence, moderation, or field
  reports;
- unsupported health, security, compliance, or certification claims;
- replacement of another submission's domain challenge token;
- a new unapproved outreach batch;
- any overlap with unrelated or pre-existing working-tree changes.

## Session protocol

1. Read applicable `AGENTS.md` files.
2. Run the global `operate-mcp-distribution` skill's preflight script.
3. Read `distribution/mcpqueen.json` and the current strategy.
4. Record repository, branch, HEAD, remotes, dirty files, and intended outputs.
5. Work only in explicitly scoped files.
6. Run tests, distribution validation, diff checks, and relevant live checks.
7. Review public language for evidence boundaries and private information.
8. Commit with the configured repository identity and a technical message.
9. Push or deploy only if authorized by `AGENTS.md`.
10. Verify the exact public result.
11. Report completed work, evidence, manual gates, and the next smallest action.

## Permission profile

The preferred unattended configuration is workspace-write with narrowly
approved network/deployment commands. A no-prompt approval policy does not
expand the sandbox: blocked actions fail and become manual gates.

Full filesystem access is unnecessary and increases risk. Scheduled runs
should use isolated Git worktrees when they may edit files, leaving the main
checkout untouched.

## Recommended recurring runs

### Daily read-only health check

- Verify the MCP endpoint initializes and lists expected tools.
- Check public policy, integration, sitemap, and evidence URLs.
- Inspect directory/submission state when available.
- Report only changes or failures.

### Twice-weekly adoption check

- Review badge issue replies, reactions, closures, and README adoption.
- Inspect qualified GitHub issues and integration questions.
- Record directory referrals, dataset interest, and developer feedback where
  available.
- Do not create new outreach.

### Weekly distribution review

- Run the live distribution validator.
- Update channel status and manual gates.
- Recommend one next experiment based on observed signals.
- Do not add a channel merely to make the checklist longer.

## Copy-ready scheduled-task prompt

Use `$operate-mcp-distribution` in the MCP Queen repository root. Run in Audit
and Monitor modes only. Read all applicable `AGENTS.md` files, run the preflight
and live distribution checks, verify the public MCP endpoint and canonical
URLs, inspect approved badge-outreach responses and adoption, and report only
changes, failures, or manual gates. Do not edit, commit, push, deploy, submit
forms, send outreach, moderate reports, change permissions, or mutate
production data.
