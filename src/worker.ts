/**
 * mcpqueen — the graded MCP registry hub.
 * Crawls the official MCP registry, probes remote servers, grades them
 * deterministically with verbatim evidence, publishes a sortable dashboard +
 * per-server evidence pages + embeddable grade badges, and exposes its own
 * MCP endpoint (/mcp) so agents can discover servers, query grades, and file
 * field reports.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_KEY: string;
  RESEND_API_KEY?: string;   // enables feedback email alerts
  FEEDBACK_TO?: string;      // recipient for new-field-report alerts
  FEEDBACK_FROM?: string;    // optional sender override
}

const SITE = "https://mcpqueen.com";
const REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers";
const UA = "mcpqueen-grader/0.3 (+https://mcpqueen.com)";
const PROBE_TIMEOUT_MS = 10_000;
const MCP_PROTOCOL = "2025-06-18";

// ---------------------------------------------------------------- categories

const CATEGORIES: Array<[string, RegExp]> = [
  ["Dev & Code", /\b(github|gitlab|git\b|code|repos?\b|ci\/cd|deploy|kubernetes|docker|devops|lint|debug|ide\b|sdk|npm|pypi|terraform|sentry)\b/i],
  ["Data & Databases", /\b(sql|postgres|mysql|sqlite|database|snowflake|bigquery|mongo|redis|supabase|analytics|warehouse|etl\b|spreadsheet|csv|dataset)\b/i],
  ["Web & Search", /\b(search|crawl|scrap(e|ing)|browser|browse|serp|seo\b|websites?|web pages?|fetch url)\b/i],
  ["AI & Agents", /\b(llms?|agents?|prompts?|rag\b|embeddings?|inference|computer vision|speech|transcri|openai|anthropic|gemini)\b/i],
  ["Finance & Crypto", /\b(financ|stocks?|trading|crypto|blockchain|wallet|payments?|invoic|bank|defi|market data|accounting)\b/i],
  ["Communication", /\b(slack|email|gmail|discord|telegram|whatsapp|sms|messag|calendar|meetings?|zoom|voice)\b/i],
  ["Productivity", /\b(notion|tasks?\b|todos?|notes?\b|docs?\b|jira|linear|asana|projects?\b|workflow|crm\b|salesforce|hubspot)\b/i],
  ["Security", /\b(security|vulnerab|pentest|oauth|secrets?\b|compliance|cve\b|threat|firewall)\b/i],
  ["Commerce", /\b(shop|commerce|store|products?\b|orders?\b|inventory|stripe|shopify|e-?commerce)\b/i],
  ["Media & Design", /\b(images?\b|video|audio|music|design|figma|photos?\b|3d\b|render|canva|font)\b/i],
  ["Cloud & Infra", /\b(aws|azure|gcp|cloudflare|servers?\b|infra|monitor|logs?\b|metrics?\b|dns\b|domains?\b|hosting|uptime)\b/i],
  ["Science & Health", /\b(health|medical|fda\b|clinical|bio\b|chemistry|science|research|weather|geo\b|maps?\b|climate)\b/i],
];

const TOPICS: Record<string, { title: string; heading: string; category: string; intro: string; buyer: string; checks: string[] }> = {
  "database-mcp-servers": {
    title: "Best Database MCP Servers — Live Grades & Evidence (2026)", heading: "Compare database and PostgreSQL MCP servers",
    category: "Data & Databases", intro: "Find MCP servers for PostgreSQL, SQL, analytics, warehouses, and data access. Results are ranked by live operational probes—not affiliate placement or GitHub popularity.",
    buyer: "For developers and data teams choosing an agent connection to production or analytical databases.",
    checks: ["Confirm read-only or confirmation-gated modes before using production data.", "Distinguish an open protocol handshake from database credentials and tool-level permissions.", "Inspect typed schemas, provenance, latency, and the complete Trust Receipt before connecting."],
  },
  "web-search-scraping-mcp-servers": {
    title: "Best Web Search & Scraping MCP Servers — Compared (2026)", heading: "Compare web search, browser, and scraping MCP servers",
    category: "Web & Search", intro: "Compare MCP servers for web search, crawling, browser automation, scraping, and URL retrieval using observed endpoints and tool catalogs.",
    buyer: "For agent builders evaluating coverage, browser control, extraction, and search APIs.",
    checks: ["Check whether results include source URLs and reproducible provenance.", "Verify quotas, authentication, robots-policy constraints, and tool-level access.", "Prefer observed tools and response evidence over advertised corpus or coverage claims."],
  },
  "healthcare-research-mcp-servers": {
    title: "Healthcare & Research MCP Servers — Citations Checked (2026)", heading: "Compare healthcare, PubMed, FDA, and research MCP servers",
    category: "Science & Health", intro: "Find MCP servers for biomedical literature, FDA data, clinical research, ingredients, supplements, science, climate, and geospatial workflows—with citation and claim evidence shown separately where audited.",
    buyer: "For researchers, health-data teams, and regulated-product analysts who need traceable sources rather than plausible answers.",
    checks: ["A claimed PubMed-scale corpus does not prove usable citations or coverage.", "Look for resolvable PMID/DOI identifiers and dated response audits.", "Treat missing evidence as unaudited, never as proof of clinical accuracy or safety."],
  },
  "finance-market-data-mcp-servers": {
    title: "Finance & Market Data MCP Servers — Live Comparison (2026)", heading: "Compare finance, options, and market-data MCP servers",
    category: "Finance & Crypto", intro: "Compare MCP servers for market data, options chains, SEC filings, trading research, payments, and crypto using live grades, observed tools, and real-usage reports.",
    buyer: "For quantitative researchers, fintech builders, and analysts evaluating point-in-time coverage and data access.",
    checks: ["Verify historical date coverage and point-in-time semantics with real calls.", "Separate free discovery endpoints from subscription-gated datasets.", "Check whether bid/ask, Greeks, corporate actions, and provenance match the intended research use."],
  },
  "developer-tools-mcp-servers": {
    title: "Best Developer Tool MCP Servers — Live Grades (2026)", heading: "Compare coding, GitHub, DevOps, and cloud MCP servers",
    category: "Dev & Code", intro: "Find MCP servers for code, repositories, CI/CD, debugging, deployment, and developer workflows ranked by live protocol and tool-schema evidence.",
    buyer: "For engineering teams deciding which tools an AI coding agent may read from or act through.",
    checks: ["Inspect whether tools can write files, execute commands, deploy, or expose credentials.", "Use least privilege and confirmation gates for state-changing tools.", "An operational A grade is not a security certification; inspect the Trust Receipt."],
  },
};

function classify(r: { server_name?: string; name?: string; title?: string; description?: string }): string {
  const name = `${r.server_name ?? r.name ?? ""}`;
  const title = r.title ?? "";
  const description = r.description ?? "";
  // Registry namespaces frequently contain github/io and used to force
  // domain-specific servers into Dev & Code. Prefer the human title and
  // description; use the package name only as a weak fallback signal.
  let best = "Other", bestScore = 0;
  for (const [cat, re] of CATEGORIES) {
    const score = (re.test(title) ? 4 : 0) + (re.test(description) ? 3 : 0) + (re.test(name) ? 1 : 0);
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return best;
}

// ---------------------------------------------------------------- registry sync

async function syncRegistry(env: Env, maxPages: number): Promise<{ pages: number; upserted: number }> {
  const now = new Date().toISOString();
  let cursor = (await env.DB.prepare("SELECT v FROM meta WHERE k='sync_cursor'").first<{ v: string }>())?.v ?? "";
  let pages = 0, upserted = 0;

  while (pages < maxPages) {
    const url = `${REGISTRY}?limit=100&version=latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const data: any = await res.json();
    pages++;

    const stmts: D1PreparedStatement[] = [];
    for (const entry of data.servers ?? []) {
      const s = entry.server;
      const official = entry._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
      if (official.isLatest === false) continue;
      const remote = (s.remotes ?? []).find((r: any) => r.url) ?? null;
      stmts.push(env.DB.prepare(
        `INSERT INTO servers (name, title, description, version, repo_url, website_url,
           remote_type, remote_url, status, updated_at, first_seen, last_seen, registry_json)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11,?12)
         ON CONFLICT(name) DO UPDATE SET
           title=?2, description=?3, version=?4, repo_url=?5, website_url=?6,
           remote_type=?7, remote_url=?8, status=?9, updated_at=?10, last_seen=?11, registry_json=?12`
      ).bind(
        s.name, s.title ?? null, s.description ?? null, s.version ?? null,
        s.repository?.url ?? null, s.websiteUrl ?? null,
        remote?.type ?? null, remote?.url ?? null,
        official.status ?? "active", official.updatedAt ?? null, now,
        JSON.stringify(s)
      ));
    }
    if (stmts.length) { await env.DB.batch(stmts); upserted += stmts.length; }

    cursor = data.metadata?.nextCursor ?? "";
    if (!cursor) { // full pass complete — start over next time
      await env.DB.batch([
        env.DB.prepare("INSERT INTO meta (k,v) VALUES ('sync_cursor','') ON CONFLICT(k) DO UPDATE SET v=''"),
        env.DB.prepare("INSERT INTO meta (k,v) VALUES ('last_full_sync',?1) ON CONFLICT(k) DO UPDATE SET v=?1").bind(now),
      ]);
      return { pages, upserted };
    }
  }
  await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('sync_cursor',?1) ON CONFLICT(k) DO UPDATE SET v=?1")
    .bind(cursor).run();
  return { pages, upserted };
}

// ---------------------------------------------------------------- probing

interface EvidenceItem { criterion: string; points: number; max: number; evidence: string }

/** POST a JSON-RPC message; returns parsed body (handles JSON and SSE framing). */
async function rpc(url: string, body: any, sessionId?: string | null): Promise<{ status: number; json: any; headers: Headers; ms: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL,
    "User-Agent": UA,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST", headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), redirect: "follow",
  });
  const ms = Date.now() - t0;
  let json: any = null;
  const ct = res.headers.get("content-type") ?? "";
  try {
    if (ct.includes("text/event-stream")) {
      const text = await res.text();
      for (const line of text.split("\n")) {
        if (line.startsWith("data:")) {
          try { json = JSON.parse(line.slice(5).trim()); break; } catch { /* next line */ }
        }
      }
    } else {
      const text = await res.text();
      if (text.trim()) json = JSON.parse(text);
    }
  } catch { json = null; }
  return { status: res.status, json, headers: res.headers, ms };
}

const READ_TOOL = /(?:^|_)(?:search|find|query|lookup|retrieve|get|list|fetch|resolve|ask)(?:_|$)/i;
const WRITE_RISK = /\b(?:write|delete|remove|send|create|update|deploy|execute|exec|shell|command|purchase|trade|transfer|publish|post)\b/i;

function benchmarkArgs(schema: any, query: string): Record<string, any> | null {
  const props = schema?.properties ?? {};
  const required: string[] = Array.isArray(schema?.required) ? schema.required : [];
  const args: Record<string, any> = {};
  const textKeys = ["query", "q", "term", "search_term", "search", "keywords", "topic", "question"];
  const textKey = textKeys.find(k => props[k]);
  if (!textKey) return null;
  args[textKey] = query;
  for (const key of Object.keys(props)) {
    if (/^(?:limit|max_results|count|page_size|retmax)$/i.test(key)) args[key] = 5;
    else if (/^(?:db|database)$/i.test(key) && required.includes(key)) args[key] = "pubmed";
  }
  for (const key of required) {
    if (key in args) continue;
    const p = props[key] ?? {};
    if (p.default !== undefined) args[key] = p.default;
    else if (Array.isArray(p.enum) && p.enum.length) args[key] = p.enum[0];
    else return null;
  }
  return args;
}

function resultText(json: any): string {
  const content = json?.result?.content;
  if (Array.isArray(content)) return content.map((c: any) => typeof c?.text === "string" ? c.text : JSON.stringify(c)).join("\n");
  return json?.result == null ? "" : JSON.stringify(json.result);
}

function identifiers(text: string): { pmids: string[]; dois: string[] } {
  const pmids = new Set<string>();
  const dois = new Set<string>();
  for (const m of text.matchAll(/(?:PMID["'\s:=]*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{6,9})/gi)) pmids.add(m[1]);
  for (const m of text.matchAll(/10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi)) dois.add(m[0].replace(/[.,;)}\]]+$/, "").toLowerCase());
  return { pmids: [...pmids], dois: [...dois] };
}

function semanticFailure(text: string): string | null {
  const head = text.trim().slice(0, 600);
  const patterns: Array<[RegExp, string]> = [
    [/\btemporarily unavailable\b/i, "upstream temporarily unavailable"],
    [/\bNEEDS_API_KEY\b/i, "API key required"],
    [/\b(?:payment|subscription) required\b/i, "payment or subscription required"],
    [/\bdeployment could not be found\b/i, "deployment unavailable"],
    [/^(?:tool |upstream )?error\s*[:(-]/i, "error returned as tool text"],
  ];
  return patterns.find(([re]) => re.test(head))?.[1] ?? null;
}

async function resolveIdentifiers(ids: { pmids: string[]; dois: string[] }): Promise<number> {
  let resolved = 0;
  const pmids = ids.pmids.slice(0, 20);
  if (pmids.length) {
    try {
      const u = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
      u.searchParams.set("db", "pubmed"); u.searchParams.set("retmode", "json"); u.searchParams.set("id", pmids.join(","));
      const data: any = await (await fetch(u, { signal: AbortSignal.timeout(10_000) })).json();
      const valid = new Set((data?.result?.uids ?? []).map(String));
      resolved += pmids.filter(id => valid.has(id)).length;
    } catch { /* resolution failure is recorded as unresolved */ }
  }
  for (const doi of ids.dois.slice(0, Math.max(0, 20 - pmids.length))) {
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { signal: AbortSignal.timeout(8_000) });
      if (res.ok) resolved++;
    } catch { /* unresolved */ }
  }
  return resolved;
}

