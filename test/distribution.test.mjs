import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("distribution manifest references prepared artifacts", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("distribution/mcpqueen.json", root), "utf8"),
  );

  assert.equal(manifest.mcp_url, "https://mcpqueen.com/mcp");
  assert.deepEqual(manifest.expected_tools, [
    "search_servers",
    "search_tools",
    "list_grades",
    "get_server_grade",
    "get_trust_receipt",
    "search_trust_evidence",
    "submit_feedback",
  ]);

  await Promise.all(
    manifest.required_files.map((path) => access(new URL(path, root))),
  );
});

test("Anthropic package is deterministic, source-aligned, and blocked honestly", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("distribution/mcpqueen.json", root), "utf8"),
  );
  const submission = JSON.parse(
    await readFile(
      new URL("anthropic-directory-submission.json", root),
      "utf8",
    ),
  );
  const worker = await readFile(new URL("src/worker.ts", root), "utf8");
  const runbook = await readFile(
    new URL("docs/anthropic-submission.md", root),
    "utf8",
  );

  assert.equal(
    submission.status,
    "prepared_blocked_origin_validation_and_human_checks",
  );
  assert.equal(submission.status, manifest.anthropic_submission.status);
  assert.equal(submission.connection.server_url, manifest.mcp_url);
  assert.equal(submission.connection.transport, "streamable_http");
  assert.equal(submission.connection.authentication, "none");
  assert.ok(
    submission.official_sources.includes(
      "https://modelcontextprotocol.io/specification/2025-11-25/basic/transports",
    ),
  );
  assert.deepEqual(
    submission.official_sources,
    manifest.anthropic_submission.requirements_sources,
  );
  assert.equal(submission.listing.slug, null);
  assert.equal(submission.readiness.submission_receipt, null);
  assert.equal(submission.readiness.directory_listing_url, null);
  assert.ok(submission.listing.name.length <= 100);
  assert.ok(submission.listing.tagline.length <= 55);
  assert.ok(submission.listing.description.length <= 2000);
  assert.ok(submission.listing.suggested_categories.length >= 1);
  assert.ok(submission.listing.suggested_categories.length <= 5);
  assert.ok(submission.use_cases.length >= 3);
  assert.equal(
    submission.reviewer_access.documented_test_credentials_requirement,
    "required_by_current_public_submission_and_testing_guidance",
  );
  assert.equal(
    submission.reviewer_access.test_account_required_by_service,
    false,
  );
  assert.equal(submission.reviewer_access.test_credentials, null);
  assert.equal(
    submission.reviewer_access.credentials_applicability,
    "not_applicable_to_authless_service_pending_portal_or_reviewer_confirmation",
  );
  assert.ok(
    submission.blockers.some(
      (blocker) =>
        blocker.id === "authless_test_credentials_clarification" &&
        blocker.status === "open",
    ),
  );
  assert.ok(
    submission.blockers.some(
      (blocker) =>
        blocker.id === "submission_identity_and_authority" &&
        blocker.status === "open",
    ),
  );
  assert.doesNotMatch(
    `${JSON.stringify(submission)}\n${JSON.stringify(manifest.anthropic_submission)}\n${runbook}`,
    /Team or Enterprise|Directory management|Libraries permission/i,
  );
  assert.equal(submission.branding.portal_selected_logo, null);
  assert.equal(submission.branding.portal_logo_acceptance, "not_verified");
  assert.deepEqual(
    submission.branding.prepared_logo_assets.map((asset) => asset.format),
    ["SVG", "PNG"],
  );

  assert.deepEqual(
    submission.tools.map((tool) => tool.name),
    manifest.expected_tools,
  );
  for (const tool of submission.tools) {
    assert.ok(tool.name.length <= 64);
    assert.ok(tool.title);
    assert.ok(tool.description);
    assert.equal(typeof tool.readOnlyHint, "boolean");
    assert.equal(typeof tool.destructiveHint, "boolean");
    assert.equal(typeof tool.openWorldHint, "boolean");

    const start = worker.indexOf(`name: "${tool.name}"`);
    assert.notEqual(start, -1, `missing tool ${tool.name}`);
    const end = worker.indexOf("outputSchema:", start);
    const definition = worker.slice(start, end);
    const sourceDescription = JSON.parse(
      definition.match(/description:\s*("(?:\\.|[^"\\])*")/)[1],
    );
    assert.equal(sourceDescription, tool.description);
    assert.match(definition, new RegExp(`title: "${tool.title}"`));
    assert.match(
      definition,
      new RegExp(`readOnlyHint: ${tool.readOnlyHint}`),
    );
    assert.match(
      definition,
      new RegExp(`destructiveHint: ${tool.destructiveHint}`),
    );
    assert.match(
      definition,
      new RegExp(`openWorldHint: ${tool.openWorldHint}`),
    );
  }

  assert.doesNotMatch(worker, /headers\.get\(\s*["']origin["']\s*\)/i);
  assert.equal(
    submission.readiness.origin_header_validation,
    "blocked_not_implemented_in_current_endpoint",
  );
  assert.ok(
    submission.blockers.some(
      (blocker) =>
        blocker.id === "origin_header_validation" && blocker.status === "open",
    ),
  );
  assert.deepEqual(
    submission.blockers.map((blocker) => blocker.id),
    [
      "origin_header_validation",
      "all_tools_in_anthropic_clients",
      "authless_test_credentials_clarification",
      "submission_identity_and_authority",
      "policy_and_terms",
      "public_url_and_branding_recheck",
      "final_submission",
    ],
  );
});

test("Anthropic-facing tools have human-readable titles and safety annotations", async () => {
  const worker = await readFile(new URL("src/worker.ts", root), "utf8");
  const expected = {
    search_servers: "Search MCP Servers",
    search_tools: "Search MCP Tools",
    list_grades: "List Operational Grades",
    get_server_grade: "Get Server Grade",
    get_trust_receipt: "Get Trust Receipt",
    search_trust_evidence: "Search Trust Evidence",
    submit_feedback: "Submit Field Report",
  };

  for (const [name, title] of Object.entries(expected)) {
    const start = worker.indexOf(`name: "${name}"`);
    assert.notEqual(start, -1, `missing tool ${name}`);
    const end = worker.indexOf("outputSchema:", start);
    const definition = worker.slice(start, end);
    assert.match(definition, new RegExp(`title: "${title}"`));
    assert.match(definition, /annotations:\s*\{[^}]*readOnlyHint:/);
    assert.match(definition, /openWorldHint:/);
    assert.match(definition, /destructiveHint:/);
  }
});

test("OpenAI demo plan satisfies prompt and tool coverage requirements", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("distribution/mcpqueen.json", root), "utf8"),
  );
  const plan = JSON.parse(
    await readFile(
      new URL("submission-assets/demo/demo-plan.json", root),
      "utf8",
    ),
  );

  assert.ok(plan.starter_prompts.length > 0);
  assert.ok(plan.starter_prompts.length <= 3);
  for (const prompt of plan.starter_prompts) {
    assert.ok(prompt.length <= 128);
    assert.doesNotMatch(prompt, /[\n@]/);
  }

  const covered = new Set(
    plan.segments.flatMap((segment) => segment.tools || []),
  );
  assert.deepEqual(
    manifest.expected_tools.filter((tool) => !covered.has(tool)),
    [],
  );

  const final = plan.segments.at(-1);
  assert.equal(
    final.start_seconds + final.duration_seconds,
    plan.target_duration_seconds,
  );
});

