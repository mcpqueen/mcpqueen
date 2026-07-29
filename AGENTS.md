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

## Routine autonomous work

For explicitly requested MCP Queen distribution, documentation, submission,
integration, SEO/GEO, testing, or maintenance work:

- Inspect, edit, generate technical assets, and run non-destructive checks
  without waiting for additional confirmation.
- Commit and push scoped technical changes to the current branch after required
  validation passes.
- Use the existing Wrangler deployment command only when the requested change
  affects the public Worker and the exact source state has passed tests.
- Verify the commit, remote, deployment identifier, canonical URLs, and one
  representative live workflow before reporting success.

## Manual gates

Stop before:

- deleting or rewriting data, Git history, branches, releases, or live
  resources;
- changing secrets, authentication, billing, ownership, account permissions,
  legal terms, or publisher identity;
- applying D1 migrations or modifying production evidence, grades, moderation,
  field reports, or methodology;
- replacing an existing domain-verification token;
- submitting final marketplace attestations or pressing a final review/publish
  button;
- starting an outreach batch that has not already had its target list, copy,
  and size approved.

Prepare everything around a manual gate and report the single action required.

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