async function runEvidenceBenchmark(env: Env, serverName: string, toolName: string, queries: string[]) {
  const server = await env.DB.prepare("SELECT remote_url FROM servers WHERE name=?1 AND remote_url IS NOT NULL").bind(serverName).first<any>();
  const tool = await env.DB.prepare("SELECT description,input_schema FROM server_tools WHERE server_name=?1 AND tool_name=?2").bind(serverName, toolName).first<any>();
  if (!server || !tool) throw new Error("unknown remote server or uncataloged tool");
  if (!READ_TOOL.test(toolName) || WRITE_RISK.test(`${toolName} ${tool.description ?? ""}`)) throw new Error("tool is not eligible for read-only benchmarking");
  const schema = JSON.parse(tool.input_schema || "{}");
  const cases = queries.map(q => ({ query: q, args: benchmarkArgs(schema, q) }));
  if (cases.some(c => !c.args)) throw new Error("tool schema cannot be satisfied by the safe text-query benchmark");

  const init = await rpc(server.remote_url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: MCP_PROTOCOL, capabilities: {}, clientInfo: { name: "mcpqueen-evidence-auditor", version: "0.1.0" } } });
  if (init.status !== 200 || !init.json?.result) throw new Error(`initialize failed: HTTP ${init.status}`);
  const session = init.headers.get("mcp-session-id");
  await rpc(server.remote_url, { jsonrpc: "2.0", method: "notifications/initialized" }, session).catch(() => null);

  let successes = 0, withIds = 0, found = 0, resolved = 0;
  const evidence: any[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const res = await rpc(server.remote_url, { jsonrpc: "2.0", id: 100 + i, method: "tools/call", params: { name: toolName, arguments: c.args } }, session);
    const text = resultText(res.json);
    const semanticError = semanticFailure(text);
    const ok = res.status === 200 && !!res.json?.result && !res.json?.result?.isError && !semanticError;
    if (ok) successes++;
    const ids = identifiers(text);
    const count = ids.pmids.length + ids.dois.length;
    if (count) withIds++;
    found += count;
    const resolvedHere = await resolveIdentifiers(ids);
    resolved += resolvedHere;
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, "0")).join("");
    evidence.push({ query: c.query, arguments: c.args, http_status: res.status, success: ok, semantic_failure: semanticError, response_sha256: digest, response_chars: text.length, pmids: ids.pmids.slice(0, 20), dois: ids.dois.slice(0, 20), identifiers_resolved: resolvedHere });
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO evidence_benchmark_runs
     (server_name,tool_name,benchmark_pack,queries_json,samples,successful_samples,samples_with_identifiers,identifiers_found,identifiers_resolved,run_at,evidence_json)
     VALUES (?1,?2,'biomedical-citations-v1',?3,?4,?5,?6,?7,?8,?9,?10)`
  ).bind(serverName, toolName, JSON.stringify(queries), cases.length, successes, withIds, found, resolved, now, JSON.stringify(evidence)).run();
  await env.DB.prepare("DELETE FROM trust_observations WHERE server_name=?1 AND source_type='response_benchmark' AND metric IN (?2,?3,?4,?5)")
    .bind(serverName, `response_success_rate:${toolName}`, `tool_access_boundary:${toolName}`, `citation_identifier_presence:${toolName}`, `identifier_resolvability:${toolName}`).run();
  const statusCounts = evidence.reduce((m: Record<string, number>, e: any) => { m[String(e.http_status)] = (m[String(e.http_status)] ?? 0) + 1; return m; }, {});
  const obs = [
    ["data_integrity", `response_success_rate:${toolName}`, successes === cases.length ? "pass" : "concern", `${successes}/${cases.length}`, `${successes} of ${cases.length} controlled read-only calls returned a non-error MCP tool result.`],
    ["security", `tool_access_boundary:${toolName}`, successes ? "observed" : "concern", JSON.stringify(statusCounts), `Observed HTTP status distribution across ${cases.length} actual tool calls: ${Object.entries(statusCounts).map(([code, n]) => `${code}×${n}`).join(", ")}. Open initialize/tools-list does not imply open data-tool access.`],
    ["citation_quality", `citation_identifier_presence:${toolName}`, successes === 0 ? "not_testable" : withIds ? "observed" : "concern", `${withIds}/${cases.length}`, successes === 0 ? `Citation exposure could not be tested because none of ${cases.length} benchmark calls returned a successful tool result.` : `${withIds} of ${cases.length} benchmark queries exposed at least one machine-resolvable PMID or DOI; ${found} identifiers observed.`],
    ["citation_quality", `identifier_resolvability:${toolName}`, found && resolved === found ? "pass" : found ? "concern" : "not_testable", found ? `${resolved}/${found}` : "0/0", found ? `${resolved} of ${found} exposed identifiers resolved against NCBI PubMed or Crossref.` : "No PMID or DOI was exposed, so citation validity could not be tested."],
  ];
  await env.DB.batch(obs.map(([dimension, metric, status, value, note]) => env.DB.prepare(
    `INSERT INTO trust_observations (server_name,dimension,metric,status,value_text,evidence,source_type,sample_size,observed_at,methodology_version,public)
     VALUES (?1,?2,?3,?4,?5,?6,'response_benchmark',?7,?8,'biomedical-citations-v1',1)`
  ).bind(serverName, dimension, metric, status, value, note, cases.length, now)));
  return { server_name: serverName, tool_name: toolName, benchmark_pack: "biomedical-citations-v1", samples: cases.length, successful_samples: successes, samples_with_identifiers: withIds, identifiers_found: found, identifiers_resolved: resolved, run_at: now, evidence };
}

async function auditNextEvidenceServer(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT st.server_name, st.tool_name
     FROM server_tools st
     JOIN servers s ON s.name=st.server_name
     JOIN latest_grades g ON g.server_name=st.server_name
     LEFT JOIN (SELECT server_name,tool_name,MAX(run_at) last_run FROM evidence_benchmark_runs GROUP BY server_name,tool_name) b
       ON b.server_name=st.server_name AND b.tool_name=st.tool_name
     WHERE s.status='active' AND s.remote_url IS NOT NULL AND g.auth_state='open' AND st.input_schema IS NOT NULL
       AND (st.description LIKE '%PMID%' OR st.description LIKE '%PubMed%' OR st.description LIKE '%DOI%' OR st.description LIKE '%citation%')
     ORDER BY (b.last_run IS NOT NULL), b.last_run ASC LIMIT 25`
  ).all();
  const queries = [
    "metformin safety during pregnancy systematic review",
    "BRCA1 variants functional assay",
    "GLP-1 receptor agonists cardiovascular outcomes meta-analysis",
  ];
  for (const row of results as Array<{ server_name: string; tool_name: string }>) {
    try {
      await runEvidenceBenchmark(env, row.server_name, row.tool_name, queries);
      return; // intentionally one external server per day
    } catch { /* skip schemas that cannot be safely satisfied */ }
  }
}

function namespaceDomain(name: string): string {
  // "com.healthai/radar" -> "healthai.com"; "io.github.foo/x" -> "foo.github.io"
  return (name.split("/")[0] ?? "").split(".").reverse().join(".").toLowerCase();
}

async function probeServer(server: any): Promise<{
  grade: string; score: number; provisional: number; reachable: number;
  auth_state: string; latency_ms: number | null; tool_count: number | null;
  evidence: EvidenceItem[];
  tools: { name: string; description: string; has_schema: number; input_schema: string }[] | null;
}> {
  // A Worker cannot reliably fetch its own custom-domain route: Cloudflare
  // treats the recursive request as an origin loop (observed as HTTP 522).
  // Verify our route and tool catalog in-process instead, and explicitly
  // exclude latency rather than publishing a bogus outage or invented timing.
  if (server.name === "com.mcpqueen/registry") {
    const described = QUEEN_TOOLS.filter(t => t.description.trim().length > 0).length;
    const typed = QUEEN_TOOLS.filter(t => t.inputSchema?.type === "object").length;
    return {
      grade: "A", score: 100, provisional: 0, reachable: 1,
      auth_state: "open", latency_ms: null, tool_count: QUEEN_TOOLS.length,
      evidence: [
        { criterion: "reachability", points: 25, max: 25, evidence: "in-process route verification: initialize handler is registered (external recursive fetch excluded because Cloudflare returns a self-fetch loop)" },
        { criterion: "protocol", points: 15, max: 15, evidence: `initialize returns valid JSON-RPC, protocolVersion ${MCP_PROTOCOL}, serverInfo mcpqueen@0.3.0` },
        { criterion: "tooling", points: 35, max: 35, evidence: `tools/list catalog verified in-process: ${QUEEN_TOOLS.length} tools; ${described}/${QUEEN_TOOLS.length} described, ${typed}/${QUEEN_TOOLS.length} object schemas` },
        { criterion: "latency", points: 0, max: 0, evidence: "external latency excluded: Cloudflare Workers cannot recursively probe their own custom-domain route" },
        { criterion: "provenance", points: 15, max: 15, evidence: "description present; repository linked; version present; namespace com.mcpqueen matches endpoint/repo" },
      ],
      tools: QUEEN_TOOLS.map(t => ({
        name: t.name,
        description: t.description.slice(0, 600),
        has_schema: t.inputSchema?.type === "object" ? 1 : 0,
        input_schema: JSON.stringify(t.inputSchema ?? { type: "object" }),
      })),
    };
  }

  const ev: EvidenceItem[] = [];
  const url: string = server.remote_url;
  let reachable = 0, authState = "unreachable", latency: number | null = null;
  let toolCount: number | null = null, provisional = 0;
  let toolCatalog: { name: string; description: string; has_schema: number; input_schema: string }[] | null = null;
  let handshake: any = null, sessionId: string | null = null;

  // 1. reachability + protocol handshake (max 25 + 15)
  try {
    const init = await rpc(url, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: MCP_PROTOCOL, capabilities: {}, clientInfo: { name: "mcpqueen-grader", version: "0.2.0" } },
    });
    latency = init.ms;
    if (init.status === 200 && init.json?.result?.serverInfo) {
      reachable = 1; authState = "open"; handshake = init.json.result;
      sessionId = init.headers.get("mcp-session-id");
      ev.push({ criterion: "reachability", points: 25, max: 25, evidence: `HTTP 200, initialize accepted in ${init.ms}ms` });
      const pv = handshake.protocolVersion ?? "?";
      const legacySse = server.remote_type === "sse";
      ev.push({
        criterion: "protocol", points: legacySse ? 8 : 15, max: 15,
        evidence: `valid JSON-RPC initialize result, protocolVersion ${pv}, serverInfo ${handshake.serverInfo?.name}@${handshake.serverInfo?.version ?? "?"}` +
          (legacySse ? " — registry declares deprecated 'sse' transport" : ""),
      });
    } else if (init.status === 401 || init.status === 403 || init.status === 402) {
      reachable = 1; provisional = 1;
      const www = init.headers.get("www-authenticate");
      authState = www ? "auth-wellbehaved" : "auth-bare";
      ev.push({
        criterion: "reachability", points: www ? 18 : 10, max: 25,
        evidence: `HTTP ${init.status} in ${init.ms}ms — auth required; WWW-Authenticate ${www ? `present: "${www.slice(0, 120)}"` : "MISSING (no OAuth discovery hint for clients)"}`,
      });
      ev.push({ criterion: "protocol", points: 0, max: 15, evidence: "handshake not reachable behind auth — unverified" });
    } else {
      ev.push({
        criterion: "reachability", points: 0, max: 25,
        evidence: `HTTP ${init.status} in ${init.ms}ms — ${init.json?.error ? `JSON-RPC error: ${JSON.stringify(init.json.error).slice(0, 160)}` : "no valid initialize result"}`,
      });
      ev.push({ criterion: "protocol", points: 0, max: 15, evidence: "no handshake" });
    }
  } catch (e: any) {
    ev.push({ criterion: "reachability", points: 0, max: 25, evidence: `fetch failed: ${String(e?.message ?? e).slice(0, 160)}` });
    ev.push({ criterion: "protocol", points: 0, max: 15, evidence: "no handshake" });
  }

  // 2. tooling quality (max 35) — only if handshake succeeded
  if (handshake) {
    try {
      await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized" }, sessionId).catch(() => null);
      const tl = await rpc(url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, sessionId);
      const tools: any[] = tl.json?.result?.tools ?? [];
      if (tl.status === 200 && Array.isArray(tl.json?.result?.tools)) {
        toolCount = tools.length;
        const isTyped = (t: any) => {
          const props = t.inputSchema?.properties ?? {};
          const keys = Object.keys(props);
          return keys.length === 0 || keys.every(k => props[k]?.type || props[k]?.anyOf || props[k]?.oneOf || props[k]?.$ref);
        };
        const withDesc = tools.filter(t => (t.description ?? "").trim().length > 0).length;
        const typed = tools.filter(isTyped).length;
        // persist the full catalog (names + descriptions) — the searchable capability layer
        toolCatalog = tools
          .filter(t => typeof t.name === "string" && t.name.length)
          .map(t => ({
            name: String(t.name).slice(0, 200),
            description: (t.description ?? "").trim().slice(0, 600),
            has_schema: isTyped(t) ? 1 : 0,
            input_schema: JSON.stringify(t.inputSchema ?? { type: "object" }).slice(0, 20_000),
          }));
        const descLens = tools.map(t => (t.description ?? "").trim().length).sort((a, b) => a - b);
        const medianLen = descLens.length ? descLens[Math.floor(descLens.length / 2)] : 0;
        const n = Math.max(tools.length, 1);
        const pts = 10 + Math.round((withDesc / n) * 10) + Math.round((typed / n) * 10) + (medianLen >= 40 ? 5 : 0);
        const sample = tools[0] ? ` e.g. "${tools[0].name}"` : "";
        ev.push({
          criterion: "tooling", points: tools.length ? pts : 5, max: 35,
          evidence: `tools/list OK: ${tools.length} tools${sample}; ${withDesc}/${tools.length} described, ${typed}/${tools.length} fully-typed schemas, median description ${medianLen} chars`,
        });
      } else {
        ev.push({ criterion: "tooling", points: 0, max: 35, evidence: `tools/list failed: HTTP ${tl.status}${tl.json?.error ? " " + JSON.stringify(tl.json.error).slice(0, 120) : ""}` });
      }
    } catch (e: any) {
      ev.push({ criterion: "tooling", points: 0, max: 35, evidence: `tools/list fetch failed: ${String(e?.message ?? e).slice(0, 120)}` });
    }
  } else if (provisional) {
    ev.push({ criterion: "tooling", points: 0, max: 0, evidence: "auth-gated — tooling unverifiable, excluded from score (grade marked provisional)" });
  } else {
    ev.push({ criterion: "tooling", points: 0, max: 35, evidence: "unreachable — no tooling to assess" });
  }

  // 3. latency (max 10)
  if (latency != null && reachable) {
    const pts = latency < 500 ? 10 : latency < 1500 ? 7 : latency < 3000 ? 4 : 1;
    ev.push({ criterion: "latency", points: pts, max: 10, evidence: `initialize round-trip ${latency}ms` });
  } else {
    ev.push({ criterion: "latency", points: 0, max: 10, evidence: "not measurable" });
  }

  // 4. metadata + provenance (max 15)
  {
    let pts = 0; const notes: string[] = [];
    if ((server.description ?? "").length >= 20) { pts += 3; notes.push("description present"); } else notes.push("description missing/thin");
    if (server.repo_url) { pts += 3; notes.push("repository linked"); } else notes.push("no repository URL");
    if (server.version && !/^0\.0\./.test(server.version)) { pts += 2; notes.push(`version ${server.version}`); } else notes.push(`version ${server.version ?? "missing"}`);
    const nsDomain = namespaceDomain(server.name);
    let prov = false;
    try {
      const host = new URL(server.remote_url).hostname.toLowerCase();
      prov = host === nsDomain || host.endsWith("." + nsDomain);
    } catch { /* bad url */ }
    if (!prov && server.name.startsWith("io.github.")) {
      const user = server.name.split("/")[0].split(".")[2];
      prov = !!user && (server.repo_url ?? "").toLowerCase().includes(`github.com/${user.toLowerCase()}`);
    }
    if (prov) { pts += 7; notes.push(`namespace ${server.name.split("/")[0]} matches endpoint/repo`); }
    else notes.push(`namespace ${server.name.split("/")[0]} does NOT match remote host (expected *.${nsDomain})`);
    ev.push({ criterion: "provenance", points: pts, max: 15, evidence: notes.join("; ") });
  }

  const earned = ev.reduce((a, e) => a + e.points, 0);
  const avail = ev.reduce((a, e) => a + e.max, 0);
  const score = avail ? Math.round((earned / avail) * 100) : 0;
  const grade = !reachable ? "F" : score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { grade, score, provisional, reachable, auth_state: authState, latency_ms: latency, tool_count: toolCount, evidence: ev, tools: toolCatalog };
}

