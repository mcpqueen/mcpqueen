### Audit: 38 of 398 top-graded registry entries point at renamed/moved GitHub repos

[MCP Queen](https://mcpqueen.com) continuously probes and grades every remote server in the official registry. As part of a provenance audit (2026-07-28) we checked the `repository.url` of the 398 highest-graded remote servers against GitHub.

**Result: 0 hard 404s, but 38 entries (9.5%) reference repos that have been renamed or transferred.** GitHub's REST API follows the redirect, but GraphQL consumers resolve these as nonexistent (`Could not resolve to a Repository`), so any tooling built on GraphQL — and any human following a stale link after the redirect eventually expires — sees a broken source link. For a trust-sensitive ecosystem, a registry entry whose source pointer silently rots undermines the provenance the registry exists to provide.

Suggested fix directions (happy to help with any):
1. On publish/re-publish, resolve the repository URL and reject or warn on redirects.
2. A periodic job that re-resolves `repository.url` for active servers and flags redirects/404s on the entry.
3. Surface a `repository_verified_at` timestamp in the API.

<details><summary>The 38 affected entries (server → registered repo → current location)</summary>

| server | registered repo | status |
|---|---|---|
| `io.github.getgapup/mcp-knowledge` | https://github.com/getgapup/gapup-mcp | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `xyz.558686.gpt55/token-gateway` | https://github.com/go165/gpt55-x402-gateway | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}MISSING |
| `io.github.JcJamet/ia-qa-toolbox` | https://github.com/jcjamet/ia-qa | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.Shree-git/sendit` | https://github.com/Shree-git/sendit | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.thyn-ai/algenta` | https://github.com/thyn-ai/algenta | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `com.readyapis/api` | https://github.com/ReadyAPIs-com/readyapis | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `com.meta-council/decision-intelligence` | https://github.com/daliu/meta-council | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `app.saber.mcp/saber` | https://github.com/saberapp/platform | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.apis/apis-io` | https://github.com/api-search/apis-io-aws | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `ai.tunnelmind/data` | https://github.com/TunnelMind/tunnelmind-data-api | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.CueCrux/vaultcrux-platform` | https://github.com/CueCrux/VaultCrux | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.emc2ai/einstein` | https://github.com/ChuXo/Eliza | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.DigbyO/colour-memory` | https://github.com/DigbyO/colour-memory-api | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `app.onehaus/haus` | https://github.com/Im5tu/haus | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.rccola990-cloud/x402-agent-store` | https://github.com/rccola990-cloud/x402-agent-store | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}MISSING |
| `net.programmes/developer-tools` | https://github.com/setkernel/programmes-net | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `com.loppee/loppee` | https://github.com/4dwebspro-cell/ylai-platform | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}MISSING |
| `xyz.lonestaroracle/mcp-server` | https://github.com/Homie4570/lso-mcp | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}MISSING |
| `io.github.PayRam/payram-helper-mcp` | https://github.com/PayRam/payram-helper-mcp-server | → PayRam/payram-mcp |
| `io.github.digitalweb33333-creator/x402-endpoints` | https://github.com/digitalweb33333-creator/x402-endpoints | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `com.kaicalls/kaicalls` | https://github.com/cgallic/kaicalls-mcp | → KaiCalls/kaicalls-mcp |
| `de.carbon-cashmere.api/crypto-intelligence` | https://github.com/Nedeljko87/Carbon-Cashmere | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.tooloracle/ampel` | https://github.com/ToolOracle/ampel | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.XogZ3/botoi-mcp` | https://github.com/XogZ3/botoi | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `app.noemic/noemic` | https://github.com/MorganFisher2007/Noemic | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `com.stratalize/finance` | https://github.com/Stratalize/Stratalize | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.bdentech/chieflab` | https://github.com/bdentech/chiefmo-agent | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}MISSING |
| `io.github.Airpote/avalanche-docs` | https://github.com/Airpote/avalanche-mcp-vscode | → yassirboudda/avalanche-mcp-vscode |
| `io.github.atomadictech/aaaa-nexus` | https://github.com/atomadictech/aaaa-nexus | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `ai.snowsure/snow` | https://github.com/mikeslone/snowsure-web | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `com.rubrkit/rubrkit` | https://github.com/liberat0r/react-rubrkit | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `be.vibedeploy/vibedeploy` | https://github.com/thomasbillen-netizen/vibedeploy-api | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `dev.busymate/busymate-devtools` | https://github.com/serebano/busymate-devtools | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `io.github.lastmanupinc-hub/axis-toolbox` | https://github.com/lastmanupinc-hub/Toolbox | → lastmanupinc-hub/AXIS-iliad |
| `io.github.wikatar/arkolith` | https://github.com/wikatar/Arkolith.com | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `to.agentservices/agentservices` | https://github.com/vbkotecha/aiservices-api | → vbkotecha/agentservices-api |
| `app.ottodata/otto` | https://github.com/Degergokalp/otto-data | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |
| `ai.nullary/nullary` | https://github.com/nullary-ai/nullary | → {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}MISSING |

</details>

Method: `GET /repos/{owner}/{repo}` for each entry; `MISSING` = 404, `→ x/y` = REST redirect to a different full_name. Full CSV available on request. Found while running badge outreach to A-grade servers; 6 of our first 20 GitHub issues failed with GraphQL resolution errors, which is what prompted the audit.
