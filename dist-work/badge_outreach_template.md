# Badge outreach — GitHub issue / email template

Targets: `badge_outreach_targets.csv` (400 A-grade, non-provisional servers
with GitHub repos, sorted by score then tool count). Columns include the
ready-made badge markdown per server.

Rules: only A grades get outreach (an owner will happily embed an A; never
cold-pitch a C). One per repo, no follow-up spam. GitHub issue preferred
over email: public, on-topic, and the maintainer can merge the snippet in
one click.

## GitHub issue template

Title: `Your MCP server graded A on MCP Queen — badge available`

Body:

> Hi — MCP Queen (mcpqueen.com) continuously probes every remote server in
> the official MCP registry and grades it deterministically. Your server
> **{server_name}** currently grades **A ({score}/100)**: it answered the
> initialize handshake, returned {tool_count} tools with typed schemas, and
> responded fast. Every point of the grade carries the verbatim probe
> observation that earned it: https://mcpqueen.com/s/{server_name}
>
> If you'd like to show it, here's a live badge (re-probed continuously, so
> it stays honest):
>
> ```markdown
> {badge_md}
> ```
>
> No signup, no cost, nothing to maintain. If the server ever degrades, the
> badge says so — that's the point. Feedback welcome.

## Notes

- The badge URL is `https://mcpqueen.com/badge/{server_name}.svg` and it
  reflects the live grade, so it stays accurate without action from them.
- Every embedded badge is a backlink and a distribution node.
- Track responses: which repos merged the badge (search GitHub for
  "mcpqueen.com/badge" periodically).