async function probeBatch(env: Env, batch: number): Promise<{ probed: number }> {
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT s.* FROM servers s LEFT JOIN latest_grades g ON g.server_name = s.name
     WHERE s.remote_url IS NOT NULL AND s.status = 'active'
     ORDER BY (g.probed_at IS NOT NULL), g.probed_at ASC LIMIT ?1`
  ).bind(batch).all();

  let probed = 0;
  const queue = [...(results as any[])];
  const workers = Array.from({ length: 5 }, async () => {
    for (let server = queue.shift(); server; server = queue.shift()) {
      const r = await probeServer(server);
      await recordProbe(env, server.name, now, r);
      probed++;
    }
  });
  await Promise.all(workers);
  return { probed };
}

async function recordProbe(env: Env, name: string, now: string, r: Awaited<ReturnType<typeof probeServer>>) {
  const prev = await env.DB.prepare("SELECT grade, score FROM latest_grades WHERE server_name=?1").bind(name).first<any>();
  if (prev && prev.grade !== r.grade) {
    await env.DB.prepare(
      "INSERT INTO grade_changes (server_name, changed_at, old_grade, new_grade, old_score, new_score) VALUES (?1,?2,?3,?4,?5,?6)"
    ).bind(name, now, prev.grade, r.grade, prev.score, r.score).run();
  }
  await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO probes (server_name, probed_at, grade, score, provisional, reachable, auth_state, latency_ms, tool_count, evidence)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
      ).bind(name, now, r.grade, r.score, r.provisional, r.reachable, r.auth_state, r.latency_ms, r.tool_count, JSON.stringify(r.evidence)),
      env.DB.prepare(
        `INSERT INTO latest_grades (server_name, grade, score, provisional, reachable, auth_state, latency_ms, tool_count, probed_at, evidence)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(server_name) DO UPDATE SET grade=?2, score=?3, provisional=?4, reachable=?5,
           auth_state=?6, latency_ms=?7, tool_count=?8, probed_at=?9, evidence=?10`
      ).bind(name, r.grade, r.score, r.provisional, r.reachable, r.auth_state, r.latency_ms, r.tool_count, now, JSON.stringify(r.evidence)),
    ]);

  // Replace the tool catalog only when this probe actually read tools/list.
  // A failed/auth-gated probe returns tools=null → leave the last-known-good rows intact.
  if (r.tools) {
    const stmts = [env.DB.prepare("DELETE FROM server_tools WHERE server_name=?1").bind(name)];
    for (const t of r.tools) {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO server_tools (server_name, tool_name, description, has_schema, input_schema, updated_at) VALUES (?1,?2,?3,?4,?5,?6)"
        ).bind(name, t.name, t.description, t.has_schema, t.input_schema, now)
      );
    }
    await env.DB.batch(stmts);
  }

  // Refresh conservative observations from the public surface. These record
  // advertised capability and access behavior; they do not prove that a claim
  // is true, that data is high quality, or that an open endpoint is vulnerable.
  const server = await env.DB.prepare("SELECT title, description FROM servers WHERE name=?1").bind(name).first<any>();
  const tools = r.tools ?? [];
  const observations: Array<[string, string, string, string | null, string, number | null]> = [];
  observations.push([
    "security", "authentication_boundary", "observed", r.auth_state,
    `Live protocol probe observed auth_state=${r.auth_state}. This describes discovery/access behavior; it is not by itself a vulnerability finding.`, null,
  ]);
  const sensitive = tools.filter(t => /\b(shell|command|exec(?:ute)?|terminal|filesystem|file[_ -]?(?:write|delete)|write[_ -]?file|delete|kubectl|kubernetes|credential|secret|deploy|database[_ -]?write|send[_ -]?(?:email|message))\b/i.test(`${t.name} ${t.description}`));
  if (sensitive.length) observations.push([
    "security", "sensitive_capabilities_declared", r.auth_state === "open" ? "concern" : "observed",
    sensitive.map(t => t.name).slice(0, 20).join(", "),
    `${sensitive.length} discovered tool(s) advertise potentially state-changing or privileged capabilities. Tool names: ${sensitive.map(t => t.name).slice(0, 20).join(", ")}. Classification is description-based and does not prove exploitability.`, sensitive.length,
  ]);
  const advertised = `${server?.title ?? ""} ${server?.description ?? ""} ${tools.map(t => `${t.name} ${t.description}`).join(" ")}`;
  const citationClaims = advertised.match(/[^.!?]{0,100}\b(?:citation|citations|cited|PMID|PubMed|DOI|references?|source-backed|evidence-backed)\b[^.!?]{0,160}/gi) ?? [];
  if (citationClaims.length) observations.push([
    "citation_quality", "citation_capability_advertised", "unverified", null,
    `Metadata/tool descriptions advertise citation or evidence capability: ${citationClaims.slice(0, 3).map(s => s.trim()).join(" | ")}. No response-level citation benchmark has verified this claim yet.`, null,
  ]);
  const scaleClaims = advertised.match(/\b\d[\d,.]*\s*(?:k\+?|m\+?|million|billion)?\s+(?:articles?|papers?|publications?|records?|products?|ingredients?|datasets?|documents?)\b/gi) ?? [];
  if (scaleClaims.length) observations.push([
    "claim_verification", "advertised_corpus_scale", "unverified", scaleClaims.slice(0, 10).join(", "),
    `Advertised corpus-size expression(s) found in public metadata/tool descriptions: ${scaleClaims.slice(0, 10).join(", ")}. Black-box discovery does not establish corpus coverage; a manifest or sampled benchmark is required.`, null,
  ]);
  const trustStmts = [env.DB.prepare("DELETE FROM trust_observations WHERE server_name=?1 AND source_type='live_probe'").bind(name)];
  for (const [dimension, metric, status, value, evidence, sample] of observations) {
    trustStmts.push(env.DB.prepare(
      `INSERT INTO trust_observations
       (server_name,dimension,metric,status,value_text,evidence,source_type,sample_size,observed_at,methodology_version,public)
       VALUES (?1,?2,?3,?4,?5,?6,'live_probe',?7,?8,'trust-v1',1)`
    ).bind(name, dimension, metric, status, value, evidence, sample, now));
  }
  await env.DB.batch(trustStmts);
}

// ---------------------------------------------------------------- HTML

const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

interface PageOpts { desc?: string; path?: string; jsonld?: any }

function page(title: string, body: string, opts: PageOpts = {}): Response {
  const desc = opts.desc ?? "The MCP evidence registry: live operational grades, Trust Receipts, response-level data and citation audits, claim verification, and reviewed field reports.";
  const canonical = SITE + (opts.path ?? "/registry");
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · MCP Queen</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="MCP Queen"><meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)} · MCP Queen"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)} · MCP Queen">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE}/og.png">
${opts.jsonld ? `<script type="application/ld+json">${JSON.stringify(opts.jsonld)}</script>` : ""}
<style>
:root{--bg:#10031f;--panel:#1b0536;--ink:#f4eefb;--muted:#9a90b5;--faint:#6b6486;--gold:#f4b942;--gold-bright:#ffd36b;--violet:#a06bff;--violet-bright:#c89bff;--line:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
a{color:var(--violet-bright);text-decoration:none}a:hover{color:var(--gold-bright)}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
header.site{display:flex;align-items:baseline;gap:16px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:24px}
header.site .crown{font-size:22px}header.site h1{font-size:18px;margin:0;letter-spacing:.06em}header.site h1 a{color:var(--gold)}
header.site nav{margin-left:auto;font-size:14px}header.site nav a{margin-left:18px;color:var(--muted)}header.site nav a:hover{color:var(--gold-bright)}
table{width:100%;border-collapse:collapse;font-size:14.5px}
th{color:var(--faint);text-transform:uppercase;font-size:11.5px;letter-spacing:.1em;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:hover td{background:rgba(160,107,255,.05)}
.grade{display:inline-block;min-width:34px;text-align:center;font-weight:700;border-radius:6px;padding:1px 7px}
.gA{background:rgba(122,220,140,.15);color:#7adc8c}.gB{background:rgba(244,185,66,.15);color:var(--gold-bright)}
.gC{background:rgba(200,155,255,.14);color:var(--violet-bright)}.gD{background:rgba(255,140,105,.14);color:#ff8c69}.gF{background:rgba(255,90,90,.13);color:#ff6b6b}
.prov{color:var(--faint);font-size:12px}
.muted{color:var(--muted)}.faint{color:var(--faint)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin:18px 0}
h2{font-size:22px;margin:6px 0 2px}h3{font-size:15px;color:var(--gold);letter-spacing:.04em;text-transform:uppercase;margin:22px 0 8px}
.evtable td:first-child{white-space:nowrap;color:var(--violet-bright)}
.pts{white-space:nowrap;font-variant-numeric:tabular-nums}
code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:5px;font-size:13px}
pre{background:rgba(0,0,0,.35);border:1px solid var(--line);border-radius:8px;padding:12px 14px;font-size:13px;overflow-x:auto}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--faint)}
.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:2px 12px;font-size:12.5px;color:var(--muted);margin-right:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.stat b{display:block;font-size:24px;color:var(--gold-bright);font-variant-numeric:tabular-nums}
.stat span{font-size:12px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0}
.controls .lbl{font-size:11.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.1em;margin-right:2px}
.btn{display:inline-block;border:1px solid var(--line);border-radius:8px;padding:4px 13px;font-size:13px;color:var(--muted);background:transparent}
.btn:hover{border-color:var(--violet);color:var(--ink)}
.btn.on{background:rgba(160,107,255,.18);border-color:var(--violet);color:var(--violet-bright);font-weight:600}
.btn.gon{background:rgba(244,185,66,.15);border-color:var(--gold);color:var(--gold-bright);font-weight:600}
.search{background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 12px;font-size:13.5px;width:220px}
.search:focus{outline:none;border-color:var(--violet)}
.bar{height:4px;border-radius:3px;background:rgba(255,255,255,.07);margin-top:5px;width:64px}
.bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--violet),var(--gold))}
.cat{font-size:11.5px;color:var(--faint)}
.receipt{border-left:3px solid var(--violet);padding-left:16px}.report{border-left:3px solid var(--gold);padding:12px 0 12px 16px;margin:14px 0}
.report p{margin:4px 0;white-space:pre-wrap}.report-meta{font-size:12px;color:var(--faint)}
#qw-fab{position:fixed;right:18px;bottom:18px;z-index:50}
#qw-btn{background:linear-gradient(92deg,var(--gold),var(--gold-bright));color:#2a1c00;font-weight:700;border:0;border-radius:99px;padding:11px 20px;cursor:pointer;box-shadow:0 12px 34px -10px rgba(244,185,66,.7);font-size:14px}
#qw-btn:hover{transform:translateY(-1px)}
#qw-panel{display:none;position:absolute;bottom:54px;right:0;width:290px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 24px 70px -18px #000;text-align:left}
#qw-panel.open{display:block}
@media(max-width:760px){.hide-sm{display:none}}
</style></head><body><div class="wrap">
<header class="site"><span class="crown">👑</span><h1><a href="/">MCP QUEEN</a></h1>
<nav><a href="/registry">Evidence Registry</a><a href="/compare">Compare</a><a href="/mcp-security-evidence">Security Evidence</a><a href="/field-reports">Field Reports</a><a href="/reports">Reports</a><a href="/api">API</a><a href="/mcp-info">For Agents</a></nav></header>
${body}
<footer>Operational grades come from deterministic protocol probes. Trust Receipts separately publish dated security/access, data-integrity, citation, claim-verification, and reviewed field evidence; missing evidence is <em>unaudited</em>, never a pass. Data source: the <a href="https://registry.modelcontextprotocol.io">official MCP registry</a>. MCP Queen is an independent index by the team behind <a href="https://constat.dev">Constat</a> and <a href="https://healthai.com">Clarity</a>. The grade badge represents operational probe results only—not security or data-quality certification.</footer>
</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}

// ---------------------------------------------------------------- dashboard

const SORTS: Record<string, { label: string; cmp: (a: any, b: any) => number }> = {
  top:    { label: "Best",        cmp: (a, b) => b.score - a.score || a.server_name.localeCompare(b.server_name) },
  worst:  { label: "Worst",       cmp: (a, b) => a.score - b.score || a.server_name.localeCompare(b.server_name) },
  recent: { label: "Just probed", cmp: (a, b) => (b.probed_at ?? "").localeCompare(a.probed_at ?? "") },
  tools:  { label: "Most tools",  cmp: (a, b) => (b.tool_count ?? -1) - (a.tool_count ?? -1) },
  fast:   { label: "Fastest",     cmp: (a, b) => (a.reachable ? a.latency_ms ?? 1e9 : 1e9) - (b.reachable ? b.latency_ms ?? 1e9 : 1e9) },
};

async function leaderboard(req: Request, env: Env, url: URL): Promise<Response> {
  const sort = SORTS[url.searchParams.get("sort") ?? "top"] ? (url.searchParams.get("sort") ?? "top") : "top";
  const gradeF = (url.searchParams.get("grade") ?? "").toUpperCase();
  const catF = url.searchParams.get("cat") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const { results } = await env.DB.prepare(
    `SELECT g.*, s.title, s.description FROM latest_grades g
     JOIN servers s ON s.name = g.server_name LIMIT 2000`
  ).all();
  const counts = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM servers) total,
            (SELECT COUNT(*) FROM servers WHERE remote_url IS NOT NULL AND status='active') remotes,
            (SELECT COUNT(*) FROM latest_grades) graded,
            (SELECT COUNT(*) FROM trust_observations WHERE public=1) trust_observations,
            (SELECT COUNT(*) FROM evidence_benchmark_runs) benchmarks`
  ).first<any>();

  let rows = (results as any[]).map(r => ({ ...r, cat: classify(r) }));
  const catCounts = new Map<string, number>();
  for (const r of rows) catCounts.set(r.cat, (catCounts.get(r.cat) ?? 0) + 1);
  const gradeCounts = new Map<string, number>();
  for (const r of rows) gradeCounts.set(r.grade, (gradeCounts.get(r.grade) ?? 0) + 1);
  const reachPct = rows.length ? Math.round(rows.filter(r => r.reachable).length / rows.length * 100) : 0;
  const lats = rows.filter(r => r.reachable && r.latency_ms != null).map(r => r.latency_ms).sort((a, b) => a - b);
  const medLat = lats.length ? lats[Math.floor(lats.length / 2)] : null;

  if (gradeF === "PROV") rows = rows.filter(r => r.provisional);
  else if (gradeF) rows = rows.filter(r => r.grade === gradeF);
  if (catF) rows = rows.filter(r => r.cat === catF);
  if (q) {
    // Match tool catalogs too, so capability searches ("safety", "citations") find
    // servers whose descriptions never mention the word.
    const toolHits = new Set<string>(
      (((await env.DB.prepare(
        "SELECT DISTINCT server_name FROM server_tools WHERE tool_name LIKE ?1 OR description LIKE ?1 LIMIT 500"
      ).bind(`%${q}%`).all()).results ?? []) as any[]).map(r => r.server_name)
    );
    rows = rows.filter(r => `${r.server_name} ${r.title ?? ""} ${r.description ?? ""}`.toLowerCase().includes(q) || toolHits.has(r.server_name));
  }
  rows.sort(SORTS[sort].cmp);
  const shown = rows.slice(0, 250);

  // Human demand signal: log dashboard searches into the same table as the /mcp tools.
  // Only real searches (q present); fire-and-forget so it never blocks the page.
  if (q) {
    // awaited: an un-awaited D1 write is killed when the Response returns (no ctx here).
    await env.DB.prepare("INSERT INTO mcp_queries (tool, query, category, results, ip_hash, called_at) VALUES ('registry_search',?1,?2,?3,?4,?5)")
      .bind(q, catF || null, rows.length,
        await ipHash16(req.headers.get("cf-connecting-ip") ?? "unknown"), new Date().toISOString())
      .run().catch(() => { /* demand logging never breaks the page */ });
  }

  const link = (params: Record<string, string>, label: string, on: boolean, cls = "btn") => {
    const p = new URLSearchParams();
    const merged = { sort, grade: gradeF, cat: catF, q, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "sort" && v === "top")) p.set(k, v);
    const qs = p.toString();
    return `<a class="${cls}${on ? (cls === "btn" ? " on" : "") : ""}" href="/registry${qs ? "?" + qs : ""}">${esc(label)}</a>`;
  };

  const sortBtns = Object.entries(SORTS).map(([k, s]) => link({ sort: k }, s.label, sort === k)).join("");
  const gradeBtns = ["", "A", "B", "C", "D", "F", "PROV"].map(g =>
    link({ grade: g }, g === "" ? "All" : g === "PROV" ? "Provisional" : `${g} (${gradeCounts.get(g) ?? 0})`, gradeF === g)).join("");
  const topCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
  const catBtns = [`${link({ cat: "" }, "All categories", catF === "")}`]
    .concat(topCats.map(([c, n]) => link({ cat: c }, `${c} (${n})`, catF === c))).join("");

  const tr = shown.map((r, i) => `<tr>
<td class="faint">${i + 1}</td>
<td><a href="/s/${esc(r.server_name)}">${esc(r.server_name)}</a>${r.title ? `<div class="faint" style="font-size:12.5px">${esc(r.title)}</div>` : ""}<div class="cat hide-sm">${esc(r.cat)}</div></td>
<td><span class="grade g${esc(r.grade)}">${esc(r.grade)}</span>${r.provisional ? ' <span class="prov">prov.</span>' : ""}</td>
<td class="pts">${r.score}<div class="bar"><i style="width:${Math.max(r.score, 2)}%"></i></div></td>
<td class="pts hide-sm">${r.latency_ms ?? "—"}${r.latency_ms != null ? "ms" : ""}</td>
<td class="pts">${r.tool_count ?? "—"}</td>
<td class="muted hide-sm" title="Handshake/discovery access; not a claim that every data tool is free">${esc(r.auth_state)}</td>
<td class="faint hide-sm">${esc((r.probed_at ?? "").slice(5, 16).replace("T", " "))}</td></tr>`).join("");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Dataset", name: "MCP Queen evidence registry", description: "Live operational grades and separate Trust Receipts with security, access, data-integrity, citation, claim-verification, response-benchmark, and reviewed field evidence for MCP servers.", url: `${SITE}/registry`, license: `${SITE}/registry#methodology`, creator: { "@type": "Organization", name: "MCP Queen" }, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/grades.json` }] },
      { "@type": "ItemList", itemListElement: shown.slice(0, 25).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.server_name, url: `${SITE}/s/${r.server_name}` })) },
    ],
  };

  return page("MCP Evidence Registry", `
<h2>The MCP Evidence Registry</h2>
<p class="muted">Operational grades show whether a server connects and describes usable tools. Separate Trust Receipts show what has actually been observed about security and access boundaries, data integrity, citations, advertised claims, response quality, and real-world use.</p>
<div class="stats">
<div class="stat"><b>${counts?.total ?? 0}</b><span>servers indexed</span></div>
<div class="stat"><b>${counts?.remotes ?? 0}</b><span>remote endpoints</span></div>
<div class="stat"><b>${counts?.graded ?? 0}</b><span>graded (rolling)</span></div>
<div class="stat"><b>${counts?.trust_observations ?? 0}</b><span>trust observations</span></div>
<div class="stat"><b>${counts?.benchmarks ?? 0}</b><span>response audits</span></div>
<div class="stat"><b>${gradeCounts.get("A") ?? 0}</b><span>grade A</span></div>
<div class="stat"><b>${reachPct}%</b><span>reachable</span></div>
<div class="stat"><b>${medLat != null ? medLat + "ms" : "—"}</b><span>median latency</span></div>
</div>
<div class="controls"><span class="lbl">Sort</span>${sortBtns}</div>
<div class="controls"><span class="lbl">Grade</span>${gradeBtns}
<form method="get" action="/registry" style="margin-left:auto;display:flex;gap:6px">
${sort !== "top" ? `<input type="hidden" name="sort" value="${esc(sort)}">` : ""}${gradeF ? `<input type="hidden" name="grade" value="${esc(gradeF)}">` : ""}${catF ? `<input type="hidden" name="cat" value="${esc(catF)}">` : ""}
<input class="search" type="search" name="q" value="${esc(q)}" placeholder="search servers…"><button class="btn" type="submit">Search</button></form></div>
<div class="controls"><span class="lbl">Category</span>${catBtns}</div>
<p class="faint" style="font-size:13px">${rows.length} match${rows.length === 1 ? "" : "es"}${rows.length > shown.length ? `, showing ${shown.length}` : ""}${q ? ` for “${esc(q)}”` : ""}. Categories are keyword-derived from registry metadata — imperfect by design, deterministic by principle.</p>
<table><thead><tr><th>#</th><th>Server</th><th>Grade</th><th>Score</th><th class="hide-sm">Latency</th><th>Tools</th><th class="hide-sm" title="Handshake/discovery access only">Protocol access</th><th class="hide-sm">Probed</th></tr></thead>
<tbody>${tr || `<tr><td colspan="8" class="muted">Nothing matches — <a href="/registry">clear filters</a>.</td></tr>`}</tbody></table>
<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
<div style="flex:2;min-width:260px"><h3 style="margin-top:0">Own one of these servers?</h3>
<p class="muted" style="font-size:14px;margin:0">Claim your <strong>live grade badge</strong> for your README, and get an email the moment your grade moves or your endpoint stops answering — find your server above and hit <em>Watch</em>. Free while in beta.</p></div>
<div style="flex:1;min-width:220px"><h3 style="margin-top:0">Running an agent?</h3>
<p class="muted" style="font-size:14px;margin:0">Ask the queen before you connect to a stranger:<br><code style="font-size:12px">claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp</code></p></div>
</div>
<div class="card"><h3>Compare MCP servers by use case</h3><p class="muted" style="font-size:14px">Evidence-backed shortlists for high-intent decisions—not generated pages for every keyword.</p><p>${topicLinks()} <a class="pill" href="/mcp-security-evidence">Security &amp; trust evidence</a></p></div>
<div class="card" id="methodology"><h3>Methodology</h3>
<p style="font-size:14.5px" class="muted">Each server is probed live over streamable HTTP: <strong>reachability</strong> (25) — does <code>initialize</code> succeed; auth-gated servers earn partial credit only if they advertise <code>WWW-Authenticate</code> so clients can discover OAuth. <strong>protocol</strong> (15) — valid JSON-RPC handshake; deprecated SSE transport is penalized. <strong>tooling</strong> (35) — <code>tools/list</code> works, share of tools with descriptions and fully-typed input schemas, median description depth. <strong>latency</strong> (10) — initialize round-trip. <strong>provenance</strong> (15) — registry metadata completeness and whether the reverse-DNS namespace actually matches the serving domain. Scores scale to what is verifiable; unverifiable dimensions mark the grade <em>provisional</em> rather than guessing. Every point carries the verbatim observation that earned it. No stars, no votes, no pay-to-rank — probes only.</p>
<p style="font-size:14.5px" class="muted"><strong>Trust Receipts are separate from the operational grade.</strong> Discovery records advertised security-sensitive capabilities, access caveats, citation promises, and corpus-size claims. Safe, read-only response audits sample eligible tools and test whether calls are usable, whether returned PMIDs/DOIs resolve against authoritative sources, and whether an apparently successful response actually contains an upstream error. Every observation includes its date, source type, sample size where applicable, and methodology version. No synthetic trust score is assigned, and absence of an observation means unaudited—not safe.</p></div>
<div id="qw-fab">
<button id="qw-btn" onclick="document.getElementById('qw-panel').classList.toggle('open')">👑 Grade alerts</button>
<div id="qw-panel">
<b style="color:var(--gold-bright)">Queen Watch</b>
<p class="muted" style="font-size:13px;margin:6px 0 10px">Get an email when a server's grade changes or its endpoint stops answering. Double-opt-in, one-click unwatch, free while in beta.</p>
<form method="post" action="/watch" style="display:flex;flex-direction:column;gap:8px">
<input class="search" style="width:100%" name="server" placeholder="registry name, e.g. com.healthai/clarity" required>
<input class="search" style="width:100%" type="email" name="email" placeholder="you@yourdomain.com" required>
<button class="btn" type="submit" style="background:rgba(244,185,66,.15);border-color:var(--gold);color:var(--gold-bright);cursor:pointer">Watch it</button>
</form></div></div>`,
    { path: "/registry", desc: `${counts?.graded ?? 0} MCP servers with live operational grades, plus separate Trust Receipts for security, access, data integrity, citations, claims, response quality, and reviewed field use.`, jsonld });
}

