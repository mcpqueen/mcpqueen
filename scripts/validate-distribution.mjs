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
if ((submission.test_cases?.length || 0) >= 5 && (submission.negative_test_cases?.length || 0) >= 3) {
  pass("OpenAI submission JSON includes reviewer and negative test cases");
} else {
  fail("OpenAI submission JSON needs at least five tests and three negative tests");
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
      if (tool.outputSchema && tool.annotations) {
        pass(`${tool.name} has output schema and safety annotations`);
      } else {
        fail(`${tool.name} lacks output schema or safety annotations`);
      }
    }

    const searched = await rpc(manifest.mcp_url, "tools/call", {
      name: "search_servers",
      arguments: {
        query: "GitHub issue triage",
        auth: "open",
        limit: 3,
      },
    });
    const structured = searched.result?.structuredContent;
    if (
      Array.isArray(structured?.results) &&
      typeof structured?.feedback_reminder === "string" &&
      searched.result?.isError !== true
    ) {
      pass("read-only search_servers smoke call returns structured results");
    } else {
      fail("search_servers smoke call lacks valid structured results");
    }
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
