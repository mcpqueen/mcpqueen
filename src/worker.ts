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
const UA = "mcpqueen-grader/0.2 (+https://mcpqueen.com)";
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

function classify(r: { server_name?: string; name?: string; title?: string; description?: string }): string {
  const text = `${r.server_name ?? r.name ?? ""} ${r.title ?? ""} ${r.description ?? ""}`;
  for (const [cat, re] of CATEGORIES) if (re.test(text)) return cat;
  return "Other";
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

function namespaceDomain(name: string): string {
  // "com.healthai/radar" -> "healthai.com"; "io.github.foo/x" -> "foo.github.io"
  return (name.split("/")[0] ?? "").split(".").reverse().join(".").toLowerCase();
}

async function probeServer(server: any): Promise<{
  grade: string; score: number; provisional: number; reachable: number;
  auth_state: string; latency_ms: number | null; tool_count: number | null;
  evidence: EvidenceItem[];
}> {
  const ev: EvidenceItem[] = [];
  const url: string = server.remote_url;
  let reachable = 0, authState = "unreachable", latency: number | null = null;
  let toolCount: number | null = null, provisional = 0;
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
        const withDesc = tools.filter(t => (t.description ?? "").trim().length > 0).length;
        const typed = tools.filter(t => {
          const props = t.inputSchema?.properties ?? {};
          const keys = Object.keys(props);
          return keys.length === 0 || keys.every(k => props[k]?.type || props[k]?.anyOf || props[k]?.oneOf || props[k]?.$ref);
        }).length;
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
  return { grade, score, provisional, reachable, auth_state: authState, latency_ms: latency, tool_count: toolCount, evidence: ev };
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
}

// ---------------------------------------------------------------- HTML

const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

interface PageOpts { desc?: string; path?: string; jsonld?: any }

function page(title: string, body: string, opts: PageOpts = {}): Response {
  const desc = opts.desc ?? "The graded MCP registry — every server in the official MCP registry probed live and graded with verbatim evidence.";
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
#qw-fab{position:fixed;right:18px;bottom:18px;z-index:50}
#qw-btn{background:linear-gradient(92deg,var(--gold),var(--gold-bright));color:#2a1c00;font-weight:700;border:0;border-radius:99px;padding:11px 20px;cursor:pointer;box-shadow:0 12px 34px -10px rgba(244,185,66,.7);font-size:14px}
#qw-btn:hover{transform:translateY(-1px)}
#qw-panel{display:none;position:absolute;bottom:54px;right:0;width:290px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 24px 70px -18px #000;text-align:left}
#qw-panel.open{display:block}
@media(max-width:760px){.hide-sm{display:none}}
</style></head><body><div class="wrap">
<header class="site"><span class="crown">👑</span><h1><a href="/">MCP QUEEN</a></h1>
<nav><a href="/registry">Graded Registry</a><a href="/registry#methodology">Methodology</a><a href="/api">API</a><a href="/mcp-info">For Agents</a></nav></header>
${body}
<footer>Grades are produced by deterministic protocol probes — no opinions, only receipts. Auth-gated servers are scored on what is verifiable and marked <em>provisional</em>. Data source: the <a href="https://registry.modelcontextprotocol.io">official MCP registry</a>. MCP Queen is an independent index by the team behind <a href="https://constat.dev">Constat</a> and <a href="https://healthai.com">Clarity</a>. Server owners: embed your <a href="/mcp-info#badge">grade badge</a>, or dispute a grade — every re-probe is public.</footer>
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

async function leaderboard(env: Env, url: URL): Promise<Response> {
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
            (SELECT COUNT(*) FROM latest_grades) graded`
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
  if (q) rows = rows.filter(r => `${r.server_name} ${r.title ?? ""} ${r.description ?? ""}`.toLowerCase().includes(q));
  rows.sort(SORTS[sort].cmp);
  const shown = rows.slice(0, 250);

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
<td class="muted hide-sm">${esc(r.auth_state)}</td>
<td class="faint hide-sm">${esc((r.probed_at ?? "").slice(5, 16).replace("T", " "))}</td></tr>`).join("");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Dataset", name: "MCP Queen graded registry", description: "Live protocol-probe grades with evidence for every remote server in the official MCP registry.", url: `${SITE}/registry`, license: `${SITE}/registry#methodology`, creator: { "@type": "Organization", name: "MCP Queen" }, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/grades.json` }] },
      { "@type": "ItemList", itemListElement: shown.slice(0, 25).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.server_name, url: `${SITE}/s/${r.server_name}` })) },
    ],
  };

  return page("Graded Registry", `
<h2>The Graded Registry</h2>
<p class="muted">Every remote server in the official MCP registry, probed live and graded with receipts — the only MCP index where every grade shows its evidence.</p>
<div class="stats">
<div class="stat"><b>${counts?.total ?? 0}</b><span>servers indexed</span></div>
<div class="stat"><b>${counts?.remotes ?? 0}</b><span>remote endpoints</span></div>
<div class="stat"><b>${counts?.graded ?? 0}</b><span>graded (rolling)</span></div>
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
<table><thead><tr><th>#</th><th>Server</th><th>Grade</th><th>Score</th><th class="hide-sm">Latency</th><th>Tools</th><th class="hide-sm">Auth</th><th class="hide-sm">Probed</th></tr></thead>
<tbody>${tr || `<tr><td colspan="8" class="muted">Nothing matches — <a href="/registry">clear filters</a>.</td></tr>`}</tbody></table>
<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
<div style="flex:2;min-width:260px"><h3 style="margin-top:0">Own one of these servers?</h3>
<p class="muted" style="font-size:14px;margin:0">Claim your <strong>live grade badge</strong> for your README, and get an email the moment your grade moves or your endpoint stops answering — find your server above and hit <em>Watch</em>. Free while in beta.</p></div>
<div style="flex:1;min-width:220px"><h3 style="margin-top:0">Running an agent?</h3>
<p class="muted" style="font-size:14px;margin:0">Ask the queen before you connect to a stranger:<br><code style="font-size:12px">claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp</code></p></div>
</div>
<div class="card" id="methodology"><h3>Methodology</h3>
<p style="font-size:14.5px" class="muted">Each server is probed live over streamable HTTP: <strong>reachability</strong> (25) — does <code>initialize</code> succeed; auth-gated servers earn partial credit only if they advertise <code>WWW-Authenticate</code> so clients can discover OAuth. <strong>protocol</strong> (15) — valid JSON-RPC handshake; deprecated SSE transport is penalized. <strong>tooling</strong> (35) — <code>tools/list</code> works, share of tools with descriptions and fully-typed input schemas, median description depth. <strong>latency</strong> (10) — initialize round-trip. <strong>provenance</strong> (15) — registry metadata completeness and whether the reverse-DNS namespace actually matches the serving domain. Scores scale to what is verifiable; unverifiable dimensions mark the grade <em>provisional</em> rather than guessing. Every point carries the verbatim observation that earned it. No stars, no votes, no pay-to-rank — probes only.</p></div>
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
    { path: "/registry", desc: `${counts?.graded ?? 0} MCP servers graded with live protocol probes and verbatim evidence. Sort by best, worst, fastest, most tools; filter by grade and category.`, jsonld });
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
<p class="muted" style="font-size:14px">Live badge, re-probed continuously — put it in your README:</p>
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
  const fb = await env.DB.prepare("SELECT COUNT(*) c FROM feedback WHERE server_name=?1").bind(name).first<any>();
  const ref = await env.DB.prepare("SELECT count FROM referrals WHERE server_name=?1").bind(name).first<any>();

  const ev: EvidenceItem[] = g?.evidence ? JSON.parse(g.evidence) : [];
  const evRows = ev.map(e => `<tr><td>${esc(e.criterion)}</td><td class="pts">${e.points} / ${e.max}</td><td class="muted">${esc(e.evidence)}</td></tr>`).join("");
  const histRows = (history as any[]).map(h =>
    `<tr><td class="faint">${esc(h.probed_at.slice(0, 16).replace("T", " "))}</td><td><span class="grade g${esc(h.grade)}">${esc(h.grade)}</span></td><td class="pts">${h.score}</td><td class="pts">${h.latency_ms ?? "—"}ms</td></tr>`).join("");
  const cat = classify({ server_name: name, title: s.title, description: s.description });

  return page(name, `
<h2>${esc(name)} ${g ? `<span class="grade g${esc(g.grade)}" style="font-size:18px;vertical-align:middle">${esc(g.grade)}</span>${g.provisional ? ' <span class="prov">provisional — auth-gated, tooling unverifiable</span>' : ""}` : ""}</h2>
<p class="muted">${esc(s.description ?? "")}</p>
<p><span class="pill">${esc(cat)}</span><span class="pill">v${esc(s.version ?? "?")}</span><span class="pill">${esc(s.remote_type ?? "local-only")}</span>${s.remote_url ? `<span class="pill">${esc(new URL(s.remote_url).hostname)}</span>` : ""}${s.repo_url ? ` <a href="${esc(s.repo_url)}" rel="nofollow">repository</a>` : ""}${fb?.c ? ` <span class="pill">${fb.c} agent field report${fb.c === 1 ? "" : "s"} (quarantined pending review)</span>` : ""}${ref?.count ? ` <span class="pill">👑 routed via the queen ×${ref.count}</span>` : ""}</p>
${g ? `<div class="card"><h3>Grade evidence — probed ${esc((g.probed_at ?? "").slice(0, 16).replace("T", " "))} UTC</h3>
<table class="evtable"><thead><tr><th>Criterion</th><th>Points</th><th>Observed</th></tr></thead><tbody>${evRows}</tbody></table>
<p class="faint" style="font-size:13px">Score ${g.score}/100 · latency ${g.latency_ms ?? "—"}ms · ${g.tool_count ?? "—"} tools · auth: ${esc(g.auth_state)}</p></div>` : `<div class="card"><p class="muted">Not probed yet${s.remote_url ? " — queued" : " — no remote endpoint (local-only package), nothing to probe"}.</p></div>`}
${g && s.remote_url && g.reachable && g.auth_state === "open" ? connectSnippets(name, s.remote_url) : ""}
${g ? badgeSnippet(name) : ""}
${g && s.remote_url ? `<div class="card"><h3>Queen Watch</h3>
<form method="post" action="/watch" style="display:flex;gap:8px;flex-wrap:wrap">
<input type="hidden" name="server" value="${esc(name)}">
<input class="search" type="email" name="email" placeholder="you@yourdomain.com" required style="flex:1;min-width:220px">
<button class="btn" type="submit">Watch this server</button></form>
<p class="faint" style="font-size:12.5px;margin-bottom:0">Email alerts when the grade changes or the endpoint stops answering. Double-opt-in, one-click unwatch, free while in beta.</p></div>` : ""}
${histRows ? `<h3>Probe history</h3><table><thead><tr><th>When (UTC)</th><th>Grade</th><th>Score</th><th>Latency</th></tr></thead><tbody>${histRows}</tbody></table>` : ""}
<p style="margin-top:24px"><a href="/registry">← Back to the graded registry</a></p>`,
    { path: `/s/${name}`, desc: g ? `${name}: grade ${g.grade} (${g.score}/100) on MCP Queen — live protocol-probe evidence, latency, tooling quality, provenance.` : `${name} in the MCP Queen graded registry.` });
}

function mcpInfoPage(): Response {
  return page("For Agents", `
<h2>MCP Queen speaks MCP</h2>
<p class="muted">This registry is itself an MCP server. Point your client at <code>https://mcpqueen.com/mcp</code> (streamable HTTP, no auth) and you get four tools:</p>
<div class="card"><table class="evtable"><tbody>
<tr><td>search_servers</td><td class="muted">Find servers by task, keyword or category — returns graded matches with endpoints, best-first. This is the broker: ask the queen, connect direct.</td></tr>
<tr><td>list_grades</td><td class="muted">Top graded servers — grade, score, latency, tool count. Optional <code>limit</code>.</td></tr>
<tr><td>get_server_grade</td><td class="muted">Full evidence breakdown for one server by registry name.</td></tr>
<tr><td>submit_feedback</td><td class="muted">File a field report about a server you actually used. Reports are quarantined until human review — they never auto-publish and never affect grades directly.</td></tr>
</tbody></table></div>
<pre>claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp</pre>
<p class="muted">Yes, that means agents can review MCP servers here. Field reports from real usage catch what deterministic probes can't — but because agents can be prompted to astroturf, reports are evidence for the review queue, not votes.</p>
<h3 id="badge">Badges for server owners</h3>
<p class="muted">Every graded server has a live SVG badge at <code>/badge/&lt;registry-name&gt;.svg</code> that re-grades itself as probes run. Embed it in your README and link back to your evidence page — see the snippet on your server's page.</p>
<h3>Machine surfaces</h3>
<p class="muted"><code>/api/grades.json</code> (CORS-open JSON) · <code>/llms.txt</code> · <code>/sitemap.xml</code></p>`,
    { path: "/mcp-info", desc: "MCP Queen is itself an MCP server: search graded servers, fetch evidence, submit field reports. Plus embeddable live grade badges." });
}

/** Royal envelope for all JSON API responses — attribution, license, provenance. */
function apiJson(payload: Record<string, any>): Response {
  return Response.json({
    attribution: "MCP Queen — the graded MCP registry (https://mcpqueen.com)",
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
<tr><td><a href="/api/grades.json">GET /api/grades.json</a></td><td class="muted">Top 500 graded servers by score — grade, score, provisional flag, latency, tool count, auth state, probe time.</td></tr>
<tr><td>GET /api/history/{name}.json</td><td class="muted">Per-server probe time series (last 200 probes). Example: <a href="/api/history/com.healthai/clarity.json"><code>/api/history/com.healthai/clarity.json</code></a></td></tr>
<tr><td><a href="/api/changes.json">GET /api/changes.json</a></td><td class="muted">Latest 100 grade transitions across the registry — who got better, who broke.</td></tr>
<tr><td>GET /badge/{name}.svg</td><td class="muted">Live grade badge for a server, e.g. <code>/badge/com.healthai/clarity.svg</code> — embed it in a README.</td></tr>
</tbody></table></div>
<div class="card"><h3>MCP endpoint (for agents)</h3>
<p class="muted" style="font-size:14px">The registry is itself an MCP server — <code>search_servers</code>, <code>get_server_grade</code>, <code>list_grades</code>, <code>submit_feedback</code>:</p>
<pre>claude mcp add --transport http mcpqueen https://mcpqueen.com/mcp</pre>
<p class="muted" style="font-size:14px">Or raw JSON-RPC:</p>
<pre>curl -X POST https://mcpqueen.com/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"search_servers","arguments":{"query":"postgres"}}}'</pre>
<p class="faint" style="font-size:12.5px">Details and etiquette: <a href="/mcp-info">For Agents</a> · machine summary: <a href="/llms.txt">/llms.txt</a></p></div>
<p class="faint" style="font-size:13px">Want webhooks, full history exports, or bulk access? That tier is coming — the data already exists. Watch this page.</p>`,
    { path: "/api", desc: "MCP Queen API: free JSON endpoints for evidence-backed MCP server grades, probe history, grade changes, live badges, and an MCP endpoint for agents." });
}

