# MCP Queen repository instructions

## Product integrity

- MCP Queen is an evidence and discovery layer for MCP servers.
- Never describe an operational grade as a security, privacy, data-quality, or
  compliance certification.
- Keep operational grades, Trust Receipt dimensions, response benchmarks, and
  reviewed field reports separate.
- Treat missing evidence as unaudited, not safe.
- Never fabricate field reports, adoption, reviews, integrations, approvals, or
  security findings.

## Working tree

- Preserve pre-existing and unrelated tracked or untracked changes.
- Do not reset, clean, stash, delete, or overwrite work to simplify a task.
- The `dist-work/` directory may contain operator-owned outreach work. Do not
  commit, modify, or remove it unless the task explicitly includes it.
- Distribution work must use the declared `ops/distribution` worktree.
- Production deployment must use the declared detached deployment worktree and
  pass the workspace deployment preflight for the `worker` target.

## Routine autonomous work

For explicitly requested MCP Queen distribution, documentation, submission,
integration, SEO/GEO, testing, or maintenance work:

- Inspect, edit, generate technical assets, and run non-destructive checks
  without waiting for additional confirmation.
- Commit and push scoped technical changes to the current branch after required
  validation passes.
- Use the existing Wrangler deployment command only when the requested change
  affects the public Worker and the exact source state has passed tests.
- Use existing secure OAuth, CLI, keychain, secret-environment references, and
  named least-privilege cloud profiles within this product's distribution
  workflow. Never expose or commit raw secret values.
- Read platform-review messages and send factual technical replies through a
  connected approved mailbox when they belong to an existing submission or
  support thread.
- Complete final marketplace submission when `distribution/mcpqueen.json`
  authorizes it, the portal answers match reviewed artifacts, all validation
  passes, and the action creates no new contract or paid commitment.
- Verify the commit, remote, deployment identifier, canonical URLs, and one
  representative live workflow before reporting success.

## Manual gates

Stop before:

- deleting or rewriting data, Git history, branches, releases, or live
  resources;
- exposing secrets, creating a new long-lived credential, weakening
  authentication, changing ownership/publisher identity, or broadening account
  permissions beyond the declared least-privilege profile;
- accepting a new or nonstandard legal contract, making an unsupported
  attestation, or creating paid spend above the standing cap;
- applying D1 migrations or modifying production evidence, grades, moderation,
  field reports, or methodology;
- replacing an existing domain-verification token;
- starting an outreach batch that has not already had its target list, copy,
  and size approved.

Prepare everything around a manual gate and report the single action required.
CAPTCHA, 2FA, hardware-key, and device-confirmation challenges remain human
steps even when the surrounding submission is authorized.

## Validation

- Run `npm test`.
- Run `npm run distribution:check` for distribution or submission changes.
- Run `git diff --check`.
- Review the staged diff for secrets, local paths, personal/session text, and
  unsupported public claims.
- Use concise technical commit messages.

## Public repository hygiene

- Keep commits, documentation, issues, pull requests, and release notes
  technical.
- Do not include conversation context, personal schedules, private operational
  notes, “written by Codex,” AI-generated labels, or AI co-author trailers
  unless explicitly requested.
