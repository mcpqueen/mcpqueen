-- mcpqueen graded registry
CREATE TABLE IF NOT EXISTS servers (
  name TEXT PRIMARY KEY,             -- reverse-DNS registry name, e.g. com.healthai/radar
  title TEXT,
  description TEXT,
  version TEXT,
  repo_url TEXT,
  website_url TEXT,
  remote_type TEXT,                  -- streamable-http | sse | NULL (local-only)
  remote_url TEXT,
  status TEXT,                       -- registry status: active | deprecated | deleted
  updated_at TEXT,                   -- registry updatedAt
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  registry_json TEXT
);

CREATE TABLE IF NOT EXISTS probes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  probed_at TEXT NOT NULL,
  grade TEXT,
  score INTEGER,                     -- 0..100 (scaled when provisional)
  provisional INTEGER DEFAULT 0,     -- 1 = auth-gated, tooling unverifiable
  reachable INTEGER,
  auth_state TEXT,                   -- open | auth-wellbehaved | auth-bare | unreachable
  latency_ms INTEGER,
  tool_count INTEGER,
  evidence TEXT                      -- JSON [{criterion, points, max, evidence}]
);
CREATE INDEX IF NOT EXISTS idx_probes_server ON probes(server_name, probed_at DESC);

-- denormalized latest probe per server, for the leaderboard
CREATE TABLE IF NOT EXISTS latest_grades (
  server_name TEXT PRIMARY KEY,
  grade TEXT, score INTEGER, provisional INTEGER,
  reachable INTEGER, auth_state TEXT, latency_ms INTEGER, tool_count INTEGER,
  probed_at TEXT, evidence TEXT
);

-- per-server tool catalog captured from tools/list at probe time.
-- replaced wholesale on each SUCCESSFUL probe; left untouched when a probe fails
-- (so a transient outage never erases the last-known-good catalog).
-- this is the searchable "what data/capability does this server expose" layer.
CREATE TABLE IF NOT EXISTS server_tools (
  server_name TEXT NOT NULL,
  tool_name   TEXT NOT NULL,
  description TEXT,                   -- truncated to 600 chars
  has_schema  INTEGER DEFAULT 0,      -- 1 = fully-typed inputSchema
  input_schema TEXT,                  -- full JSON Schema captured from tools/list
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (server_name, tool_name)
);
CREATE INDEX IF NOT EXISTS idx_server_tools_name ON server_tools(tool_name);

-- agent/user field reports; quarantined until reviewed, never auto-published
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  agent_name TEXT,
  report TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  ip_hash TEXT,
  reviewed INTEGER DEFAULT 0,
  operator_response TEXT,
  operator_responded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_server ON feedback(server_name);

-- Evidence-backed trust observations. Security and data quality are separate
-- dimensions and never silently alter the operational protocol grade.
CREATE TABLE IF NOT EXISTS trust_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  dimension TEXT NOT NULL,          -- security | data_integrity | citation_quality | claim_verification
  metric TEXT NOT NULL,             -- stable machine-readable measurement name
  status TEXT NOT NULL,             -- observed | pass | concern | unverified | not_testable
  value_text TEXT,
  evidence TEXT NOT NULL,
  source_type TEXT NOT NULL,        -- live_probe | source_audit | authoritative_lookup | owner_attested
  sample_size INTEGER,
  observed_at TEXT NOT NULL,
  methodology_version TEXT NOT NULL DEFAULT 'trust-v1',
  public INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_trust_server ON trust_observations(server_name, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_search ON trust_observations(dimension, status, observed_at DESC);

-- Reproducible response-level samples. Raw responses are reduced to hashes and
-- bounded evidence snippets; the public receipt publishes denominators.
CREATE TABLE IF NOT EXISTS evidence_benchmark_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  benchmark_pack TEXT NOT NULL,
  queries_json TEXT NOT NULL,
  samples INTEGER NOT NULL,
  successful_samples INTEGER NOT NULL,
  samples_with_identifiers INTEGER NOT NULL,
  identifiers_found INTEGER NOT NULL,
  identifiers_resolved INTEGER NOT NULL,
  run_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_benchmark_server ON evidence_benchmark_runs(server_name, run_at DESC);

-- Outbound feedback digests: accepted-by-API is not the same as delivered.
CREATE TABLE IF NOT EXISTS email_deliveries (
  email_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,            -- accepted | sent | delivered | bounced | failed | suppressed | ...
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  provider_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status ON email_deliveries(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- what agents actually ask for — live MCP-ecosystem demand signal
CREATE TABLE IF NOT EXISTS mcp_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool TEXT NOT NULL,
  query TEXT,
  category TEXT,
  results INTEGER,
  ip_hash TEXT,
  called_at TEXT NOT NULL
);

-- /go/<name> referral clicks — "routed via the queen" counter, no PII
CREATE TABLE IF NOT EXISTS referrals (
  server_name TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  last_at TEXT
);

-- grade transitions detected at probe time (feeds /api/changes + watcher alerts)
CREATE TABLE IF NOT EXISTS grade_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  old_grade TEXT, new_grade TEXT,
  old_score INTEGER, new_score INTEGER,
  notified INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_changes_time ON grade_changes(changed_at DESC);

-- Queen Watch: grade/uptime alerts for server owners (free while in beta)
CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL,           -- confirm/unsubscribe token
  verified INTEGER DEFAULT 0,    -- alerts go to verified only
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  UNIQUE(server_name, email)
);
