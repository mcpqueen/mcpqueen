#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");
const endpoint = "https://mcpqueen.com/mcp";

const files = {
  node: "examples/clients/node-http.mjs",
  python: "examples/clients/python/main.py",
  pythonRequirements: "examples/clients/python/requirements.txt",
  langchain: "examples/integrations/langchain/main.py",
  langchainRequirements: "examples/integrations/langchain/requirements.txt",
  llamaindex: "examples/integrations/llamaindex/main.py",
  llamaindexRequirements: "examples/integrations/llamaindex/requirements.txt",
  cloudflare: "examples/integrations/cloudflare-agent/src/index.ts",
  huggingface: "examples/integrations/huggingface/main.py",
  huggingfaceReadme: "examples/integrations/huggingface/README.md",
  huggingfaceRequirements: "examples/integrations/huggingface/requirements.txt",
  datasetCard: "distribution/huggingface/README.md",
  datasetMetadata: "distribution/huggingface/dataset-metadata.json",
  manifest: "distribution/mcpqueen.json",
  ecosystemDoc: "docs/developer-ecosystem.md",
};

const contents = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, path]) => [name, await read(path)]),
  ),
);

const nodeCheck = spawnSync(
  process.execPath,
  ["--check", resolve(root, files.node)],
  { encoding: "utf8" },
);
assert.equal(nodeCheck.status, 0, nodeCheck.stderr);

const pythonFiles = [
  files.python,
  files.langchain,
  files.llamaindex,
  files.huggingface,
].map((path) => resolve(root, path));
const pythonCheck = spawnSync(
  "python3",
  [
    "-c",
    "import ast, pathlib, sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
    ...pythonFiles,
  ],
  { encoding: "utf8" },
);
assert.equal(pythonCheck.status, 0, pythonCheck.stderr);

for (
  const name of [
    "node",
    "python",
    "langchain",
    "llamaindex",
    "cloudflare",
    "huggingface",
  ]
) {
  assert.match(contents[name], new RegExp(endpoint.replaceAll(".", "\\.")));
}

assert.equal(contents.pythonRequirements.trim(), "mcp>=2.0.0,<3");
assert.equal(
  contents.langchainRequirements.trim(),
  "langchain-mcp-adapters==0.3.1",
);
assert.equal(
  contents.llamaindexRequirements.trim(),
  "llama-index-tools-mcp==0.4.8",
);
assert.equal(contents.huggingfaceRequirements.trim(), "openai>=2.46.0,<3");

for (const method of [
  "initialize",
  "notifications/initialized",
  "tools/list",
  "tools/call",
]) {
  assert.ok(contents.node.includes(method), `Node client is missing ${method}`);
}
assert.match(contents.node, /MCP-Protocol-Version/);
assert.match(contents.python, /Client\(MCP_URL\)/);
assert.match(contents.python, /call_tool\(\s*"search_servers"/);

for (const name of ["cloudflare", "huggingface"]) {
  assert.match(contents[name], /READ_ONLY_TOOLS/);
  const allowlist = contents[name].slice(
    contents[name].indexOf("READ_ONLY_TOOLS"),
    contents[name].indexOf(
      name === "cloudflare" ? "]);" : "]",
      contents[name].indexOf("READ_ONLY_TOOLS"),
    ) + 3,
  );
  assert.doesNotMatch(allowlist, /submit_feedback/);
}

const metadata = JSON.parse(contents.datasetMetadata);
const manifest = JSON.parse(contents.manifest);
assert.equal(metadata.status, "published_verified");
assert.equal(metadata.hub_repo_id, "healthai-hq/mcp-server-grades");
assert.equal(
  metadata.hub_url,
  "https://huggingface.co/datasets/healthai-hq/mcp-server-grades",
);
assert.equal(
  metadata.hub_api_url,
  "https://huggingface.co/api/datasets/healthai-hq/mcp-server-grades",
);
assert.equal(
  metadata.hub_card_url,
  `${metadata.hub_url}/raw/main/README.md`,
);
assert.equal(
  metadata.hub_snapshot_url,
  `${metadata.hub_url}/resolve/main/${metadata.hub_snapshot_file}`,
);
assert.equal(
  metadata.hub_parquet_api_url,
  "https://datasets-server.huggingface.co/parquet?dataset=healthai-hq%2Fmcp-server-grades",
);
assert.equal(metadata.hub_generated_parquet, true);
assert.equal(metadata.license, "other");
assert.match(contents.datasetCard, /^---\nlicense: other\n/);
assert.match(
  contents.datasetCard,
  new RegExp(metadata.public_dataset_url.replaceAll(".", "\\.")),
);
assert.match(
  contents.huggingfaceReadme,
  new RegExp(metadata.hub_url.replaceAll(".", "\\.")),
);
assert.doesNotMatch(
  contents.huggingfaceReadme,
  /No public Hugging Face dataset URL is claimed/,
);

const csv = await read(metadata.dataset_file);
assert.equal(csv.trimEnd().split("\n").length - 1, metadata.row_count);
assert.match(csv, /^server_name,title,grade,score,/);

const ecosystem = manifest.developer_ecosystem;
assert.equal(ecosystem.status, "repository_assets_prepared");
assert.equal(ecosystem.compatibility_matrix, files.ecosystemDoc);
assert.equal(ecosystem.deterministic_validation, "npm run examples:check");
assert.equal(ecosystem.hugging_face_dataset.status, metadata.status);
assert.equal(
  ecosystem.hugging_face_dataset.hub_repo_id,
  metadata.hub_repo_id,
);
assert.equal(ecosystem.hugging_face_dataset.hub_url, metadata.hub_url);
assert.equal(
  ecosystem.hugging_face_dataset.hub_api_url,
  metadata.hub_api_url,
);
assert.equal(
  ecosystem.hugging_face_dataset.hub_snapshot_url,
  metadata.hub_snapshot_url,
);
assert.equal(
  ecosystem.hugging_face_dataset.hub_parquet_api_url,
  metadata.hub_parquet_api_url,
);
assert.equal(ecosystem.hugging_face_dataset.generated_parquet, true);
assert.equal(ecosystem.rapidapi.mcp_transport_documented, false);
assert.ok(ecosystem.official_sources.length >= 10);
for (const url of ecosystem.official_sources) {
  assert.equal(new URL(url).protocol, "https:");
  assert.ok(
    contents.ecosystemDoc.includes(url),
    `missing official source in matrix: ${url}`,
  );
}
const requiredExampleArtifacts = [
  files.ecosystemDoc,
  files.node,
  files.python,
  files.pythonRequirements,
  files.langchain,
  files.llamaindex,
  files.cloudflare,
  files.huggingface,
  files.datasetCard,
  files.datasetMetadata,
];
for (const path of requiredExampleArtifacts) {
  assert.ok(
    manifest.required_files.includes(path),
    `missing required artifact: ${path}`,
  );
}

console.log("PASS: developer examples and Hugging Face metadata");