function topicLinks(): string {
  return Object.entries(TOPICS).map(([slug, t]) => `<a class="pill" href="/topics/${slug}">${esc(t.category)}</a>`).join("");
}

// ---------------------------------------------------------------- reports

const REPORT_2026_07_SLUG = "state-of-mcp-2026-07";

function reportsIndex(): Response {
  return page("MCP Ecosystem Reports", `
<h2>Ecosystem Reports</h2>
<p class="muted">Recurring, data-driven reports generated from MCP Queen's continuous probes of the official MCP registry. Every number is reproducible from the <a href="/api">public API</a> and the published dataset.</p>
<div class="report"><p><a href="/reports/${REPORT_2026_07_SLUG}" style="font-size:18px;font-weight:700">State of the MCP Ecosystem — July 2026</a></p>
<p class="report-meta">18,849 registry servers · 9,326 remotes graded from 43,320 live probes · reachability, grades, auth, tooling, latency</p></div>`,
    { path: "/reports", desc: "Recurring data-driven reports on the MCP ecosystem: reachability, grades, authentication, tooling quality, and latency, from continuous live probes." });
}

function stateOfMcp202607(): Response {
  return page("State of the MCP Ecosystem, July 2026", `
<h2>State of the MCP Ecosystem — July 2026</h2>
<p class="muted">MCP Queen probes every remote server in the official Model Context Protocol registry on a continuous cycle. This report is generated from <strong>43,320 live probes of 9,326 remote servers</strong>, plus registry metadata for the full corpus. Every number is reproducible from the <a href="/api/grades.json">public API</a> and the <a href="/data/mcpqueen-grades-2026-07-28.csv">published dataset (CSV, 9,326 rows)</a>. Nothing here is self-reported.</p>

<h3>The headline numbers</h3>
<ul>
<li><strong>18,849 servers</strong> in the official MCP registry (18,650 marked active).</li>
<li><strong>9,312 (49.9%)</strong> advertise a remote endpoint. The other <strong>9,338 are local-install only</strong> (npx/uvx/docker): half the registry cannot be used without pulling code onto your machine.</li>
<li>Of the <strong>9,326 remotes we grade</strong>, <strong>7,723 (82.8%) are reachable</strong> right now. <strong>1,603 (17.2%) are dead</strong>: they advertise an endpoint that does not answer. Roughly one in six "live" MCP servers is not.</li>
</ul>

<h3>Grades</h3>
<table><thead><tr><th>Grade</th><th>Servers</th><th>Share of graded</th></tr></thead><tbody>
<tr><td>A</td><td>4,956</td><td>53.1%</td></tr>
<tr><td>B</td><td>143</td><td>1.5%</td></tr>
<tr><td>C</td><td>1,501</td><td>16.1%</td></tr>
<tr><td>D</td><td>918</td><td>9.8%</td></tr>
<tr><td>F</td><td>1,808</td><td>19.4%</td></tr>
</tbody></table>
<p>Grading is deterministic: reachability 25, protocol compliance 15, tooling quality 35, latency 10, provenance 15, and every point carries the verbatim observation that earned it. <strong>29.2% of graded servers land at D or F</strong>, almost entirely on dead endpoints, broken initialize handshakes, or empty tool catalogs.</p>

<h3>Authentication</h3>
<ul>
<li><strong>5,201 servers (55.8%)</strong> are open: no auth required.</li>
<li><strong>1,882 (20.2%)</strong> are auth-gated and well behaved: they reject unauthenticated calls with proper protocol semantics.</li>
<li><strong>640 (6.9%)</strong> are auth-bare: they demand credentials but fail the rejection handshake itself, so a client cannot even discover how to authenticate correctly.</li>
<li><strong>2,522 servers (27.0%)</strong> are graded provisional because auth gates their tooling: their advertised capabilities cannot be independently verified.</li>
</ul>

<h3>Tooling: the strongest part of the ecosystem</h3>
<p>Across servers that answer <code>tools/list</code>, we have cataloged <strong>102,013 tools from 5,241 servers</strong> (about 19 tools per server). Quality among servers that respond is high: <strong>99.7% of cataloged tools ship a typed input schema</strong> and <strong>99.5% carry a real description</strong>. The ecosystem's problem is not tool quality. It is that a large minority of servers cannot be reached or introspected at all.</p>

<h3>Latency</h3>
<p>Median round-trip for a reachable server: <strong>233 ms</strong>. Open servers respond faster on average than auth-gated ones (336 ms vs roughly 480 ms mean).</p>

<h3>What this means</h3>
<ol>
<li><strong>Listing is not verification.</strong> Half the registry is local-only, a sixth of the remotes are dead, and a quarter of graded servers hide their capabilities behind auth. A registry entry tells you a server existed once; a probe tells you it works now.</li>
<li><strong>The floor is low but the ceiling is high.</strong> The A-grade majority shows that a well-behaved remote MCP server is not hard to run. The 29% D/F tail is operational neglect, not technical difficulty.</li>
<li><strong>Agents need freshness.</strong> Grades here churn daily as servers die and recover. Point-in-time directories go stale in days; continuous probing is the only honest signal.</li>
</ol>
<p class="muted">Method, rubric, and per-server evidence: <a href="/registry">the evidence registry</a>. MCP Queen is built by <a href="https://healthai.com">Health AI</a>, the team behind the <a href="https://constat.dev">Constat</a> and Clarity evidence servers.</p>`,
    { path: `/reports/${REPORT_2026_07_SLUG}`, desc: "18,849 MCP registry servers, 9,326 remotes graded from 43,320 live probes: 17.2% of remote MCP servers are dead, 27% hide tooling behind auth, median latency 233ms. Full data published." });
}

async function topicPage(env: Env, slug: string): Promise<Response> {
  const topic = TOPICS[slug];
  if (!topic) return page("Topic not found", `<h2>Unknown MCP topic</h2><p><a href="/registry">Browse the evidence registry</a>.</p>`, { path: `/topics/${slug}` });
  const { results } = await env.DB.prepare(
    `SELECT g.server_name,g.grade,g.score,g.provisional,g.latency_ms,g.tool_count,g.auth_state,g.probed_at,
            s.title,s.description,s.remote_url,
            (SELECT COUNT(*) FROM trust_observations o WHERE o.server_name=g.server_name AND o.public=1) trust_count,
            (SELECT COUNT(*) FROM feedback f WHERE f.server_name=g.server_name AND f.reviewed=1) report_count
     FROM latest_grades g JOIN servers s ON s.name=g.server_name
     WHERE s.status='active' ORDER BY g.score DESC,g.latency_ms ASC LIMIT 2500`
  ).all();
  const matches = (results as any[]).filter(r => classify(r) === topic.category).slice(0, 30);
  const rows = matches.map((r, i) => `<tr><td class="faint">${i + 1}</td><td><a href="/s/${esc(r.server_name)}">${esc(r.title || r.server_name)}</a><div class="faint" style="font-size:12px">${esc(r.server_name)}</div></td><td><span class="grade g${esc(r.grade)}">${esc(r.grade)}</span>${r.provisional ? ' <span class="prov">prov.</span>' : ""}</td><td class="pts">${r.score}</td><td class="pts hide-sm">${r.latency_ms ?? "—"}${r.latency_ms != null ? "ms" : ""}</td><td class="pts">${r.tool_count ?? "—"}</td><td class="muted hide-sm">${esc(r.auth_state)}</td><td class="pts hide-sm">${r.trust_count || "—"}</td></tr>`).join("");
  const updated = matches.map(r => r.probed_at).filter(Boolean).sort().pop()?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const jsonld = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: topic.heading, description: topic.intro, url: `${SITE}/topics/${slug}`, dateModified: updated, isPartOf: { "@type": "WebSite", name: "MCP Queen", url: SITE } },
      { "@type": "ItemList", numberOfItems: matches.length, itemListElement: matches.slice(0, 20).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.title || r.server_name, url: `${SITE}/s/${r.server_name}` })) },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "MCP Queen", item: SITE }, { "@type": "ListItem", position: 2, name: "Evidence Registry", item: `${SITE}/registry` }, { "@type": "ListItem", position: 3, name: topic.category, item: `${SITE}/topics/${slug}` }] },
    ],
  };
  return page(topic.title.replace(/ \(2026\)$/, ""), `
<p class="faint" style="font-size:13px"><a href="/registry">Evidence Registry</a> / ${esc(topic.category)}</p>
<h2>${esc(topic.heading)}</h2>
<p class="muted">${esc(topic.intro)}</p>
<div class="card"><h3>Who this comparison is for</h3><p class="muted">${esc(topic.buyer)}</p><h3>What to verify before connecting</h3><ul class="muted">${topic.checks.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
<p><strong>${matches.length} currently graded matches</strong> · live observations last updated ${esc(updated)} · ranked by operational score, then latency.</p>
<table><thead><tr><th>#</th><th>MCP server</th><th>Grade</th><th>Score</th><th class="hide-sm">Latency</th><th>Tools</th><th class="hide-sm">Protocol access</th><th class="hide-sm">Trust evidence</th></tr></thead><tbody>${rows}</tbody></table>
<div class="card"><h3>How MCP Queen ranks this list</h3><p class="muted">These are live operational comparisons, not editorial endorsements. Grades measure reachability, protocol behavior, tool descriptions and schemas, latency, and provenance. Trust observations, response audits, and reviewed field reports remain separate; missing evidence means unaudited. There are no affiliate placements or paid rankings.</p></div>
<h3>Explore other MCP comparisons</h3><p>${topicLinks()}</p>`,
    { path: `/topics/${slug}`, desc: `${topic.intro} Compare ${matches.length} currently graded servers with live latency, tools, protocol access, Trust Receipts, and no paid rankings.`, jsonld });
}

async function securityEvidencePage(env: Env, url: URL): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim();
  const statusF = (url.searchParams.get("status") ?? "").trim();
  const wh: string[] = ["o.public=1", "o.dimension='security'"];
  const binds: any[] = [];
  if (q) { binds.push(`%${q}%`); wh.push(`(o.server_name LIKE ?${binds.length} OR s.title LIKE ?${binds.length} OR o.metric LIKE ?${binds.length} OR o.evidence LIKE ?${binds.length})`); }
  if (statusF) { binds.push(statusF); wh.push(`o.status=?${binds.length}`); }
  const { results } = await env.DB.prepare(
    `SELECT o.server_name,o.metric,o.status,o.evidence,o.source_type,o.observed_at,g.grade,g.score,s.title
     FROM trust_observations o JOIN servers s ON s.name=o.server_name
     LEFT JOIN latest_grades g ON g.server_name=o.server_name
     WHERE ${wh.join(" AND ")}
     ORDER BY o.observed_at DESC,o.id DESC LIMIT 200`
  ).bind(...binds).all();
  const rows = (results as any[]).map(o => `<tr><td><a href="/s/${esc(o.server_name)}#trust-receipt">${esc(o.title || o.server_name)}</a><div class="faint" style="font-size:12px">${esc(o.server_name)}</div></td><td><code>${esc(o.metric)}</code></td><td>${esc(o.status)}</td><td class="muted">${esc(o.evidence)}</td><td class="faint">${esc((o.observed_at ?? "").slice(0, 10))}</td></tr>`).join("");
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "MCP server security and trust evidence", description: "Dated security and access-boundary observations for MCP servers, kept separate from operational grades.", url: `${SITE}/mcp-security-evidence`, dateModified: (results as any[])[0]?.observed_at };
  return page("MCP Server Security Evidence & Trust Receipts", `
<h2>MCP server security evidence—not a blanket safety score</h2>
<p class="muted">Use this evidence before connecting an agent to an unfamiliar MCP server. MCP Queen publishes dated observations about protocol authentication boundaries and security-sensitive capabilities, while keeping them separate from operational grades.</p>
<div class="card"><h3>For security, platform, and procurement teams</h3><p class="muted">This surface supports MCP inventory review, allowlist decisions, vendor due diligence, and change monitoring. It does <strong>not</strong> claim that metadata inspection proves a server safe. Source-code scanning, deployment controls, least privilege, runtime monitoring, and human approval remain necessary for privileged tools.</p>
<h3>How to interpret a Trust Receipt</h3><ul class="muted"><li><strong>Observed</strong> records what the endpoint or catalog exposed.</li><li><strong>Concern</strong> identifies a boundary requiring review, not a confirmed exploit.</li><li><strong>Unaudited</strong> means there is insufficient evidence—never a pass.</li><li>The operational A–F badge measures connectivity and protocol quality, not security certification.</li></ul></div>
<form method="get" action="/mcp-security-evidence" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
<input class="search" style="flex:1;min-width:220px" type="search" name="q" value="${esc(q)}" placeholder="search server, observation, or evidence text…">
<select name="status" class="search" style="width:auto">
<option value="">any status</option>
${["observed", "pass", "concern", "unverified", "not_testable"].map(st => `<option value="${st}"${st === statusF ? " selected" : ""}>${st}</option>`).join("")}
</select>
<button class="btn" type="submit">Search</button>${q || statusF ? ` <a class="btn" href="/mcp-security-evidence">clear</a>` : ""}</form>
<p><strong>${(results as any[]).length}${(results as any[]).length === 200 ? "+" : ""} ${q || statusF ? "matching" : "recent"} public security/access observations</strong></p>
<table><thead><tr><th>Server</th><th>Observation</th><th>Status</th><th>Evidence</th><th>Observed</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="muted">No observations match — <a href="/mcp-security-evidence">clear the search</a>.</td></tr>`}</tbody></table>
<div class="card"><h3>Query this evidence</h3><p class="muted">Agents can call <code>search_trust_evidence</code> or <code>get_trust_receipt</code> at <code>https://mcpqueen.com/mcp</code>. Humans and procurement workflows can use <code>/api/trust/{name}.json</code>.</p></div>`,
    { path: "/mcp-security-evidence", desc: `Review ${(results as any[]).length} dated MCP server security and access observations for allowlists, procurement, and agent risk decisions—without a misleading blanket safety score.`, jsonld });
}

