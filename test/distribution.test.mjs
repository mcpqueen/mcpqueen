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