// ---------------------------------------------------------------- machine surfaces

async function sitemap(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT server_name FROM latest_grades ORDER BY score DESC LIMIT 2000").all();
  const urls = ["/", "/registry", "/mcp-info", ...(results as any[]).map(r => `/s/${r.server_name}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${SITE}${encodeURI(u).replace(/&/g, "&amp;")}</loc></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" } });
}

function llmsTxt(): Response {
  return new Response(`# MCP Queen — the graded MCP registry

> Every remote server in the official MCP registry, probed live over streamable
> HTTP and graded deterministically with verbatim evidence. No stars, no votes,
> no pay-to-rank — probes only.

## For agents
- MCP endpoint (streamable HTTP, no auth): https://mcpqueen.com/mcp
  Tools: search_servers (find graded servers by task/category — the discovery
  broker), list_grades, get_server_grade, submit_feedback (field reports,
  quarantined for human review).
- Grades API (JSON, CORS-open): https://mcpqueen.com/api/grades.json

## For humans
- Dashboard (sort/filter/search, categories): https://mcpqueen.com/registry
- Per-server evidence pages: https://mcpqueen.com/s/<registry-name>
- Methodology: https://mcpqueen.com/registry#methodology

## For server owners
- Live grade badge: https://mcpqueen.com/badge/<registry-name>.svg
- Grades refresh automatically (~3-day full probe cycle). Fix what the
  evidence shows and the badge updates itself.

Grading rubric: reachability 25 / protocol 15 / tooling 35 / latency 10 /
provenance 15. Auth-gated servers are scored on the verifiable subset and
marked provisional. By the team behind constat.dev and healthai.com.
`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function robotsTxt(): Response {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`, { headers: { "content-type": "text/plain" } });
}

// ---------------------------------------------------------------- mcpqueen's own MCP server

const QUEEN_TOOLS = [
  {
    name: "search_servers",
    description: "Search the graded MCP registry for servers matching a task or keyword (e.g. 'postgres', 'send email', 'web scraping'). Returns the best-graded matches with their remote endpoint URLs so you can connect directly. Optionally filter by category.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword or task to search name/title/description for" },
        category: { type: "string", description: `Optional category filter: ${CATEGORIES.map(c => c[0]).join(", ")}, Other` },
        limit: { type: "number", description: "Max results (default 10, max 25)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_grades",
    description: "List the top graded MCP servers from the mcpqueen registry (deterministic probe grades with evidence). Returns grade, score 0-100, latency, tool count and auth state per server.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max servers to return (default 25, max 100)" } } },
  },
  {
    name: "get_server_grade",
    description: "Get the full grade and verbatim probe evidence for one MCP server, by its official registry name (e.g. 'com.healthai/radar').",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Registry server name" } }, required: ["name"] },
  },
  {
    name: "submit_feedback",
    description: "Submit a field report about an MCP server you have actually used (what worked, what failed, surprising behavior). Reports are quarantined for human review and never auto-published.",
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
        serverInfo: { name: "mcpqueen", version: "0.2.0" },
        instructions: "The graded MCP registry. search_servers to find graded servers for a task (then connect to them directly), list_grades for the leaderboard, get_server_grade for evidence on one server, submit_feedback to file a field report from real usage (quarantined until human review).",
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
          const like = `%${q.replace(/[%_]/g, "")}%`;
          const { results } = await env.DB.prepare(
            `SELECT s.name, s.title, s.description, s.remote_url, s.remote_type,
                    g.grade, g.score, g.provisional, g.latency_ms, g.tool_count, g.auth_state
             FROM servers s LEFT JOIN latest_grades g ON g.server_name = s.name
             WHERE s.status='active' AND (s.name LIKE ?1 OR s.title LIKE ?1 OR s.description LIKE ?1)
             ORDER BY (g.score IS NULL), g.score DESC LIMIT 200`
          ).bind(like).all();
          let hits = (results as any[]).map(r => ({ ...r, category: classify(r) }));
          if (args.category) hits = hits.filter(h => h.category === String(args.category));
          hits = hits.slice(0, limit).map(h => ({
            ...h,
            evidence_page: `${SITE}/s/${h.name}`,
            referral_link: `${SITE}/go/${h.name}`,
            note: h.grade == null ? "not yet probed" : h.remote_url == null ? "local-only package" : undefined,
          }));
          await env.DB.prepare("INSERT INTO mcp_queries (tool, query, category, results, ip_hash, called_at) VALUES ('search_servers',?1,?2,?3,?4,?5)")
            .bind(q, String(args.category ?? "") || null, hits.length,
              await ipHash16(req.headers.get("cf-connecting-ip") ?? "unknown"), new Date().toISOString())
            .run().catch(() => { /* demand logging never breaks the tool */ });
          if (!hits.length) return text(`No servers match "${q}"${args.category ? ` in ${args.category}` : ""}. Try a broader keyword.`);
          return text(JSON.stringify(hits, null, 2));
        }
        if (name === "list_grades") {
          const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
          const { results } = await env.DB.prepare(
            "SELECT server_name, grade, score, provisional, latency_ms, tool_count, auth_state, probed_at FROM latest_grades ORDER BY score DESC LIMIT ?1"
          ).bind(limit).all();
          return text(JSON.stringify(results, null, 2));
        }
        if (name === "get_server_grade") {
          const g = await env.DB.prepare(
            "SELECT g.*, s.description, s.remote_url, s.repo_url, s.version FROM latest_grades g JOIN servers s ON s.name=g.server_name WHERE g.server_name=?1"
          ).bind(String(args.name ?? "")).first<any>();
          await env.DB.prepare("INSERT INTO mcp_queries (tool, query, results, ip_hash, called_at) VALUES ('get_server_grade',?1,?2,?3,?4)")
            .bind(String(args.name ?? ""), g ? 1 : 0,
              await ipHash16(req.headers.get("cf-connecting-ip") ?? "unknown"), new Date().toISOString())
            .run().catch(() => { /* demand logging never breaks the tool */ });
          if (!g) return text(`No grade on file for "${args.name}". It may be local-only, not yet probed, or not in the official registry.`, true);
          g.evidence = JSON.parse(g.evidence);
          return text(JSON.stringify(g, null, 2));
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
async function notifyFeedback(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) return;
  const last = Number((await env.DB.prepare("SELECT v FROM meta WHERE k='last_fb_notified'").first<{ v: string }>())?.v ?? 0);
  const { results } = await env.DB.prepare(
    "SELECT id, server_name, agent_name, report, submitted_at FROM feedback WHERE id > ?1 ORDER BY id LIMIT 20"
  ).bind(last).all();
  const rows = results as any[];
  if (!rows.length) return;

  const items = rows.map(r =>
    `<li><b>${esc(r.server_name)}</b> <span style="color:#888">(${esc(r.agent_name ?? "anonymous")} · ${esc(r.submitted_at.slice(0, 16))}Z)</span><br>${esc(r.report)}</li>`).join("");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.FEEDBACK_FROM ?? "MCP Queen <onboarding@resend.dev>",
      to: [env.FEEDBACK_TO],
      subject: `👑 ${rows.length} new field report${rows.length === 1 ? "" : "s"} in the review queue`,
      html: `<p>New quarantined agent field reports on mcpqueen.com:</p><ul>${items}</ul><p>Review queue: /admin/feedback (key in .secrets.local). Reports never auto-publish.</p>`,
    }),
  });
  if (res.ok) {
    await env.DB.prepare("INSERT INTO meta (k,v) VALUES ('last_fb_notified',?1) ON CONFLICT(k) DO UPDATE SET v=?1")
      .bind(String(rows[rows.length - 1].id)).run();
  }
}