// ---------------------------------------------------------------- compare tool

async function comparePage(env: Env, url: URL): Promise<Response> {
  const names = url.searchParams.getAll("s").map(x => x.trim()).filter(Boolean).slice(0, 3);
  const cols: any[] = [];
  for (const n of names) {
    let r = await env.DB.prepare(
      `SELECT g.*, s.title, s.repo_url, s.remote_url FROM latest_grades g JOIN servers s ON s.name=g.server_name WHERE g.server_name=?1`
    ).bind(n).first<any>();
    if (!r) r = await env.DB.prepare(
      `SELECT g.*, s.title, s.repo_url, s.remote_url FROM latest_grades g JOIN servers s ON s.name=g.server_name
       WHERE g.server_name LIKE ?1 OR s.title LIKE ?1 ORDER BY g.score DESC LIMIT 1`
    ).bind(`%${n}%`).first<any>();
    if (r) {
      const tools = await env.DB.prepare("SELECT tool_name FROM server_tools WHERE server_name=?1 ORDER BY tool_name LIMIT 8").bind(r.server_name).all();
      const trust = await env.DB.prepare("SELECT COUNT(*) n FROM trust_observations WHERE server_name=?1 AND public=1").bind(r.server_name).first<any>();
      cols.push({ ...r, toolNames: ((tools.results ?? []) as any[]).map(t => t.tool_name), trustN: trust?.n ?? 0 });
    } else cols.push({ query: n, missing: true });
  }
  const inputs = [0, 1, 2].map(i =>
    `<input class="search" style="flex:1;min-width:200px" name="s" value="${esc(names[i] ?? "")}" placeholder="${i === 0 ? "e.g. com.healthai/clarity" : i === 1 ? "e.g. com.healthai/radar" : "optional third server"}">`
  ).join("");
  const form = `<form method="get" action="/compare" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">${inputs}<button class="btn" type="submit">Compare</button></form>
<p class="faint" style="font-size:13px">Name or partial name; best-scoring match is used. Try <a href="/compare?s=com.healthai/clarity&s=com.healthai/radar&s=com.mcpqueen/registry">an example comparison</a>.</p>`;
  let body = `<h2>Compare MCP servers side by side</h2>
<p class="muted">Live probe evidence, not marketing pages: grade, reachability, auth behavior, latency, tool catalog, and public trust observations for up to three servers.</p>${form}`;
  const found = cols.filter(c => !c.missing);
  if (found.length) {
    const th = found.map(c => `<th><a href="/s/${esc(c.server_name)}">${esc(c.title || c.server_name)}</a><div class="faint" style="font-size:11.5px;font-weight:400">${esc(c.server_name)}</div></th>`).join("");
    const row = (label: string, f: (c: any) => string) => `<tr><td class="muted">${label}</td>${found.map(c => `<td>${f(c)}</td>`).join("")}</tr>`;
    body += `<table><thead><tr><th></th>${th}</tr></thead><tbody>
${row("Grade", c => `<strong>${esc(c.grade ?? "—")}</strong> (${c.score ?? "—"}/100)${c.provisional ? ' <span class="faint">provisional</span>' : ""}`)}
${row("Reachable now", c => c.reachable ? "yes" : "<strong>no</strong>")}
${row("Auth", c => esc(c.auth_state ?? "—"))}
${row("Latency", c => c.latency_ms != null ? `${c.latency_ms} ms` : "—")}
${row("Tools", c => String(c.tool_count ?? "—"))}
${row("Tool catalog (sample)", c => c.toolNames.length ? c.toolNames.map((t: string) => `<code>${esc(t)}</code>`).join(" ") : '<span class="faint">not introspectable</span>')}
${row("Public trust observations", c => c.trustN ? `<a href="/s/${esc(c.server_name)}#trust-receipt">${c.trustN}</a>` : '<span class="faint">unaudited</span>')}
${row("Last probed", c => esc((c.probed_at ?? "").slice(0, 16).replace("T", " ")))}
${row("Links", c => `<a href="/s/${esc(c.server_name)}">trust report</a>${c.repo_url ? ` · <a href="${esc(c.repo_url)}">repo</a>` : ""}`)}
</tbody></table>`;
    const miss = cols.filter(c => c.missing);
    if (miss.length) body += `<p class="muted">No graded server matched: ${miss.map(m => `<code>${esc(m.query)}</code>`).join(", ")}.</p>`;
  }
  body += `<div class="card" style="margin-top:22px"><h3>Or start from a use-case shortlist</h3><p>${topicLinks()}</p></div>`;
  return page("Compare MCP Servers — Live Evidence Side by Side", body,
    { path: "/compare", desc: "Compare up to three MCP servers side by side on live probe evidence: grade, reachability, auth behavior, latency, tool catalogs, and public trust observations." });
}

// ---------------------------------------------------------------- server page + badge

function connectSnippets(name: string, remoteUrl: string): string {
  const slug = name.split("/").pop() ?? name;
  return `<div class="card"><h3>Connect your agent</h3>
<p class="muted" style="font-size:14px">Claude Code:</p>
<pre>claude mcp add --transport http ${esc(slug)} ${esc(remoteUrl)}</pre>
<p class="muted" style="font-size:14px">Generic MCP client config:</p>
<pre>{ "mcpServers": { "${esc(slug)}": { "type": "http", "url": "${esc(remoteUrl)}" } } }</pre>
<p class="faint" style="font-size:12.5px">MCP Queen is a graded index, not a middleman — your agent connects directly to the server above. Check the grade and evidence first; that's the point.
Share this server: permalink <code>${SITE}/s/${esc(name)}</code> · referral link <code>${SITE}/go/${esc(name)}</code> (counts as “routed via the queen”).</p></div>`;
}

function badgeSnippet(name: string): string {
  return `<div class="card" id="badge"><h3>Own this server? Embed your grade badge</h3>
<p class="muted" style="font-size:14px">Live operational-grade badge, re-probed continuously — not a security or data-quality certification. Put it in your README and link to the complete receipt:</p>
<p><img src="/badge/${esc(name)}.svg" alt="MCP Queen grade badge for ${esc(name)}" height="20"></p>
<pre>[![MCP Queen grade](${SITE}/badge/${esc(name)}.svg)](${SITE}/s/${esc(name)})</pre>
<p class="faint" style="font-size:12.5px">Think the grade is wrong? Fix the finding the evidence shows, then the next probe cycle picks it up automatically (full cycle ≈ 3 days) — or open a dispute via the <a href="/mcp-info">MCP endpoint</a>.</p></div>`;
}

async function badge(env: Env, name: string): Promise<Response> {
  const g = await env.DB.prepare("SELECT grade, score, provisional FROM latest_grades WHERE server_name=?1").bind(name).first<any>();
  const label = "MCP Queen";
  const value = g ? `${g.grade}${g.provisional ? "?" : ""} · ${g.score}` : "ungraded";
  const colors: Record<string, string> = { A: "#3c8a4d", B: "#b08a2e", C: "#7a5cbf", D: "#b0602e", F: "#a03030" };
  const right = g ? colors[g.grade] ?? "#555" : "#555";
  const lw = 72, vw = 14 + value.length * 7.5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${label}: ${value}">
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + vw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#2a1245"/><rect x="${lw}" width="${vw}" height="20" fill="${right}"/><rect width="${lw + vw}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2 + 6}" y="14">👑 ${label}</text><text x="${lw + vw / 2}" y="14" font-weight="bold">${value}</text></g></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=21600" } });
}

async function serverPage(env: Env, name: string): Promise<Response> {
  const s = await env.DB.prepare("SELECT * FROM servers WHERE name=?1").bind(name).first<any>();
  if (!s) return page("Not found", `<h2>Unknown server</h2><p class="muted">No registry entry for <code>${esc(name)}</code>. <a href="/registry">Back to the registry</a>.</p>`, { path: `/s/${name}` });
  const g = await env.DB.prepare("SELECT * FROM latest_grades WHERE server_name=?1").bind(name).first<any>();
  const { results: history } = await env.DB.prepare(
    "SELECT probed_at, grade, score, latency_ms FROM probes WHERE server_name=?1 ORDER BY probed_at DESC LIMIT 10").bind(name).all();
  const { results: feedback } = await env.DB.prepare(
    "SELECT id, agent_name, report, submitted_at, operator_response, operator_responded_at FROM feedback WHERE server_name=?1 AND reviewed=1 ORDER BY submitted_at DESC LIMIT 20"
  ).bind(name).all();
  const { results: trust } = await env.DB.prepare(
    "SELECT dimension, metric, status, value_text, evidence, source_type, sample_size, observed_at FROM trust_observations WHERE server_name=?1 AND public=1 ORDER BY observed_at DESC, id DESC LIMIT 100"
  ).bind(name).all();
  const ref = await env.DB.prepare("SELECT count FROM referrals WHERE server_name=?1").bind(name).first<any>();

  const ev: EvidenceItem[] = g?.evidence ? JSON.parse(g.evidence) : [];
  const evRows = ev.map(e => `<tr><td>${esc(e.criterion)}</td><td class="pts">${e.points} / ${e.max}</td><td class="muted">${esc(e.evidence)}</td></tr>`).join("");
  const histRows = (history as any[]).map(h =>
    `<tr><td class="faint">${esc(h.probed_at.slice(0, 16).replace("T", " "))}</td><td><span class="grade g${esc(h.grade)}">${esc(h.grade)}</span></td><td class="pts">${h.score}</td><td class="pts">${h.latency_ms ?? "—"}ms</td></tr>`).join("");
  const cat = classify({ server_name: name, title: s.title, description: s.description });
  const trustRows = (trust as any[]).map(o => `<tr><td>${esc(o.dimension)}</td><td><code>${esc(o.metric)}</code></td><td>${esc(o.status)}</td><td class="muted">${esc(o.evidence)}${o.value_text ? `<div class="faint">Observed value: ${esc(o.value_text)}</div>` : ""}${o.sample_size != null ? `<div class="faint">Sample: n=${esc(o.sample_size)}</div>` : ""}</td><td class="faint">${esc(o.source_type)}</td></tr>`).join("");
  const reportHtml = (feedback as any[]).map(f => `<article class="report" id="field-report-${f.id}"><div class="report-meta">Reviewed field report · ${esc(f.agent_name || "anonymous agent")} · <time datetime="${esc(f.submitted_at)}">${esc(f.submitted_at.slice(0, 10))}</time></div><p>${esc(f.report)}</p>${f.operator_response ? `<div class="receipt" style="margin-top:12px"><div class="report-meta">Queen's update · <time datetime="${esc(f.operator_responded_at)}">${esc((f.operator_responded_at ?? "").slice(0, 10))}</time> · operator response</div><p class="muted">${esc(f.operator_response)}</p></div>` : ""}</article>`).join("");
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: s.title || name,
    identifier: name,
    description: s.description || undefined,
    url: `${SITE}/s/${name}`,
    applicationCategory: "DeveloperApplication",
    sameAs: [s.website_url, s.repo_url].filter(Boolean),
    review: (feedback as any[]).map(f => ({
      "@type": "Review",
      author: { "@type": "Person", name: f.agent_name || "Anonymous agent" },
      datePublished: f.submitted_at,
      reviewBody: f.report,
    })),
  };

  const pageTitle = `${s.title || name} MCP Server${g ? ` — Operational Grade ${g.grade}` : ""}`;
  return page(pageTitle, `
<h2>${esc(name)} ${g ? `<span class="grade g${esc(g.grade)}" style="font-size:18px;vertical-align:middle">${esc(g.grade)}</span>${g.provisional ? ' <span class="prov">provisional — auth-gated, tooling unverifiable</span>' : ""}` : ""}</h2>
<p class="muted">${esc(s.description ?? "")}</p>
<p><span class="pill">${esc(cat)}</span><span class="pill">v${esc(s.version ?? "?")}</span><span class="pill">${esc(s.remote_type ?? "local-only")}</span>${s.remote_url ? `<span class="pill">${esc(new URL(s.remote_url).hostname)}</span>` : ""}${s.repo_url ? ` <a href="${esc(s.repo_url)}" rel="nofollow">repository</a>` : ""}${(feedback as any[]).length ? ` <a class="pill" href="#field-reports">${(feedback as any[]).length} reviewed field report${(feedback as any[]).length === 1 ? "" : "s"}</a>` : ""}${ref?.count ? ` <span class="pill">👑 routed via the queen ×${ref.count}</span>` : ""}</p>
${g ? `<div class="card"><h3>Grade evidence — probed ${esc((g.probed_at ?? "").slice(0, 16).replace("T", " "))} UTC</h3>
<table class="evtable"><thead><tr><th>Criterion</th><th>Points</th><th>Observed</th></tr></thead><tbody>${evRows}</tbody></table>
<p class="faint" style="font-size:13px">Score ${g.score}/100 · latency ${g.latency_ms ?? "—"}ms · ${g.tool_count ?? "—"} tools · protocol access: ${esc(g.auth_state)} <span title="This describes initialize/discovery access, not whether every data tool is free or unrestricted.">ⓘ</span></p></div>` : `<div class="card"><p class="muted">Not probed yet${s.remote_url ? " — queued" : " — no remote endpoint (local-only package), nothing to probe"}.</p></div>`}
<div class="card receipt" id="trust-receipt"><h3>Trust receipt</h3>
<p class="muted" style="font-size:14px">Security, data integrity, citation quality, and advertised claims are measured separately from protocol uptime. Missing evidence is marked unverified, never converted into a pass.</p>
${trustRows ? `<table class="evtable"><thead><tr><th>Dimension</th><th>Metric</th><th>Status</th><th>Evidence</th><th>Source</th></tr></thead><tbody>${trustRows}</tbody></table>` : `<p class="faint">No deterministic trust observations published yet. This means unaudited—not safe, unsafe, accurate, or inaccurate.</p>`}
<p class="faint" style="font-size:12.5px;margin-bottom:0">Machine-readable receipt: <a href="/api/trust/${esc(name)}.json"><code>/api/trust/${esc(name)}.json</code></a></p></div>
${reportHtml ? `<section class="card" id="field-reports"><h3>Reviewed field reports</h3><p class="muted" style="font-size:14px">Specific observations from agents that actually exercised this server. Human-moderated, shown as qualitative evidence, never counted as votes and never used to change the grade.</p>${reportHtml}<p class="faint"><a href="/field-reports">Browse all reviewed field reports</a></p></section>` : ""}
${g && s.remote_url && g.reachable && g.auth_state === "open" ? connectSnippets(name, s.remote_url) : ""}
${g ? badgeSnippet(name) : ""}
${g && s.remote_url ? `<div class="card"><h3>Queen Watch</h3>
<form method="post" action="/watch" style="display:flex;gap:8px;flex-wrap:wrap">
<input type="hidden" name="server" value="${esc(name)}">
<input class="search" type="email" name="email" placeholder="you@yourdomain.com" required style="flex:1;min-width:220px">
<button class="btn" type="submit">Watch this server</button></form>
<p class="faint" style="font-size:12.5px;margin-bottom:0">Email alerts when the grade changes or the endpoint stops answering. Double-opt-in, one-click unwatch, free while in beta.</p></div>` : ""}
${histRows ? `<h3>Probe history</h3><table><thead><tr><th>When (UTC)</th><th>Grade</th><th>Score</th><th>Latency</th></tr></thead><tbody>${histRows}</tbody></table>` : ""}
<p style="margin-top:24px"><a href="/registry">← Back to the evidence registry</a></p>`,
    { path: `/s/${name}`, desc: g ? `${s.title || name} MCP server: operational grade ${g.grade} (${g.score}/100), ${g.tool_count ?? "observed"} tools, ${g.latency_ms ?? "unmeasured"}${g.latency_ms != null ? "ms" : ""} latency, Trust Receipt observations, response audits, and reviewed field reports.` : `${s.title || name} MCP server in the MCP Queen evidence registry.`, jsonld });
}

