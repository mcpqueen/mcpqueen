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

-- agent/user field reports; quarantined until reviewed, never auto-published
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  agent_name TEXT,
  report TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  ip_hash TEXT,
  reviewed INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_feedback_server ON feedback(server_name);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- /go/<name> referral clicks — "routed via the queen" counter, no PII
CREATE TABLE IF NOT EXISTS referrals (
  server_name TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  last_at TEXT
);