// ---------------------------------------------------------------- entry

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/registry") return leaderboard(env, url);
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
    if (path === "/.well-known/mcp-registry-auth")
      return new Response("v=MCPv1; k=ed25519; p=PqQX2aKlyTBuRkr6B9PKuw79gmhqJNXOsrIp12/k5Hk=\n", { headers: { "content-type": "text/plain" } });
    if (path === "/sitemap.xml") return sitemap(env);
    if (path === "/llms.txt") return llmsTxt();
    if (path === "/robots.txt") return robotsTxt();
    if (path === "/api/grades.json") {
      const { results } = await env.DB.prepare(
        "SELECT server_name, grade, score, provisional, latency_ms, tool_count, auth_state, probed_at FROM latest_grades ORDER BY score DESC LIMIT 500").all();
      const total = await env.DB.prepare("SELECT COUNT(*) n FROM latest_grades").first<any>();
      return apiJson({
        note: "Top servers by score. The complete corpus with evidence and history is not bulk-served — per-server detail at /api/history/{name}.json, humans at /registry.",
        returned: (results as any[]).length, total_graded: total?.n ?? null, grades: results,
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
      if (path === "/admin/queries") {
        const { results } = await env.DB.prepare(
          "SELECT tool, query, category, results, called_at FROM mcp_queries ORDER BY id DESC LIMIT 200").all();
        return Response.json(results);
      }
      if (path === "/admin/feedback") {
        const { results } = await env.DB.prepare(
          "SELECT id, server_name, agent_name, report, submitted_at, reviewed FROM feedback ORDER BY submitted_at DESC LIMIT 100").all();
        return Response.json(results);
      }
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      await syncRegistry(env, 4);
      await probeBatch(env, 30);
      await notifyGradeChanges(env).catch(() => { /* alerting must never break probing */ });
      await notifyFeedback(env).catch(() => { /* alerting must never break probing */ });
    })());
  },
} satisfies ExportedHandler<Env>;