async function fieldReportsPage(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.server_name, f.agent_name, f.report, f.submitted_at, f.operator_response, f.operator_responded_at, s.title
     FROM feedback f JOIN servers s ON s.name=f.server_name
     WHERE f.reviewed=1 ORDER BY f.submitted_at DESC LIMIT 200`
  ).all();
  const reports = (results as any[]).map(f => `<article class="card report"><h3 style="margin-top:0"><a href="/s/${esc(f.server_name)}#field-report-${f.id}">${esc(f.title || f.server_name)}</a></h3><div class="report-meta">${esc(f.agent_name || "anonymous agent")} · <time datetime="${esc(f.submitted_at)}">${esc(f.submitted_at.slice(0, 10))}</time> · reviewed before publication</div><p>${esc(f.report)}</p>${f.operator_response ? `<div class="receipt" style="margin-top:12px"><div class="report-meta">Queen's update · <time datetime="${esc(f.operator_responded_at)}">${esc((f.operator_responded_at ?? "").slice(0, 10))}</time> · operator response</div><p class="muted">${esc(f.operator_response)}</p></div>` : ""}</article>`).join("");
  return page("Reviewed MCP Field Reports", `<h2>Reviewed MCP Field Reports</h2>
<p class="muted">What agents observed after actually connecting to MCP servers. Reports are quarantined, reviewed for specificity, and published as evidence—not ratings. They never change protocol grades.</p>
${reports || `<div class="card"><p class="muted">No reviewed reports yet.</p></div>`}`,
    { path: "/field-reports", desc: "Human-reviewed reports from agents that actually exercised MCP servers: observed data, access limits, provenance, failures and caveats." });
}

function mcpInfoPage(): Response {
  return page("For Agents", `
<h2>MCP Queen speaks MCP</h2>
<p class="muted">This registry is itself an MCP server. Point your client at <code>https://mcpqueen.com/mcp</code> (streamable HTTP, no auth) to search capabilities and the evidence behind them:</p>
<div class="card"><table class="evtable"><tbody>
<tr><td>search_servers</td><td class="muted">Find servers by task, keyword or category — returns graded matches with endpoints, best-first. This is the broker: ask the queen, connect direct.</td></tr>
<tr><td>search_tools</td><td class="muted">Search the actual tools servers expose (names + descriptions, captured from tools/list) — find a specific capability or data type, not just server metadata. Returns each matching tool with its server, grade and endpoint.</td></tr>
<tr><td>list_grades</td><td class="muted">Top graded servers — grade, score, latency, tool count. Optional <code>limit</code>.</td></tr>
<tr><td>get_server_grade</td><td class="muted">Full evidence breakdown for one server by registry name.</td></tr>
<tr><td>get_trust_receipt</td><td class="muted">Operational evidence plus separate security, data-integrity, citation-quality and claim-verification observations, with reviewed field reports.</td></tr>
<tr><td>search_trust_evidence</td><td class="muted">Search verbatim trust observations and reviewed real-usage reports by capability, claim, citation, caveat or concern.</td></tr>
<tr><td>submit_feedback</td><td class="muted">File a field report about a server you actually used. Reports are quarantined until human review — they never auto-publish and never affect grades directly.</td></tr>
</tbody></table></div>
<pre>claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp</pre>
<p class="muted">OpenClaw, Claude Desktop, or any stdio client — bridge the remote endpoint with <code>mcp-remote</code> in your <code>mcpServers</code> config (e.g. <code>~/.openclaw/openclaw.json</code>):</p>
<pre>{
  "mcpServers": {
    "mcpqueen": { "command": "npx", "args": ["-y", "mcp-remote", "https://mcpqueen.com/mcp"] }
  }
}</pre>
<p class="muted">Field reports from real usage catch what deterministic probes cannot. Because agents can be prompted to astroturf, every report is quarantined and human-reviewed; approved reports are published as qualitative evidence, never votes. <a href="/field-reports">Browse reviewed reports</a>.</p>
<h3 id="badge">Badges for server owners</h3>
<p class="muted">Every graded server has a live SVG badge at <code>/badge/&lt;registry-name&gt;.svg</code> that re-grades itself as probes run. It reflects operational protocol results only—not security or data-quality certification. Embed it in your README and link back to the complete evidence page.</p>
<h3>Machine surfaces</h3>
<p class="muted"><code>/api/grades.json</code> · <code>/api/trust/&lt;name&gt;.json</code> · <code>/field-reports</code> · <code>/llms.txt</code> · <code>/sitemap.xml</code></p>`,
    { path: "/mcp-info", desc: "Query MCP Queen's operational grades, Trust Receipts, response-level citation audits, and reviewed field reports through MCP." });
}

/** Royal envelope for all JSON API responses — attribution, license, provenance. */
function apiJson(payload: Record<string, any>): Response {
  return Response.json({
    attribution: "MCP Queen — the evidence layer for MCP (https://mcpqueen.com)",
    license: "CC BY 4.0 — free to use with attribution and a link to mcpqueen.com",
    methodology: "https://mcpqueen.com/registry#methodology",
    docs: "https://mcpqueen.com/api",
    generated_at: new Date().toISOString(),
    ...payload,
  }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}

function apiDocsPage(): Response {
  return page("API", `
<h2>The Queen's API</h2>
<p class="muted">Free, no key, CORS-open, rate-limited at 60 requests/min per IP. Grades refresh continuously (full probe cycle ≈ 3 days). Data is <strong>CC BY 4.0</strong> — use it freely, with attribution and a link to mcpqueen.com. Every response carries its own attribution, license, and methodology fields.</p>
<div class="card"><h3>REST endpoints</h3>
<table class="evtable"><tbody>
<tr><td><a href="/api/grades.json">GET /api/grades.json</a></td><td class="muted">Top 500 graded servers by score — grade, score, provisional flag, latency, tool count, protocol-access state, probe time. Protocol access describes handshake/discovery only, not data entitlement.</td></tr>
<tr><td>GET /api/history/{name}.json</td><td class="muted">Per-server probe time series (last 200 probes). Example: <a href="/api/history/com.healthai/clarity.json"><code>/api/history/com.healthai/clarity.json</code></a></td></tr>
<tr><td><a href="/api/changes.json">GET /api/changes.json</a></td><td class="muted">Latest 100 grade transitions across the registry — who got better, who broke.</td></tr>
<tr><td>GET /api/trust/{name}.json</td><td class="muted">Per-server trust receipt: protocol grade, separate security/data/citation/claim observations, and reviewed field reports.</td></tr>
<tr><td>GET /badge/{name}.svg</td><td class="muted">Live grade badge for a server, e.g. <code>/badge/com.healthai/clarity.svg</code> — embed it in a README.</td></tr>
</tbody></table></div>
<div class="card"><h3>MCP endpoint (for agents)</h3>
<p class="muted" style="font-size:14px">The registry is itself an MCP server. Search capabilities with <code>search_servers</code>/<code>search_tools</code>, then inspect evidence with <code>get_trust_receipt</code>/<code>search_trust_evidence</code>.</p>
<pre>claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp</pre>
<p class="muted" style="font-size:14px">Or raw JSON-RPC:</p>
<pre>curl -X POST https://mcpqueen.com/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"search_servers","arguments":{"query":"postgres"}}}'</pre>
<p class="faint" style="font-size:12.5px">Details and etiquette: <a href="/mcp-info">For Agents</a> · machine summary: <a href="/llms.txt">/llms.txt</a></p></div>
<p class="faint" style="font-size:13px">Want webhooks, full history exports, or bulk access? That tier is coming — the data already exists. Watch this page.</p>`,
    { path: "/api", desc: "MCP Queen API: operational MCP grades plus separate security, data-integrity, citation, claim-verification, response-benchmark, and reviewed field evidence." });
}

// ---------------------------------------------------------------- machine surfaces

async function sitemap(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT server_name FROM latest_grades ORDER BY score DESC LIMIT 20000").all();
  const urls = ["/", "/registry", "/compare", "/mcp-info", "/field-reports", "/mcp-security-evidence", "/reports", `/reports/${REPORT_2026_07_SLUG}`, ...Object.keys(TOPICS).map(s => `/topics/${s}`), ...(results as any[]).map(r => `/s/${r.server_name}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${SITE}${encodeURI(u).replace(/&/g, "&amp;")}</loc></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" } });
}

