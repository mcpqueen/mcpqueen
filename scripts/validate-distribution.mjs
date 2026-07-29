#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  root,
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ||
    "distribution/mcpqueen.json",
);
const live = process.argv.includes("--live");
const failures = [];

function pass(message) {
  console.log(`PASS  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${raw.slice(0, 200)}`);
  const payload = raw
    .split("\n")
    .find((line) => line.startsWith("data:"))
    ?.slice(5)
    .trim();
  return JSON.parse(payload || raw);
}

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("not a PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const manifest = await loadJson(manifestPath);
pass(`loaded ${manifest.product} manifest`);

for (const relative of manifest.required_files) {
  try {
    await access(resolve(root, relative));
    pass(`artifact exists: ${relative}`);
  } catch {
    fail(`missing artifact: ${relative}`);
  }
}

const submission = await loadJson(resolve(root, "chatgpt-app-submission.json"));
if (submission.schema_version === 1 && submission.app_info?.display_name) {
  pass("OpenAI submission JSON has schema version and app metadata");
} else {
  fail("OpenAI submission JSON is missing required top-level metadata");
}
if (
  typeof submission.app_info?.display_name === "string" &&
  submission.app_info.display_name.length <= 30 &&
  !submission.app_info.display_name.includes("\n") &&
  typeof submission.app_info?.subtitle === "string" &&
  submission.app_info.subtitle.length <= 30 &&
  !submission.app_info.subtitle.includes("\n") &&
  typeof submission.app_info?.description === "string" &&
  submission.app_info.description.length <= 4000
) {
  pass("OpenAI listing text satisfies final submission length limits");
} else {
  fail("OpenAI listing text violates final submission length limits");
}
if (
  submission.test_cases?.length === 5 &&
  submission.negative_test_cases?.length === 3
) {
  pass("OpenAI submission JSON includes exactly five positive and three negative tests");
} else {
  fail("OpenAI submission JSON needs exactly five positive and three negative tests");
}

for (const expected of manifest.expected_tools) {
  const review = submission.tools?.[expected];
  const annotations = review?.annotations;
  const justifications = review?.justifications;
  if (
    annotations &&
    typeof annotations.readOnlyHint === "boolean" &&
    typeof annotations.openWorldHint === "boolean" &&
    typeof annotations.destructiveHint === "boolean" &&
    typeof justifications?.read_only_justification === "string" &&
    justifications.read_only_justification.trim() &&
    typeof justifications?.open_world_justification === "string" &&
    justifications.open_world_justification.trim() &&
    typeof justifications?.destructive_justification === "string" &&
    justifications.destructive_justification.trim()
  ) {
    pass(`${expected} has explicit annotations and justifications`);
  } else {
    fail(`${expected} lacks explicit annotations or justifications`);
  }
}

for (const relative of [
  "submission-assets/mcpqueen-directory-icon.png",
  "submission-assets/mcpqueen-composer-icon.png",
]) {
  try {
    const dimensions = pngDimensions(await readFile(resolve(root, relative)));
    if (dimensions.width === 512 && dimensions.height === 512) {
      pass(`${relative} is a 512×512 PNG`);
    } else {
      fail(`${relative} is ${dimensions.width}×${dimensions.height}, expected 512×512`);
    }
  } catch (error) {
    fail(`${relative}: ${error.message}`);
  }
}

const demoPlan = await loadJson(
  resolve(root, "submission-assets/demo/demo-plan.json"),
);
if (
  Array.isArray(demoPlan.starter_prompts) &&
  demoPlan.starter_prompts.length > 0 &&
  demoPlan.starter_prompts.length <= 3 &&
  demoPlan.starter_prompts.every(
    (prompt) =>
      typeof prompt === "string" &&
      prompt.length <= 128 &&
      !prompt.includes("\n") &&
      !prompt.includes("@"),
  )
) {
  pass("OpenAI starter prompts satisfy count, length, line, and mention limits");
} else {
  fail("OpenAI starter prompts violate portal constraints");
}

const demoTools = new Set(
  (demoPlan.segments || []).flatMap((segment) => segment.tools || []),
);
for (const expected of manifest.expected_tools) {
  if (demoTools.has(expected)) pass(`demo covers MCP tool: ${expected}`);
  else fail(`demo does not cover MCP tool: ${expected}`);
}

const finalSegment = demoPlan.segments?.at(-1);
if (
  finalSegment &&
  finalSegment.start_seconds + finalSegment.duration_seconds ===
    demoPlan.target_duration_seconds
) {
  pass("demo timeline matches its target duration");
} else {
  fail("demo timeline does not match its target duration");
}

for (const [relative, expected] of [
  [
    "submission-assets/demo/mcpqueen-openai-demo-title.png",
    { width: 1920, height: 1080 },
  ],
  [
    "submission-assets/demo/mcpqueen-openai-demo-end.png",
    { width: 1920, height: 1080 },
  ],
  [
    "submission-assets/demo/mcpqueen-openai-demo-thumbnail.png",
    { width: 1280, height: 720 },
  ],
]) {
  try {
    const dimensions = pngDimensions(await readFile(resolve(root, relative)));
    if (
      dimensions.width === expected.width &&
      dimensions.height === expected.height
    ) {
      pass(`${relative} is ${expected.width}×${expected.height}`);
    } else {
      fail(
        `${relative} is ${dimensions.width}×${dimensions.height}, expected ${expected.width}×${expected.height}`,
      );
    }
  } catch (error) {
    fail(`${relative}: ${error.message}`);
  }
}

if (live) {
  for (const url of manifest.public_urls) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) pass(`public URL responds: ${url}`);
      else fail(`public URL ${url} returned ${response.status}`);
    } catch (error) {
      fail(`public URL ${url}: ${error.message}`);
    }
  }

  try {
    const initialized = await rpc(manifest.mcp_url, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "distribution-validator", version: "1.0.0" },
    });
    if (initialized.result?.serverInfo?.name) pass("MCP initialize succeeds");
    else fail("MCP initialize response lacks serverInfo");

    const listed = await rpc(manifest.mcp_url, "tools/list");
    const tools = listed.result?.tools || [];
    const names = new Set(tools.map((tool) => tool.name));
    for (const expected of manifest.expected_tools) {
      if (names.has(expected)) pass(`MCP tool published: ${expected}`);
      else fail(`MCP tool missing: ${expected}`);
    }
    for (const tool of tools) {
      if (
        typeof tool.title === "string" &&
        tool.title.trim() &&
        tool.outputSchema &&
        tool.annotations &&
        typeof tool.annotations.readOnlyHint === "boolean" &&
        typeof tool.annotations.openWorldHint === "boolean" &&
        typeof tool.annotations.destructiveHint === "boolean"
      ) {
        pass(`${tool.name} has a title, output schema, and safety annotations`);
      } else {
        fail(`${tool.name} lacks a title, output schema, or safety annotations`);
      }
    }

    const representativeCalls = [
      {
        name: "search_servers",
        arguments: { query: "GitHub issue triage", auth: "open", limit: 3 },
        validate: (value) =>
          Array.isArray(value?.results) &&
          typeof value?.feedback_reminder === "string",
      },
      {
        name: "search_tools",
        arguments: { query: "FDA 510(k)", limit: 3 },
        validate: (value) =>
          Array.isArray(value?.results) &&
          typeof value?.feedback_reminder === "string",
      },
      {
        name: "list_grades",
        arguments: { limit: 3 },
        validate: (value) =>
          Array.isArray(value?.results) && typeof value?.returned === "number",
      },
      {
        name: "get_server_grade",
        arguments: { name: "com.healthai/radar" },
        validate: (value) =>
          value?.server_name === "com.healthai/radar" &&
          Array.isArray(value?.evidence),
      },
      {
        name: "get_trust_receipt",
        arguments: { name: "com.healthai/radar" },
        validate: (value) =>
          value?.server?.name === "com.healthai/radar" ||
          value?.server_name === "com.healthai/radar",
      },
      {
        name: "search_trust_evidence",
        arguments: {
          query: "citation",
          dimension: "citation_quality",
          limit: 3,
        },
        validate: (value) =>
          Array.isArray(value?.results) && typeof value?.returned === "number",
      },
    ];

    for (const check of representativeCalls) {
      const called = await rpc(manifest.mcp_url, "tools/call", {
        name: check.name,
        arguments: check.arguments,
      });
      const structured = called.result?.structuredContent;
      if (called.result?.isError !== true && check.validate(structured)) {
        pass(`read-only ${check.name} smoke call returns structured results`);
      } else {
        fail(`${check.name} smoke call lacks valid structured results`);
      }
    }

    pass("submit_feedback is not called by validation because it writes to the quarantined review queue");
  } catch (error) {
    fail(`live MCP validation: ${error.message}`);
  }
}

console.log("\nManual gates (intentionally not automated):");
for (const gate of manifest.manual_gates) console.log(`- ${gate}`);

if (failures.length) {
  console.error(`\n${failures.length} distribution check(s) failed.`);
  process.exit(1);
}
console.log(`\nDistribution checks passed${live ? " (including live surfaces)" : ""}.`);