test("OpenAI submission satisfies final listing, test, and tool-review limits", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("distribution/mcpqueen.json", root), "utf8"),
  );
  const submission = JSON.parse(
    await readFile(new URL("chatgpt-app-submission.json", root), "utf8"),
  );

  assert.ok(submission.app_info.display_name.length <= 30);
  assert.doesNotMatch(submission.app_info.display_name, /\n/);
  assert.ok(submission.app_info.subtitle.length <= 30);
  assert.doesNotMatch(submission.app_info.subtitle, /\n/);
  assert.ok(submission.app_info.description.length <= 4000);
  assert.equal(submission.test_cases.length, 5);
  assert.equal(submission.negative_test_cases.length, 3);

  for (const name of manifest.expected_tools) {
    const tool = submission.tools[name];
    assert.ok(tool, `missing review metadata for ${name}`);
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
    assert.equal(typeof tool.annotations.openWorldHint, "boolean");
    assert.equal(typeof tool.annotations.destructiveHint, "boolean");
    assert.ok(tool.justifications.read_only_justification.trim());
    assert.ok(tool.justifications.open_world_justification.trim());
    assert.ok(tool.justifications.destructive_justification.trim());
  }
});

test("integration examples keep automatic model access read-only", async () => {
  const cloudflare = await readFile(
    new URL("examples/integrations/cloudflare-agent/src/index.ts", root),
    "utf8",
  );
  const huggingface = await readFile(
    new URL("examples/integrations/huggingface/main.py", root),
    "utf8",
  );

  assert.match(cloudflare, /READ_ONLY_TOOLS/);
  assert.match(cloudflare, /stepCountIs\(5\)/);
  assert.doesNotMatch(
    cloudflare.slice(
      cloudflare.indexOf("READ_ONLY_TOOLS"),
      cloudflare.indexOf("]);"),
    ),
    /submit_feedback/,
  );
  assert.match(huggingface, /READ_ONLY_TOOLS/);
  assert.doesNotMatch(
    huggingface.slice(
      huggingface.indexOf("READ_ONLY_TOOLS"),
      huggingface.indexOf("]"),
    ),
    /submit_feedback/,
  );
});