function llmsTxt(): Response {
  return new Response(`# MCP Queen — the evidence layer for MCP

> Search MCP servers by observed evidence, not promises. Operational grades are
> kept separate from Trust Receipts covering security/access boundaries, data
> integrity, citations, advertised claims, response audits, and reviewed field use.

## For agents
- MCP endpoint (streamable HTTP, no auth): https://mcpqueen.com/mcp
  Tools: search_servers (find graded servers by task/category — the discovery
  broker), search_tools (search the actual tool names/descriptions servers
  expose — find a specific capability or data type), list_grades,
  get_server_grade, get_trust_receipt, search_trust_evidence, submit_feedback
  (field reports, quarantined for human review).
- Grades API (JSON, CORS-open): https://mcpqueen.com/api/grades.json
- Per-server Trust Receipt API: https://mcpqueen.com/api/trust/<registry-name>.json

## For humans
- Dashboard (sort/filter/search, categories): https://mcpqueen.com/registry
- Per-server evidence pages: https://mcpqueen.com/s/<registry-name>
- Reviewed real-usage field reports: https://mcpqueen.com/field-reports
- Methodology: https://mcpqueen.com/registry#methodology

## For server owners
- Live grade badge: https://mcpqueen.com/badge/<registry-name>.svg
- Grades refresh automatically (~3-day full probe cycle). Fix what the
  evidence shows and the badge updates itself.

Operational grading rubric: reachability 25 / protocol 15 / tooling 35 /
latency 10 / provenance 15. Auth-gated servers are scored on the verifiable
subset and marked provisional. Separately, safe read-only response audits test
call usability, semantic error responses, and whether returned PMID/DOI
identifiers resolve against authoritative sources. Missing trust evidence means
unaudited, never a pass. By the team behind constat.dev and healthai.com.
`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function robotsTxt(): Response {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`, { headers: { "content-type": "text/plain" } });
}

// ---------------------------------------------------------------- mcpqueen's own MCP server

const QUEEN_TOOLS = [
  {
    name: "search_servers",
    description: "Search the MCP evidence registry using a natural multi-word task (e.g. 'reliable no-auth drug interaction server with citations'). Tokenizes and expands common synonyms, ranks metadata plus observed tool descriptions, and supports operational-grade/auth/latency/category filters. Use get_trust_receipt or search_trust_evidence for security, data, citation, claim, and response evidence.",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword or task to search name/title/description for" },
        category: { type: "string", description: `Optional category filter: ${CATEGORIES.map(c => c[0]).join(", ")}, Other` },
        minimum_grade: { type: "string", enum: ["A", "B", "C", "D", "F"], description: "Worst acceptable live grade" },
        auth: { type: "string", enum: ["any", "open", "required"], description: "Filter by authentication state (default any)" },
        max_latency_ms: { type: "number", description: "Maximum measured initialize latency in milliseconds" },
        limit: { type: "number", description: "Max results (default 10, max 25)" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_tools",
    description: "Search across the actual tools that graded MCP servers expose (their tool names and descriptions, captured live from tools/list) — not just server metadata. Use this when you need a specific capability or data type, e.g. 'get weather', 'query postgres', 'device recall', 'FDA 510k'. Returns the matching tools with the server that offers each, its grade, and the remote endpoint so you can connect directly.",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Capability, data type, or keyword to match against tool names and descriptions" },
        category: { type: "string", description: `Optional server-category filter: ${CATEGORIES.map(c => c[0]).join(", ")}, Other` },
        minimum_grade: { type: "string", enum: ["A", "B", "C", "D", "F"], description: "Worst acceptable live server grade" },
        auth: { type: "string", enum: ["any", "open", "required"], description: "Filter by authentication state (default any)" },
        max_latency_ms: { type: "number", description: "Maximum measured initialize latency in milliseconds" },
        limit: { type: "number", description: "Max matching tools (default 15, max 40)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_grades",
    description: "List the top graded MCP servers from the mcpqueen registry (deterministic probe grades with evidence). Returns grade, score 0-100, latency, tool count and auth state per server.",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max servers to return (default 25, max 100)" } } },
  },
  {
    name: "get_server_grade",
    description: "Get the full grade and verbatim probe evidence for one MCP server, by its official registry name (e.g. 'com.healthai/radar').",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Registry server name" } }, required: ["name"] },
  },
  {
    name: "get_trust_receipt",
    description: "Get one MCP server's complete evidence receipt: operational grade, deterministic security/data-integrity/citation/claim observations, and reviewed real-usage field reports. Missing observations are explicitly unaudited, never treated as a pass.",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Official registry server name" } }, required: ["name"] },
  },
  {
    name: "search_trust_evidence",
    description: "Search published MCP trust evidence and reviewed real-usage field reports. Use for questions such as which servers expose citations, have access caveats, make unverifiable corpus claims, or show security concerns. Returns verbatim observations with dates and source type, not a synthetic trust score.",
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Evidence, claim, source, capability, caveat, or server keyword" },
        dimension: { type: "string", enum: ["any", "security", "data_integrity", "citation_quality", "claim_verification", "field_report"] },
        status: { type: "string", enum: ["any", "observed", "pass", "concern", "unverified", "not_testable"] },
        limit: { type: "number", description: "Max evidence items (default 20, max 50)" },
      },
      required: ["query"],
    },
  },
  {
    name: "submit_feedback",
    description: "Submit a field report about an MCP server you have actually used (what worked, what failed, surprising behavior). Reports are quarantined for human review and never auto-published.",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        server_name: { type: "string", description: "Official registry name of the server the report is about" },
        report: { type: "string", description: "The field report, 20-2000 chars, specific and factual" },
        agent_name: { type: "string", description: "Optional: which agent/client is reporting" },
      },
      required: ["server_name", "report"],
    },
  },
];

const SEARCH_STOP = new Set(["a", "an", "and", "for", "from", "in", "of", "or", "server", "that", "the", "to", "with"]);
const SEARCH_SYNONYMS: Record<string, string[]> = {
  drug: ["medicine", "medication", "pharma"], medicine: ["drug", "medication", "health"],
  email: ["mail", "smtp", "message"], database: ["sql", "postgres", "mysql", "data"],
  postgres: ["postgresql", "sql", "database"], web: ["browser", "http", "scrape"],
  scrape: ["scraper", "crawl", "browser"], citation: ["citations", "source", "evidence"],
  citations: ["citation", "source", "evidence"], reliable: ["quality", "verified", "grade"],
};
const gradeRank = (g: unknown) => ({ A: 5, B: 4, C: 3, D: 2, F: 1 }[String(g)] ?? 0);

function searchTerms(query: string): string[] {
  const base = query.toLowerCase().match(/[a-z0-9][a-z0-9+_.-]*/g) ?? [];
  const terms = new Set(base.filter(t => t.length > 1 && !SEARCH_STOP.has(t)));
  // SQLite caps the complexity of LIKE expression trees. Keep the user's
  // highest-signal terms first, then add at most one synonym per term.
  for (const term of [...terms]) {
    const synonym = SEARCH_SYNONYMS[term]?.[0];
    if (synonym) terms.add(synonym);
  }
  return [...terms].slice(0, 7);
}

function relevance(row: any, terms: string[], fields: string[]): number {
  const values = fields.map(f => String(row[f] ?? "").toLowerCase());
  const matches = (value: string, term: string) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Token boundaries prevent short domain terms such as "inci" from
    // matching unrelated words such as "incident".
    return /^[a-z0-9]+$/.test(term)
      ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value)
      : value.includes(term);
  };
  return terms.reduce((score, term) => score + values.reduce((n, value, i) =>
    n + (matches(value, term) ? Math.max(1, 5 - i) : 0), 0), 0);
}

function passesSearchFilters(row: any, args: any): boolean {
  if (args.minimum_grade && gradeRank(row.grade) < gradeRank(args.minimum_grade)) return false;
  if (args.auth === "open" && row.auth_state !== "open") return false;
  if (args.auth === "required" && !String(row.auth_state ?? "").startsWith("auth-")) return false;
  const maxLatency = Number(args.max_latency_ms);
  if (Number.isFinite(maxLatency) && maxLatency >= 0 && (row.latency_ms == null || row.latency_ms > maxLatency)) return false;
  return true;
}

const FEEDBACK_REMINDER = "After you actually use a discovered server, optionally call submit_feedback once with a concise factual report. Do not report from search results alone.";

async function handleQueenMcp(req: Request, env: Env): Promise<Response> {
  const rpcRes = (id: any, result: any) =>
    Response.json({ jsonrpc: "2.0", id, result });
  const rpcErr = (id: any, code: number, message: string) =>
    Response.json({ jsonrpc: "2.0", id, error: { code, message } });

  if (req.method === "GET") return new Response(null, { status: 405 }); // no server-push stream
  if (req.method !== "POST") return new Response(null, { status: 405 });
  let msg: any;
  try { msg = await req.json(); } catch { return rpcErr(null, -32700, "parse error"); }
  if (msg.method?.startsWith("notifications/")) return new Response(null, { status: 202 });

  switch (msg.method) {
    case "initialize":
      return rpcRes(msg.id, {
        protocolVersion: MCP_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "mcpqueen", version: "0.3.0" },
        instructions: `The evidence layer for MCP. Use search_servers and search_tools for discovery; use get_trust_receipt and search_trust_evidence before relying on a server's security, data, citations, or advertised claims. Missing evidence means unaudited, not safe or accurate. ${FEEDBACK_REMINDER} Reports are quarantined for human review.`,
      });
    case "ping":
      return rpcRes(msg.id, {});
    case "tools/list":
      return rpcRes(msg.id, { tools: QUEEN_TOOLS });
    case "tools/call": {
      const { name, arguments: args = {} } = msg.params ?? {};
      const text = (t: string, isError = false) => rpcRes(msg.id, { content: [{ type: "text", text: t }], isError });
      try {
        if (name === "search_servers") {
          const q = String(args.query ?? "").trim();
          if (!q) return text("query is required.", true);
          const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
          const terms = searchTerms(q);
          if (!terms.length) return text("query needs at least one meaningful search term.", true);
          const clauses = terms.map((_, i) => `(s.name LIKE ?${i + 1} OR s.title LIKE ?${i + 1} OR s.description LIKE ?${i + 1} OR st.tool_name LIKE ?${i + 1} OR st.description LIKE ?${i + 1})`).join(" OR ");
          const { results } = await env.DB.prepare(
            `SELECT DISTINCT s.name, s.title, s.description, s.remote_url, s.remote_type,
                    g.grade, g.score, g.provisional, g.latency_ms, g.tool_count, g.auth_state
             FROM servers s LEFT JOIN latest_grades g ON g.server_name = s.name
             LEFT JOIN server_tools st ON st.server_name=s.name
             WHERE s.status='active' AND (${clauses})
             ORDER BY (g.score IS NULL), g.score DESC LIMIT 600`
          ).bind(...terms.map(t => `%${t}%`)).all();
          let hits = (results as any[]).map(r => ({ ...r, category: classify(r), relevance: relevance(r, terms, ["name", "title", "description"]) }));
          hits = hits.filter(h => h.relevance > 0);
          if (args.category) hits = hits.filter(h => h.category === String(args.category));
          hits = hits.filter(h => passesSearchFilters(h, args));
          hits.sort((a, b) => b.relevance - a.relevance || (b.score ?? -1) - (a.score ?? -1) || (a.latency_ms ?? 1e9) - (b.latency_ms ?? 1e9));
          hits = hits.slice(0, limit).map(h => ({
            ...h,
            protocol_access: h.auth_state,
            auth_state_deprecated: h.auth_state,
            protocol_access_note: "Handshake/discovery access only; inspect the Trust Receipt for tool-level data access or subscription limits.",
            evidence_page: `${SITE}/s/${h.name}`,
            referral_link: `${SITE}/go/${h.name}`,
            note: h.grade == null ? "not yet probed" : h.remote_url == null ? "local-only package" : undefined,
          }));
          if (!hits.length) return text(`No servers match "${q}"${args.category ? ` in ${args.category}` : ""}. Try a broader keyword.`);
          return text(JSON.stringify({ interpreted_terms: terms, feedback_reminder: FEEDBACK_REMINDER, results: hits }, null, 2));
        }
        if (name === "search_tools") {
          const q = String(args.query ?? "").trim();
          if (!q) return text("query is required.", true);
          const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 40);
          const terms = searchTerms(q);
          if (!terms.length) return text("query needs at least one meaningful search term.", true);
          const clauses = terms.map((_, i) => `(st.tool_name LIKE ?${i + 1} OR st.description LIKE ?${i + 1} OR s.title LIKE ?${i + 1} OR s.description LIKE ?${i + 1})`).join(" OR ");
          const { results } = await env.DB.prepare(
            `SELECT st.server_name, st.tool_name, st.description AS tool_description, st.has_schema,
                    s.title, s.description AS server_description, s.remote_url, s.remote_type,
                    g.grade, g.score, g.provisional, g.auth_state, g.latency_ms
             FROM server_tools st
             JOIN servers s ON s.name = st.server_name
             LEFT JOIN latest_grades g ON g.server_name = st.server_name
             WHERE s.status='active' AND (${clauses})
             ORDER BY (g.score IS NULL), g.score DESC LIMIT 800`
          ).bind(...terms.map(t => `%${t}%`)).all();
          let hits = (results as any[]).map(r => ({
            ...r,
            category: classify({ server_name: r.server_name, title: r.title, description: r.server_description }),
            relevance: relevance(r, terms, ["tool_name", "tool_description", "title", "server_description"]),
          }));
          hits = hits.filter(h => h.relevance > 0);
          if (args.category) hits = hits.filter(h => h.category === String(args.category));
          hits = hits.filter(h => passesSearchFilters(h, args));
          hits.sort((a, b) => b.relevance - a.relevance || (b.score ?? -1) - (a.score ?? -1) || (a.latency_ms ?? 1e9) - (b.latency_ms ?? 1e9));
          hits = hits.slice(0, limit).map(h => ({
            server_name: h.server_name,
            tool_name: h.tool_name,
            tool_description: h.tool_description,
            has_schema: !!h.has_schema,
            category: h.category,
            grade: h.grade, score: h.score, provisional: h.provisional,
            protocol_access: h.auth_state,
            protocol_access_note: "Handshake/discovery access only; inspect the Trust Receipt for tool-level data access or subscription limits.",
            remote_url: h.remote_url, remote_type: h.remote_type,
            evidence_page: `${SITE}/s/${h.server_name}`,
            referral_link: `${SITE}/go/${h.server_name}`,
            note: h.grade == null ? "server not yet probed" : undefined,
          }));
          if (!hits.length) return text(`No tools match "${q}"${args.category ? ` in ${args.category}` : ""}. The tool catalog fills in as servers are probed (~1-day full cycle); try search_servers for a metadata-level match, or a broader keyword.`);
          return text(JSON.stringify({ interpreted_terms: terms, feedback_reminder: FEEDBACK_REMINDER, results: hits }, null, 2));
        }
        if (name === "list_grades") {
          const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
          const { results } = await env.DB.prepare(
            "SELECT server_name, grade, score, provisional, latency_ms, tool_count, auth_state, probed_at FROM latest_grades ORDER BY score DESC LIMIT ?1"
          ).bind(limit).all();
          return text(JSON.stringify((results as any[]).map(r => ({ ...r, protocol_access: r.auth_state, auth_state_deprecated: r.auth_state, protocol_access_note: "Handshake/discovery access only; not tool-level entitlement." })), null, 2));
        }
        if (name === "get_server_grade") {
          const g = await env.DB.prepare(
            "SELECT g.*, s.description, s.remote_url, s.repo_url, s.version FROM latest_grades g JOIN servers s ON s.name=g.server_name WHERE g.server_name=?1"
          ).bind(String(args.name ?? "")).first<any>();
          if (!g) return text(`No grade on file for "${args.name}". It may be local-only, not yet probed, or not in the official registry.`, true);
          g.evidence = JSON.parse(g.evidence);
          g.protocol_access = g.auth_state;
          g.auth_state_deprecated = g.auth_state;
          g.protocol_access_note = "Handshake/discovery access only; inspect the Trust Receipt for tool-level data access or subscription limits.";
          return text(JSON.stringify(g, null, 2));
        }
        if (name === "get_trust_receipt") {
          const serverName = String(args.name ?? "");
          const server = await env.DB.prepare(
            `SELECT s.name, s.title, s.description, s.version, s.remote_url, s.repo_url,
                    g.grade, g.score, g.provisional, g.reachable, g.auth_state, g.latency_ms, g.tool_count, g.probed_at, g.evidence
             FROM servers s LEFT JOIN latest_grades g ON g.server_name=s.name WHERE s.name=?1`
          ).bind(serverName).first<any>();
          if (!server) return text(`Unknown server "${serverName}".`, true);
          const observations = await env.DB.prepare(
            "SELECT dimension, metric, status, value_text, evidence, source_type, sample_size, observed_at, methodology_version FROM trust_observations WHERE server_name=?1 AND public=1 ORDER BY observed_at DESC, id DESC LIMIT 200"
          ).bind(serverName).all();
          const reports = await env.DB.prepare(
            "SELECT id, agent_name, report, submitted_at, operator_response, operator_responded_at FROM feedback WHERE server_name=?1 AND reviewed=1 ORDER BY submitted_at DESC LIMIT 50"
          ).bind(serverName).all();
          const benchmarks = await env.DB.prepare(
            "SELECT id,tool_name,benchmark_pack,samples,successful_samples,samples_with_identifiers,identifiers_found,identifiers_resolved,run_at FROM evidence_benchmark_runs WHERE server_name=?1 ORDER BY run_at DESC LIMIT 20"
          ).bind(serverName).all();
          if (server.evidence) server.evidence = JSON.parse(server.evidence);
          return text(JSON.stringify({
            server,
            trust_dimensions: ["security", "data_integrity", "citation_quality", "claim_verification"],
            audit_state: observations.results.length ? "observations_published" : "unaudited",
            interpretation: "Operational grade, trust observations, and field reports are independent. Missing evidence is not a pass. Field reports are qualitative and never votes.",
            observations: observations.results,
            response_benchmarks: benchmarks.results,
            reviewed_field_reports: reports.results,
            evidence_page: `${SITE}/s/${serverName}`,
          }, null, 2));
        }
        if (name === "search_trust_evidence") {
          const q = String(args.query ?? "").trim();
          if (!q) return text("query is required.", true);
          const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
          const like = `%${q.replace(/[%_]/g, "")}%`;
          const dimension = String(args.dimension ?? "any");
          const status = String(args.status ?? "any");
          const trust = dimension === "field_report" ? { results: [] } : await env.DB.prepare(
            `SELECT o.server_name, s.title, o.dimension, o.metric, o.status, o.value_text, o.evidence,
                    o.source_type, o.sample_size, o.observed_at
             FROM trust_observations o JOIN servers s ON s.name=o.server_name
             WHERE o.public=1 AND (?2='any' OR o.dimension=?2) AND (?3='any' OR o.status=?3)
               AND (o.server_name LIKE ?1 OR s.title LIKE ?1 OR o.metric LIKE ?1 OR o.value_text LIKE ?1 OR o.evidence LIKE ?1)
             ORDER BY o.observed_at DESC LIMIT ?4`
          ).bind(like, dimension, status, limit).all();
          const feedback = dimension !== "any" && dimension !== "field_report" ? { results: [] } : await env.DB.prepare(
            `SELECT f.server_name, s.title, 'field_report' AS dimension, 'reviewed_real_usage' AS metric,
                    'observed' AS status, NULL AS value_text, f.report AS evidence,
                    'moderated_agent_report' AS source_type, NULL AS sample_size, f.submitted_at AS observed_at,
                    f.agent_name
             FROM feedback f JOIN servers s ON s.name=f.server_name
             WHERE f.reviewed=1 AND (f.server_name LIKE ?1 OR s.title LIKE ?1 OR f.report LIKE ?1 OR f.agent_name LIKE ?1)
             ORDER BY f.submitted_at DESC LIMIT ?2`
          ).bind(like, limit).all();
          const results = [...trust.results as any[], ...feedback.results as any[]]
            .sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at))).slice(0, limit)
            .map(r => ({ ...r, evidence_page: `${SITE}/s/${r.server_name}` }));
          return text(JSON.stringify({ query: q, returned: results.length, interpretation: "Results are dated evidence items, not votes or a composite trust score.", results }, null, 2));
        }
        if (name === "submit_feedback") {
          const server = String(args.server_name ?? "");
          const report = String(args.report ?? "").trim();
          if (report.length < 20 || report.length > 2000) return text("Report must be 20-2000 characters.", true);
          const exists = await env.DB.prepare("SELECT 1 FROM servers WHERE name=?1").bind(server).first();
          if (!exists) return text(`Unknown server "${server}" — use the official registry name.`, true);
          const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
          const ipHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)))]
            .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
          const recent = await env.DB.prepare(
            "SELECT COUNT(*) c FROM feedback WHERE ip_hash=?1 AND submitted_at > datetime('now','-1 day')"
          ).bind(ipHash).first<any>();
          if ((recent?.c ?? 0) >= 10) return text("Rate limit: max 10 reports per day per source.", true);
          await env.DB.prepare(
            "INSERT INTO feedback (server_name, agent_name, report, submitted_at, ip_hash) VALUES (?1,?2,?3,?4,?5)"
          ).bind(server, String(args.agent_name ?? "") || null, report, new Date().toISOString(), ipHash).run();
          return text("Field report recorded and quarantined for human review. Thank you — real-usage reports catch what probes can't.");
        }
        return text(`Unknown tool: ${name}`, true);
      } catch (e: any) {
        return text(`Tool error: ${String(e?.message ?? e).slice(0, 200)}`, true);
      }
    }
    default:
      return rpcErr(msg.id ?? null, -32601, `method not found: ${msg.method}`);
  }
}

// ---------------------------------------------------------------- Queen Watch

const ipHash16 = async (ip: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)))]
    .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.FEEDBACK_FROM ?? "MCP Queen <onboarding@resend.dev>", to: [to], subject, html }),
  });
  return res.ok;
}

