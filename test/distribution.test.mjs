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
