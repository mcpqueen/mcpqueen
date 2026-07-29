# Autonomous operations for MCP Queen

This runbook defines how unattended or long-running Codex sessions may advance
MCP Queen without turning broad autonomy into broad production authority.

## Design

Autonomy is split into four modes:

| Mode | Purpose | External changes |
|---|---|---|
| Audit | Inspect repositories, listings, issues, analytics, and endpoints | None |
| Prepare | Build code, docs, examples, assets, tests, and submission packages | Local repository only |
| Publish | Commit, push, deploy, or submit a validated scoped change | Only under repository and product-manifest standing authorization |
| Monitor | Recheck approved submissions, outreach, deployments, and adoption | Read-only |

Every run starts in Audit. Moving to Prepare is allowed for the requested
product. Moving to Publish requires the standing authorization in `AGENTS.md`
and `distribution/mcpqueen.json`, plus passing validation. Unattended execution
does not broaden that declared authority.

## Safe autonomous scope

- Read-only audits of MCP Queen's public surfaces and approved outreach
- Technical repository changes within the requested distribution scope
- Submission copy, reviewer tests, demo assets, diagrams, schemas, examples,
  structured data, and documentation
- Non-destructive tests, builds, link checks, and MCP protocol smoke tests
- Scoped technical commits and pushes after required checks
- Existing documented deployments for in-scope public Worker changes
- Existing secure OAuth, CLI, keychain, environment-secret references, and
  named least-privilege cloud profiles
- Factual platform-review email replies within an existing approved submission
  or support thread
- Final marketplace submission when the manifest authorizes it, every answer
  is supported, validation passes, and no new contract or paid commitment is
  introduced
- Status and strategy updates based on directly verified evidence

## Stop conditions

The session must stop before:

- deletion, force-push, history rewrite, reset, clean, or resource removal;
- exposure of secret material, new long-lived credentials, weakened auth,
  ownership/identity changes, or broadened permissions;
- new/nonstandard legal contracts, unsupported attestations, or paid spend
  above the recorded cap;
- database migrations or mutation of grades, evidence, moderation, or field
  reports;
- unsupported health, security, compliance, or certification claims;
- replacement of another submission's domain challenge token;
- a new unapproved outreach batch;
- any overlap with unrelated or pre-existing working-tree changes.

## Session protocol

1. Read applicable `AGENTS.md` files.
2. Run the global `operate-mcp-distribution` skill's preflight script.
3. Run the central workspace preflight for the exact distribution or deployment
   lane.
4. Read `distribution/mcpqueen.json` and the current strategy.
5. Record repository, branch, HEAD, remotes, dirty files, and intended outputs.
6. Work only in explicitly scoped files.
7. Run tests, distribution validation, diff checks, and relevant live checks.
8. Review public language for evidence boundaries and private information.
9. Commit with the configured repository identity and a technical message.
10. Push, deploy, reply, or submit only within the recorded standing authority.
11. Verify the exact public result or submission receipt.
12. Report completed work, evidence, manual gates, and the next smallest action.

## Permission profile

The preferred unattended configuration is workspace-write with narrowly
approved network/deployment commands. A no-prompt approval policy does not
expand the sandbox: blocked actions fail and become manual gates.

Full filesystem access is unnecessary and increases risk. Scheduled runs
should use isolated Git worktrees when they may edit files, leaving the main
checkout untouched.

The distribution lane and deployment lane are separate. Marketplace,
integration, badge, demo, and SEO/GEO work happens in `ops/distribution`.
Production deploys happen only from the detached deployment worktree at the
exact released `main` commit.

Existing authentication may be consumed through secure references. Raw tokens,
passwords, cookies, and recovery codes never enter source files, logs, prompts,
or public artifacts. A dedicated cloud profile must not mutate the default
profile. CAPTCHA, 2FA, hardware-key, and device-confirmation challenges pause
the workflow at the smallest possible human step.

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

Use `$operate-mcp-distribution` in the MCP Queen distribution worktree. Read all
applicable `AGENTS.md` files, run both workspace and repository preflights, and
follow `distribution/mcpqueen.json`. Advance audit, preparation, approved
technical publishing, connected-mailbox submission replies, and explicitly
authorized marketplace submissions through verified completion. Do not deploy
from the distribution worktree, create a new outreach batch, moderate reports,
broaden permissions, accept a new contract, incur spend above the recorded cap,
or mutate production data. Pause only for a recorded manual gate or unavoidable
human challenge.