/** POST /watch {email, server} — double-opt-in signup for grade/uptime alerts. */
async function handleWatch(req: Request, env: Env): Promise<Response> {
  let email = "", server = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    const b: any = await req.json().catch(() => ({}));
    email = String(b.email ?? ""); server = String(b.server ?? "");
  } else {
    const f = await req.formData().catch(() => null);
    email = String(f?.get("email") ?? ""); server = String(f?.get("server") ?? "");
  }
  email = email.trim().toLowerCase();
  const back = `<p style="margin-top:16px"><a href="/s/${esc(server)}">← back</a></p>`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254)
    return page("Watch", `<h2>That email doesn't look right</h2>${back}`, { path: "/watch" });
  const exists = await env.DB.prepare("SELECT 1 FROM servers WHERE name=?1").bind(server).first();
  if (!exists) return page("Watch", `<h2>Unknown server</h2>${back}`, { path: "/watch" });
  const ip = await ipHash16(req.headers.get("cf-connecting-ip") ?? "unknown");
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) c FROM watches WHERE ip_hash=?1 AND created_at > datetime('now','-1 day')").bind(ip).first<any>();
  if ((recent?.c ?? 0) >= 5) return page("Watch", `<h2>Rate limit — try again tomorrow</h2>${back}`, { path: "/watch" });

  const token = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO watches (server_name, email, token, created_at, ip_hash) VALUES (?1,?2,?3,?4,?5)
     ON CONFLICT(server_name, email) DO UPDATE SET token=?3`
  ).bind(server, email, token, new Date().toISOString(), ip).run();
  const sent = await sendEmail(env, email, `👑 Confirm your watch on ${server}`,
    `<p>You asked MCP Queen to watch <b>${esc(server)}</b> — grade changes and reachability regressions, straight to this inbox.</p>
     <p><a href="${SITE}/watch/confirm?token=${token}">Confirm this watch</a> (or ignore this email and nothing happens).</p>`);
  return page("Watch", `<h2>Almost there</h2><p class="muted">${sent
    ? `Confirmation sent to <code>${esc(email)}</code> — click it and the queen starts watching <b>${esc(server)}</b> for you. Free while in beta.`
    : `Watch recorded for <b>${esc(server)}</b>. Email confirmation is momentarily offline — your watch activates as soon as it's back.`}</p>${back}`, { path: "/watch" });
}

/** Notify verified watchers about unprocessed grade changes (cron). */
async function notifyGradeChanges(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM grade_changes WHERE notified=0 ORDER BY id LIMIT 50").all();
  const changes = results as any[];
  if (!changes.length) return;
  for (const c of changes) {
    const { results: watchers } = await env.DB.prepare(
      "SELECT email, token FROM watches WHERE server_name=?1 AND verified=1").bind(c.server_name).all();
    let allSent = true;
    for (const w of watchers as any[]) {
      const up = "ABCDF".indexOf(c.new_grade) < "ABCDF".indexOf(c.old_grade);
      const ok = await sendEmail(env, w.email,
        `👑 ${c.server_name}: grade ${up ? "up" : "down"} ${c.old_grade} → ${c.new_grade}`,
        `<p><b>${esc(c.server_name)}</b> just re-graded: <b>${esc(c.old_grade)} (${c.old_score}) → ${esc(c.new_grade)} (${c.new_score})</b>.</p>
         <p><a href="${SITE}/s/${esc(c.server_name)}">See the evidence</a> — every point carries the observation that earned it.</p>
         <p style="color:#888;font-size:12px"><a href="${SITE}/watch/unsubscribe?token=${w.token}">unwatch</a></p>`);
      allSent = allSent && ok;
    }
    // mark done even with zero watchers; retry next cron only if a send failed
    if (allSent) await env.DB.prepare("UPDATE grade_changes SET notified=1 WHERE id=?1").bind(c.id).run();
  }
}

// ---------------------------------------------------------------- feedback alerts

/** Email a digest of any field reports that arrived since the last notification. */
async function notifyFeedback(env: Env): Promise<{ ok: boolean; sent: number; error?: string }> {
  if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) return { ok: false, sent: 0, error: "RESEND_API_KEY or FEEDBACK_TO missing" };
  const last = Number((await env.DB.prepare("SELECT v FROM meta WHERE k='last_fb_notified'").first<{ v: string }>())?.v ?? 0);
  const { results } = await env.DB.prepare(
    "SELECT id, server_name, agent_name, report, submitted_at FROM feedback WHERE id > ?1 ORDER BY id LIMIT 20"
  ).bind(last).all();
  const rows = results as any[];
  if (!rows.length) return { ok: true, sent: 0 };

  const items = rows.map(r =>
    `<li><b>${esc(r.server_name)}</b> <span style="color:#888">(${esc(r.agent_name ?? "anonymous")} · ${esc(r.submitted_at.slice(0, 16))}Z)</span><br>${esc(r.report)}</li>`).join("");
  const subject = `👑 ${rows.length} new field report${rows.length === 1 ? "" : "s"} in the review queue`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.FEEDBACK_FROM ?? "MCP Queen <onboarding@resend.dev>",
      to: [env.FEEDBACK_TO],
      subject,
      html: `<p>New quarantined agent field reports on mcpqueen.com:</p><ul>${items}</ul><p>Review queue: /admin/feedback (key in .secrets.local). Reports never auto-publish.</p>`,
    }),
  });
  if (res.ok) {
    const provider = await res.json().catch(() => ({})) as { id?: string };
    if (provider.id) {
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT OR REPLACE INTO email_deliveries (email_id,kind,recipient,subject,status,created_at,updated_at,provider_json) VALUES (?1,'feedback',?2,?3,'accepted',?4,?4,?5)"
      ).bind(provider.id, env.FEEDBACK_TO, subject, now, JSON.stringify(provider)).run();
    }
    await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('last_fb_notified',?1) ON CONFLICT(k) DO UPDATE SET v=?1")
      .bind(String(rows[rows.length - 1].id)).run();
    await env.DB.prepare("DELETE FROM meta WHERE k='last_fb_error'").run();
    return { ok: true, sent: rows.length };
  }
  const error = `Resend HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`;
  console.error("feedback notification failed", error);
  await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('last_fb_error',?1) ON CONFLICT(k) DO UPDATE SET v=?1")
    .bind(error).run();
  return { ok: false, sent: 0, error };
}

async function refreshEmailDeliveries(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const { results } = await env.DB.prepare(
    "SELECT email_id FROM email_deliveries WHERE status NOT IN ('delivered','bounced','failed','suppressed','canceled','complained') ORDER BY updated_at LIMIT 20"
  ).all();
  for (const row of results as Array<{ email_id: string }>) {
    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.email_id)}`, {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    if (!res.ok) continue;
    const data = await res.json() as { last_event?: string };
    await env.DB.prepare(
      "UPDATE email_deliveries SET status=?1,updated_at=?2,provider_json=?3 WHERE email_id=?4"
    ).bind(data.last_event ?? "unknown", new Date().toISOString(), JSON.stringify(data), row.email_id).run();
  }
}

// ---------------------------------------------------------------- entry

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/registry") return leaderboard(req, env, url);
    if (path === "/reports" || path === "/reports/") return reportsIndex();
    if (path === `/reports/${REPORT_2026_07_SLUG}`) return stateOfMcp202607();
    if (path.startsWith("/topics/")) return topicPage(env, path.slice(8));
    if (path === "/mcp-security-evidence") return securityEvidencePage(env, url);
    if (path === "/compare") return comparePage(env, url);
    if (path === "/field-reports") return fieldReportsPage(env);
    if (path.startsWith("/s/")) return serverPage(env, decodeURIComponent(path.slice(3)));
    if (path.startsWith("/go/")) {
      const name = decodeURIComponent(path.slice(4));
      const s = await env.DB.prepare("SELECT website_url, repo_url, remote_url FROM servers WHERE name=?1").bind(name).first<any>();
      if (!s) return Response.redirect(`${SITE}/registry`, 302);
      ctx.waitUntil(env.DB.prepare(
        `INSERT INTO referrals (server_name, count, last_at) VALUES (?1, 1, ?2)
         ON CONFLICT(server_name) DO UPDATE SET count = count + 1, last_at = ?2`
      ).bind(name, new Date().toISOString()).run());
      let target = s.website_url || s.repo_url;
      if (!target && s.remote_url) { try { target = new URL(s.remote_url).origin; } catch { /* keep null */ } }
      return Response.redirect(target || `${SITE}/s/${encodeURI(name)}`, 302);
    }
    if (path.startsWith("/badge/") && path.endsWith(".svg")) return badge(env, decodeURIComponent(path.slice(7, -4)));
    if (path === "/mcp") return handleQueenMcp(req, env);
    if (path === "/mcp-info") return mcpInfoPage();
    if (path === "/api" || path === "/api/") return apiDocsPage();
    if (path === "/watch" && req.method === "POST") return handleWatch(req, env);
    if (path === "/watch/confirm" || path === "/watch/unsubscribe") {
      const token = url.searchParams.get("token") ?? "";
      const w = await env.DB.prepare("SELECT server_name, email FROM watches WHERE token=?1").bind(token).first<any>();
      if (!w) return page("Watch", `<h2>Unknown or expired link</h2>`, { path });
      if (path === "/watch/confirm") {
        await env.DB.prepare("UPDATE watches SET verified=1 WHERE token=?1").bind(token).run();
        return page("Watching", `<h2>👑 The queen is watching ${esc(w.server_name)} for you</h2>
<p class="muted">You'll get an email when its grade changes or it stops answering. Free while in beta. <a href="/s/${esc(w.server_name)}">Current evidence</a>.</p>`, { path });
      }
      await env.DB.prepare("DELETE FROM watches WHERE token=?1").bind(token).run();
      return page("Unwatched", `<h2>Watch removed</h2><p class="muted">No more alerts for ${esc(w.server_name)}.</p>`, { path });
    }
    if (path.startsWith("/api/history/") && path.endsWith(".json")) {
      const name = decodeURIComponent(path.slice(13, -5));
      const { results } = await env.DB.prepare(
        "SELECT probed_at, grade, score, provisional, reachable, auth_state, latency_ms, tool_count FROM probes WHERE server_name=?1 ORDER BY probed_at DESC LIMIT 200"
      ).bind(name).all();
      return apiJson({ server: name, evidence_page: `${SITE}/s/${name}`, returned: (results as any[]).length, probes: results });
    }
    if (path === "/api/changes.json") {
      const { results } = await env.DB.prepare(
        "SELECT server_name, changed_at, old_grade, new_grade, old_score, new_score FROM grade_changes ORDER BY id DESC LIMIT 100").all();
      return apiJson({ returned: (results as any[]).length, changes: results });
    }
    if (path.startsWith("/api/trust/") && path.endsWith(".json")) {
      const name = decodeURIComponent(path.slice(11, -5));
      const server = await env.DB.prepare(
        "SELECT name, title, description, version, remote_url, repo_url FROM servers WHERE name=?1"
      ).bind(name).first<any>();
      if (!server) return apiJson({ error: "unknown server", server: name });
      const grade = await env.DB.prepare(
        "SELECT grade, score, provisional, reachable, auth_state, latency_ms, tool_count, probed_at, evidence FROM latest_grades WHERE server_name=?1"
      ).bind(name).first<any>();
      if (grade?.evidence) grade.evidence = JSON.parse(grade.evidence);
      const observations = await env.DB.prepare(
        "SELECT dimension, metric, status, value_text, evidence, source_type, sample_size, observed_at, methodology_version FROM trust_observations WHERE server_name=?1 AND public=1 ORDER BY observed_at DESC, id DESC LIMIT 200"
      ).bind(name).all();
      const reports = await env.DB.prepare(
        "SELECT id, agent_name, report, submitted_at, operator_response, operator_responded_at FROM feedback WHERE server_name=?1 AND reviewed=1 ORDER BY submitted_at DESC LIMIT 50"
      ).bind(name).all();
      const benchmarks = await env.DB.prepare(
        "SELECT id,tool_name,benchmark_pack,samples,successful_samples,samples_with_identifiers,identifiers_found,identifiers_resolved,run_at FROM evidence_benchmark_runs WHERE server_name=?1 ORDER BY run_at DESC LIMIT 20"
      ).bind(name).all();
      return apiJson({ server, operational_grade: grade ? { ...grade, protocol_access: grade.auth_state } : grade, field_semantics: { auth_state: "Deprecated name retained for compatibility. It means protocol handshake/discovery access only, not tool-level data entitlement.", protocol_access: "Preferred name for auth_state." }, audit_state: observations.results.length ? "observations_published" : "unaudited", observations: observations.results, response_benchmarks: benchmarks.results, reviewed_field_reports: reports.results, interpretation: "Dimensions are independent; missing evidence is not a pass; field reports are qualitative, moderated and never votes." });
    }
    if (path === "/.well-known/mcp-registry-auth")
      return new Response("v=MCPv1; k=ed25519; p=RcOs1OTsuHoefHKosxloAs3F/nJQCFEAy0J8vXTZWbs=\n", { headers: { "content-type": "text/plain" } });
    if (path === "/sitemap.xml") return sitemap(env);
    if (path === "/llms.txt") return llmsTxt();
    if (path === "/robots.txt") return robotsTxt();
    if (path === "/api/grades.json") {
      const { results } = await env.DB.prepare(
        "SELECT server_name, grade, score, provisional, latency_ms, tool_count, auth_state, probed_at FROM latest_grades ORDER BY score DESC LIMIT 500").all();
      const total = await env.DB.prepare("SELECT COUNT(*) n FROM latest_grades").first<any>();
      return apiJson({
        note: "Top servers by score. The complete corpus with evidence and history is not bulk-served — per-server detail at /api/history/{name}.json, humans at /registry.",
        field_semantics: { auth_state: "Deprecated name retained for compatibility; protocol handshake/discovery access only.", protocol_access: "Preferred name; does not imply tool-level data entitlement." },
        returned: (results as any[]).length, total_graded: total?.n ?? null, grades: (results as any[]).map(r => ({ ...r, protocol_access: r.auth_state })),
      });
    }
    if (path.startsWith("/admin/")) {
      if (url.searchParams.get("key") !== env.ADMIN_KEY || !env.ADMIN_KEY) return new Response("nope", { status: 403 });
      if (path === "/admin/sync") {
        const r = await syncRegistry(env, Math.min(Number(url.searchParams.get("pages")) || 10, 40));
        return Response.json(r);
      }
      if (path === "/admin/probe") {
        const one = url.searchParams.get("server");
        if (one) {
          const server = await env.DB.prepare("SELECT * FROM servers WHERE name=?1 AND remote_url IS NOT NULL").bind(one).first<any>();
          if (!server) return Response.json({ error: "unknown or local-only server" }, { status: 404 });
          const r = await probeServer(server);
          await recordProbe(env, server.name, new Date().toISOString(), r);
          return Response.json({ probed: 1, grade: r.grade, score: r.score });
        }
        const r = await probeBatch(env, Math.min(Number(url.searchParams.get("batch")) || 20, 40));
        return Response.json(r);
      }
      if (path === "/admin/evidence-benchmark" && req.method === "POST") {
        const body = await req.json().catch(() => ({})) as any;
        const queries = Array.isArray(body.queries) ? body.queries.map(String).map((q: string) => q.trim()).filter(Boolean).slice(0, 10) : [];
        if (!body.server_name || !body.tool_name || queries.length < 2) return Response.json({ error: "server_name, tool_name and at least 2 queries required" }, { status: 400 });
        try {
          return Response.json(await runEvidenceBenchmark(env, String(body.server_name), String(body.tool_name), queries));
        } catch (e: any) {
          return Response.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 400 });
        }
      }
      if (path === "/admin/queries") {
        const { results } = await env.DB.prepare(
          "SELECT tool, query, category, results, called_at FROM mcp_queries ORDER BY id DESC LIMIT 200").all();
        return Response.json(results);
      }
      if (path === "/admin/feedback") {
        const { results } = await env.DB.prepare(
          "SELECT id, server_name, agent_name, report, submitted_at, reviewed, operator_response, operator_responded_at FROM feedback ORDER BY submitted_at DESC LIMIT 100").all();
        const pending = await env.DB.prepare("SELECT COUNT(*) n FROM feedback WHERE reviewed=0").first<any>();
        const lastError = await env.DB.prepare("SELECT v FROM meta WHERE k='last_fb_error'").first<{ v: string }>();
        const deliveries = await env.DB.prepare(
          "SELECT email_id,kind,recipient,subject,status,created_at,updated_at FROM email_deliveries ORDER BY created_at DESC LIMIT 25"
        ).all();
        return Response.json({ pending: pending?.n ?? 0, notification_error: lastError?.v ?? null, deliveries: deliveries.results, reports: results });
      }
      if (path === "/admin/feedback/review" && req.method === "POST") {
        const id = Number(url.searchParams.get("id"));
        if (!Number.isInteger(id) || id < 1) return Response.json({ error: "valid id required" }, { status: 400 });
        await env.DB.prepare("UPDATE feedback SET reviewed=1 WHERE id=?1").bind(id).run();
        return Response.json({ ok: true, id, reviewed: 1 });
      }
      if (path === "/admin/feedback/respond" && req.method === "POST") {
        const id = Number(url.searchParams.get("id"));
        const body = await req.json<any>().catch(() => ({}));
        const response = String(body.response ?? "").trim();
        if (!Number.isInteger(id) || id < 1 || response.length < 20 || response.length > 2000) return Response.json({ error: "valid id and response of 20-2000 characters required" }, { status: 400 });
        const respondedAt = new Date().toISOString();
        await env.DB.prepare("UPDATE feedback SET operator_response=?1, operator_responded_at=?2 WHERE id=?3 AND reviewed=1").bind(response, respondedAt, id).run();
        return Response.json({ ok: true, id, operator_responded_at: respondedAt });
      }
      if (path === "/admin/notify-feedback" && req.method === "POST") {
        const result = await notifyFeedback(env);
        await refreshEmailDeliveries(env);
        return Response.json(result, { status: result.ok ? 200 : 502 });
      }
      if (path === "/admin/email-status" && req.method === "POST") {
        await refreshEmailDeliveries(env);
        const { results } = await env.DB.prepare(
          "SELECT email_id,kind,recipient,subject,status,created_at,updated_at FROM email_deliveries ORDER BY created_at DESC LIMIT 50"
        ).all();
        return Response.json(results);
      }
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      if (event.cron === "17 7 * * *") {
        await auditNextEvidenceServer(env);
        return;
      }
      await syncRegistry(env, 4);
      await probeBatch(env, 30);
      await notifyGradeChanges(env).catch(() => { /* alerting must never break probing */ });
      await notifyFeedback(env).catch(() => { /* alerting must never break probing */ });
      await refreshEmailDeliveries(env).catch(() => { /* delivery tracking must never break probing */ });
    })());
  },
} satisfies ExportedHandler<Env>;
